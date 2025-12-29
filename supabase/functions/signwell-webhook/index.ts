import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lead stages that can be triggered by contract events
type LeadStage = 'new_lead' | 'unreached' | 'call_scheduled' | 'call_attended' | 'send_contract' | 
  'contract_out' | 'contract_signed' | 'ach_form_signed' | 'onboarding' | 'insurance_requested' | 'ops_handoff';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('SignWell webhook received:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;
    const signwellDocumentId = data?.document?.id || data?.id;

    if (!signwellDocumentId) {
      console.log('No document ID in webhook payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the booking document
    const { data: bookingDoc, error: findError } = await supabase
      .from('booking_documents')
      .select('*')
      .eq('signwell_document_id', signwellDocumentId)
      .single();

    if (findError || !bookingDoc) {
      console.log('Booking document not found for SignWell ID:', signwellDocumentId);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === FIND ASSOCIATED LEAD ===
    // Try to find a lead by the signwell_document_id or by recipient email/name
    let lead = null;
    
    // First try by signwell_document_id on leads table
    const { data: leadByDoc } = await supabase
      .from('leads')
      .select('id, name, email, stage, phone')
      .eq('signwell_document_id', signwellDocumentId)
      .maybeSingle();
    
    if (leadByDoc) {
      lead = leadByDoc;
      console.log('Found lead by signwell_document_id:', lead.name);
    }
    
    // If not found, try by recipient email
    if (!lead && bookingDoc.recipient_email) {
      const { data: leadByEmail } = await supabase
        .from('leads')
        .select('id, name, email, stage, phone')
        .eq('email', bookingDoc.recipient_email)
        .maybeSingle();
      
      if (leadByEmail) {
        lead = leadByEmail;
        console.log('Found lead by recipient email:', lead.name);
        
        // Link the document to the lead for future reference
        await supabase
          .from('leads')
          .update({ signwell_document_id: signwellDocumentId })
          .eq('id', lead.id);
      }
    }

    let updateData: any = {};
    let auditAction = '';
    let performedBy = '';
    
    // Track lead stage changes
    let leadStageChanged = false;
    let newLeadStage: LeadStage | null = null;
    let stageChangeReason = '';

    switch (event) {
      case 'document_viewed':
        auditAction = 'guest_viewed';
        performedBy = data.recipient?.email || 'Unknown';
        
        // If lead exists and is in send_contract, move to contract_out
        if (lead && lead.stage === 'send_contract') {
          newLeadStage = 'contract_out';
          leadStageChanged = true;
          stageChangeReason = 'Contract was viewed by recipient';
        }
        
        // Add timeline entry for lead
        if (lead) {
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'contract_viewed',
            metadata: {
              document_id: bookingDoc.id,
              signwell_id: signwellDocumentId,
              viewed_by: performedBy,
            },
          });
        }
        break;

      case 'document_signed':
        const signerPlaceholder = data.recipient?.placeholder_name;
        if (signerPlaceholder === 'Guest') {
          updateData.guest_signed_at = new Date().toISOString();
          updateData.status = 'pending_host';
          auditAction = 'guest_signed';
          
          // Add timeline entry for lead
          if (lead) {
            await supabase.from('lead_timeline').insert({
              lead_id: lead.id,
              action: 'contract_guest_signed',
              metadata: {
                document_id: bookingDoc.id,
                signwell_id: signwellDocumentId,
                signed_by: data.recipient?.email,
              },
            });
          }
        } else if (signerPlaceholder === 'Host') {
          updateData.host_signed_at = new Date().toISOString();
          auditAction = 'host_signed';
          
          if (lead) {
            await supabase.from('lead_timeline').insert({
              lead_id: lead.id,
              action: 'contract_host_signed',
              metadata: {
                document_id: bookingDoc.id,
                signwell_id: signwellDocumentId,
              },
            });
          }
        }
        performedBy = data.recipient?.email || 'Unknown';
        break;

      case 'document_completed':
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        auditAction = 'completed';
        performedBy = 'System';
        
        // === AUTO-ADVANCE LEAD TO CONTRACT_SIGNED ===
        if (lead && ['send_contract', 'contract_out'].includes(lead.stage)) {
          newLeadStage = 'contract_signed';
          leadStageChanged = true;
          stageChangeReason = 'Contract fully signed by all parties';
        }
        
        // Add comprehensive timeline entry for lead
        if (lead) {
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'contract_completed',
            metadata: {
              document_id: bookingDoc.id,
              signwell_id: signwellDocumentId,
              document_name: bookingDoc.document_name,
              completed_at: new Date().toISOString(),
            },
          });
        }
        
        // === AUTO-SET OWNER SERVICE TYPE BASED ON CONTRACT TYPE ===
        // Check if document has a contract_type and owner_id
        const contractType = bookingDoc.contract_type;
        const ownerId = bookingDoc.owner_id;
        
        if (contractType && ownerId) {
          let newServiceType: string | null = null;
          
          if (contractType === 'cohosting_agreement') {
            newServiceType = 'cohosting';
          } else if (contractType === 'management_agreement') {
            newServiceType = 'full_service';
          }
          
          if (newServiceType) {
            console.log(`Auto-setting owner ${ownerId} service_type to ${newServiceType} based on ${contractType}`);
            
            const { error: ownerUpdateError } = await supabase
              .from('property_owners')
              .update({ 
                service_type: newServiceType,
                updated_at: new Date().toISOString()
              })
              .eq('id', ownerId);
            
            if (ownerUpdateError) {
              console.error('Error updating owner service_type:', ownerUpdateError);
            } else {
              console.log(`Successfully updated owner ${ownerId} to ${newServiceType}`);
              
              // Add timeline entry for lead if exists
              if (lead) {
                await supabase.from('lead_timeline').insert({
                  lead_id: lead.id,
                  action: 'service_type_set',
                  metadata: {
                    owner_id: ownerId,
                    service_type: newServiceType,
                    contract_type: contractType,
                    document_id: bookingDoc.id,
                  },
                });
              }
            }
          }
        }
        
        // Auto-create mid-term booking when document is fully signed
        if (bookingDoc.property_id && !bookingDoc.booking_id) {
          try {
            // Extract booking details from the document's field configuration
            const fieldConfig = bookingDoc.field_configuration || {};
            const preFillData = fieldConfig.preFillData || {};
            
            // Parse dates from pre-fill data
            const leaseStartDate = preFillData.lease_start_date || preFillData.check_in_date;
            const leaseEndDate = preFillData.lease_end_date || preFillData.check_out_date;
            const monthlyRent = parseFloat(preFillData.monthly_rent?.replace(/[^0-9.]/g, '') || '0');
            const securityDeposit = parseFloat(preFillData.security_deposit_amount?.replace(/[^0-9.]/g, '') || '0');
            
            if (leaseStartDate && leaseEndDate && monthlyRent > 0) {
              console.log('Creating mid-term booking from completed document:', {
                property_id: bookingDoc.property_id,
                tenant_name: bookingDoc.recipient_name,
                start_date: leaseStartDate,
                end_date: leaseEndDate,
                monthly_rent: monthlyRent,
              });
              
              // Check if booking already exists for this guest/property/dates
              const { data: existingBooking } = await supabase
                .from('mid_term_bookings')
                .select('id')
                .eq('property_id', bookingDoc.property_id)
                .eq('tenant_name', bookingDoc.recipient_name)
                .eq('start_date', leaseStartDate)
                .single();
              
              if (!existingBooking) {
                const { data: newBooking, error: bookingError } = await supabase
                  .from('mid_term_bookings')
                  .insert({
                    property_id: bookingDoc.property_id,
                    tenant_name: bookingDoc.recipient_name || 'Guest',
                    tenant_email: bookingDoc.recipient_email,
                    start_date: leaseStartDate,
                    end_date: leaseEndDate,
                    monthly_rent: monthlyRent,
                    deposit_amount: securityDeposit,
                    status: 'active',
                    notes: `Auto-created from signed document: ${bookingDoc.document_name}`,
                  })
                  .select('id')
                  .single();
                
                if (bookingError) {
                  console.error('Error creating mid-term booking:', bookingError);
                } else {
                  console.log('Mid-term booking created:', newBooking.id);
                  
                  // Link the booking to the document
                  await supabase
                    .from('booking_documents')
                    .update({ booking_id: newBooking.id })
                    .eq('id', bookingDoc.id);
                }
              } else {
                console.log('Booking already exists, skipping creation');
              }
            } else {
              console.log('Missing required booking data, skipping mid-term booking creation');
            }
          } catch (bookingCreateError) {
            console.error('Error in mid-term booking creation:', bookingCreateError);
          }
        }
        break;

      case 'document_declined':
        updateData.status = 'declined';
        auditAction = 'declined';
        performedBy = data.recipient?.email || 'Unknown';
        
        // Move lead back to call_attended if contract was declined
        if (lead && ['send_contract', 'contract_out'].includes(lead.stage)) {
          newLeadStage = 'call_attended';
          leadStageChanged = true;
          stageChangeReason = `Contract declined by ${performedBy}`;
        }
        
        if (lead) {
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'contract_declined',
            metadata: {
              document_id: bookingDoc.id,
              signwell_id: signwellDocumentId,
              declined_by: performedBy,
              reason: data.decline_reason,
            },
          });
        }
        break;

      case 'document_expired':
        updateData.status = 'expired';
        auditAction = 'expired';
        performedBy = 'System';
        
        // Move lead back to send_contract so a new one can be sent
        if (lead && ['contract_out'].includes(lead.stage)) {
          newLeadStage = 'send_contract';
          leadStageChanged = true;
          stageChangeReason = 'Contract expired without signature';
        }
        
        if (lead) {
          await supabase.from('lead_timeline').insert({
            lead_id: lead.id,
            action: 'contract_expired',
            metadata: {
              document_id: bookingDoc.id,
              signwell_id: signwellDocumentId,
            },
          });
        }
        break;

      default:
        console.log('Unhandled webhook event:', event);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Update booking document if we have changes
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('booking_documents')
        .update(updateData)
        .eq('id', bookingDoc.id);

      if (updateError) {
        console.error('Error updating booking document:', updateError);
      }
    }

    // Create audit log entry
    if (auditAction) {
      await supabase.from('document_audit_log').insert({
        document_id: bookingDoc.id,
        action: auditAction,
        performed_by: performedBy,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        user_agent: req.headers.get('user-agent'),
        metadata: {
          event,
          signwell_data: data,
        },
      });
    }

    // === PROCESS LEAD STAGE CHANGE ===
    if (lead && leadStageChanged && newLeadStage) {
      console.log(`Auto-advancing lead ${lead.id} from ${lead.stage} to ${newLeadStage}: ${stageChangeReason}`);
      
      // Update lead stage
      await supabase
        .from('leads')
        .update({
          stage: newLeadStage,
          stage_changed_at: new Date().toISOString(),
          last_stage_auto_update_at: new Date().toISOString(),
          auto_stage_reason: stageChangeReason,
        })
        .eq('id', lead.id);
      
      // Log the event
      await supabase.from('lead_event_log').insert({
        lead_id: lead.id,
        event_type: 'stage_auto_changed',
        event_source: 'signwell-webhook',
        event_data: {
          previous_stage: lead.stage,
          new_stage: newLeadStage,
          reason: stageChangeReason,
          signwell_event: event,
          document_id: bookingDoc.id,
        },
        processed: false,
        stage_changed_to: newLeadStage,
      });
      
      // Add timeline entry for stage change
      await supabase.from('lead_timeline').insert({
        lead_id: lead.id,
        action: 'stage_auto_changed',
        metadata: {
          previous_stage: lead.stage,
          new_stage: newLeadStage,
          reason: stageChangeReason,
          triggered_by: 'signwell-webhook',
          event: event,
        },
      });
      
      // Trigger the stage change automations
      try {
        await fetch(`${supabaseUrl}/functions/v1/process-lead-stage-change`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: lead.id,
            newStage: newLeadStage,
            previousStage: lead.stage,
          }),
        });
        console.log(`Triggered process-lead-stage-change for lead ${lead.id}`);
      } catch (stageChangeError) {
        console.error('Error triggering stage change automation:', stageChangeError);
      }
    }

    console.log('Webhook processed successfully for document:', bookingDoc.id);

    return new Response(JSON.stringify({ 
      success: true,
      leadStageChanged,
      newLeadStage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in signwell-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
