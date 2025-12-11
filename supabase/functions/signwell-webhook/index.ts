import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    let updateData: any = {};
    let auditAction = '';
    let performedBy = '';

    switch (event) {
      case 'document_viewed':
        auditAction = 'guest_viewed';
        performedBy = data.recipient?.email || 'Unknown';
        break;

      case 'document_signed':
        const signerPlaceholder = data.recipient?.placeholder_name;
        if (signerPlaceholder === 'Guest') {
          updateData.guest_signed_at = new Date().toISOString();
          updateData.status = 'pending_host';
          auditAction = 'guest_signed';
        } else if (signerPlaceholder === 'Host') {
          updateData.host_signed_at = new Date().toISOString();
          auditAction = 'host_signed';
        }
        performedBy = data.recipient?.email || 'Unknown';
        break;

      case 'document_completed':
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        auditAction = 'completed';
        performedBy = 'System';
        
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
        break;

      case 'document_expired':
        updateData.status = 'expired';
        auditAction = 'expired';
        performedBy = 'System';
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

    console.log('Webhook processed successfully for document:', bookingDoc.id);

    return new Response(JSON.stringify({ success: true }), {
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
