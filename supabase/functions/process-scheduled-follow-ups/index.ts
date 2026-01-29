import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hosted image URLs
const hostsPhotoUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Gemini_Generated_Image_1rel501rel501rel.png";
const signatureUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Screenshot_41.jpg";
const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

// Presentation URLs
const PRESENTATIONS = {
  onboarding: "https://propertycentral.lovable.app/p/onboarding",
  owner_portal: "https://propertycentral.lovable.app/p/owner-portal",
  designer: "https://propertycentral.lovable.app/p/designer",
};

// Call type content generators
function getCallTypeDetails(isVideoCall: boolean, meetLink: string | null, phone: string | null): string {
  if (isVideoCall && meetLink) {
    return `📹 <strong>Video Call:</strong> <a href="${meetLink}" style="color: #16a34a;">${meetLink}</a>`;
  } else {
    return `📞 <strong>Phone Call:</strong> We'll call you at ${phone || "your phone number on file"}`;
  }
}

function getCallTypeBrief(isVideoCall: boolean, meetLink: string | null, phone: string | null): string {
  if (isVideoCall && meetLink) {
    return `Join here: ${meetLink}`;
  } else {
    return `We'll call you at ${formatPhoneForDisplay(phone)}`;
  }
}

function getCallTypeReminder(isVideoCall: boolean, meetLink: string | null, phone: string | null): string {
  if (isVideoCall && meetLink) {
    return `Join the video call here: ${meetLink}`;
  } else {
    return `We'll be calling you at ${formatPhoneForDisplay(phone)}.`;
  }
}

function formatPhoneForDisplay(phone: string | null): string {
  if (!phone) return "your number";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Format date/time in EST
function formatInEST(date: Date): { date: string; time: string; dateTime: string } {
  const estDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const estTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  return {
    date: estDateFormatter.format(date),
    time: estTimeFormatter.format(date) + " EST",
    dateTime: `${estDateFormatter.format(date)} at ${estTimeFormatter.format(date)} EST`
  };
}

// Process presentation links in template
function processPresentationLinks(content: string, isEmail: boolean): string {
  let processed = content;
  
  // Presentation button labels
  const buttonLabels: Record<string, string> = {
    onboarding: '▶ Watch Our Process Overview',
    owner_portal: '▶ See Your Future Owner Portal',
    designer: '▶ See How We Transform Properties',
  };
  
  // Replace presentation link placeholders
  Object.entries(PRESENTATIONS).forEach(([key, url]) => {
    const placeholder = `[PRESENTATION_LINK:${key}]`;
    if (isEmail) {
      // HTML button for emails
      const buttonHtml = `
        <div style="text-align: center; margin: 20px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #b8956a 0%, #d4b896 100%); color: white; padding: 14px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 8px rgba(184, 149, 106, 0.3);">
            ${buttonLabels[key] || '▶ View Presentation'}
          </a>
        </div>`;
      processed = processed.replace(placeholder, buttonHtml);
    } else {
      // Plain URL for SMS
      processed = processed.replace(placeholder, url);
    }
  });
  
  return processed;
}

// Process call type placeholders
function processCallTypePlaceholders(
  content: string,
  isVideoCall: boolean,
  meetLink: string | null,
  phone: string | null
): string {
  let processed = content;
  
  // Replace call type placeholders
  processed = processed.replace('[CALL_TYPE_DETAILS]', getCallTypeDetails(isVideoCall, meetLink, phone));
  processed = processed.replace('[CALL_TYPE_BRIEF]', getCallTypeBrief(isVideoCall, meetLink, phone));
  processed = processed.replace('[CALL_TYPE_REMINDER]', getCallTypeReminder(isVideoCall, meetLink, phone));
  
  return processed;
}

function buildStyledEmailHtml({
  subject,
  message,
  recipientFirstName,
}: {
  subject: string;
  message: string;
  recipientFirstName: string;
}) {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f3ef; -webkit-font-smoothing: antialiased;">
  
  <!-- Outer Container -->
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ef;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Email Card -->
        <table cellpadding="0" cellspacing="0" width="620" style="max-width: 620px; background-color: #ffffff; border-radius: 0; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
          
          <!-- Elegant Top Border -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8956a 0%, #d4b896 50%, #b8956a 100%);"></td>
          </tr>
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; text-align: center; background-color: #ffffff;">
              <img src="${LOGO_URL}" 
                   alt="PeachHaus" 
                   style="height: 44px; width: auto;"
                   onerror="this.style.display='none'">
            </td>
          </tr>
          
          <!-- Message Content -->
          <tr>
            <td style="padding: 24px 48px 36px 48px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 24px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 0.5px; line-height: 1.2;">
                Dear ${recipientFirstName},
              </p>
              
              <!-- Message Body -->
              ${message}
              
            </td>
          </tr>
          
          <!-- Elegant Divider -->
          <tr>
            <td style="padding: 0 48px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="height: 1px; background: linear-gradient(90deg, transparent 0%, #d4b896 20%, #d4b896 80%, transparent 100%);"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature Section -->
          <tr>
            <td style="padding: 32px 48px 40px 48px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Hosts Photo -->
                  <td style="width: 100px; vertical-align: top; padding-right: 20px;">
                    <img src="${hostsPhotoUrl}" 
                         alt="Anja & Ingo" 
                         style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #f5f3ef; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                  </td>
                  
                  <!-- Signature Info -->
                  <td style="vertical-align: top;">
                    <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 14px; color: #4a4a4a; line-height: 1.5;">
                      With warm regards,
                    </p>
                    <img src="${signatureUrl}" 
                         alt="Anja's Signature" 
                         style="height: 40px; width: auto; margin: 4px 0 8px 0;">
                    <p style="margin: 0; font-family: Georgia, serif; font-size: 13px; color: #6b6b6b; line-height: 1.5;">
                      Anja Schär &amp; Ingo Schär<br>
                      <span style="color: #b8956a;">Founders, PeachHaus Group</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Elegant Bottom Border -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8956a 0%, #d4b896 50%, #b8956a 100%);"></td>
          </tr>
          
        </table>
        
        <!-- Footer -->
        <table cellpadding="0" cellspacing="0" width="620" style="max-width: 620px;">
          <tr>
            <td style="padding: 28px 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 13px; color: #8b8b8b; line-height: 1.6;">
                <a href="https://peachhaus.co" style="color: #b8956a; text-decoration: none;">peachhaus.co</a>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <a href="mailto:info@peachhausgroup.com" style="color: #b8956a; text-decoration: none;">info@peachhausgroup.com</a>
              </p>
              <p style="margin: 0; font-family: Georgia, serif; font-size: 12px; color: #ababab;">
                © ${currentYear} PeachHaus Group. Atlanta, GA
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing scheduled follow-ups...");

    // Get all pending follow-ups that are due
    const { data: pendingFollowUps, error: fetchError } = await supabase
      .from("lead_follow_up_schedules")
      .select(`
        *,
        leads!inner(*),
        lead_follow_up_sequences(*),
        lead_follow_up_steps(*)
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending follow-ups:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingFollowUps?.length || 0} pending follow-ups to process`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const followUp of pendingFollowUps || []) {
      try {
        const lead = followUp.leads;
        const step = followUp.lead_follow_up_steps;
        const sequence = followUp.lead_follow_up_sequences;

        // Check if lead has responded (should skip remaining follow-ups)
        if (sequence?.stop_on_response && lead.last_response_at) {
          const responseDate = new Date(lead.last_response_at);
          const scheduleDate = new Date(followUp.created_at);
          
          if (responseDate > scheduleDate) {
            console.log(`Skipping follow-up for lead ${lead.id} - response received`);
            await supabase
              .from("lead_follow_up_schedules")
              .update({ status: "skipped", updated_at: new Date().toISOString() })
              .eq("id", followUp.id);
            skipped++;
            continue;
          }
        }

        // Check if follow-ups are paused for this lead
        if (lead.follow_up_paused) {
          console.log(`Skipping follow-up for lead ${lead.id} - paused`);
          skipped++;
          continue;
        }

        const recipientFirstName = lead.name?.split(' ')[0] || 'there';

        // Fetch discovery call data for call-type awareness
        let isVideoCall = false;
        let meetLink: string | null = null;
        let callScheduledAt: Date | null = null;
        
        const triggerStage = sequence?.trigger_stage;
        if (triggerStage === 'call_scheduled' || triggerStage === 'call_attended') {
          const { data: discoveryCall } = await supabase
            .from("discovery_calls")
            .select("meeting_type, google_meet_link, scheduled_at")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (discoveryCall) {
            isVideoCall = discoveryCall.meeting_type === 'video';
            meetLink = discoveryCall.google_meet_link;
            callScheduledAt = discoveryCall.scheduled_at ? new Date(discoveryCall.scheduled_at) : null;
            console.log(`Call type for lead ${lead.id}: ${isVideoCall ? 'VIDEO' : 'PHONE'}, meetLink: ${meetLink}`);
          }
        }

        // Process template variables (fallback)
        const processTemplate = (template: string) => {
          let processed = template
            .replace(/\{\{name\}\}/g, lead.name || "")
            .replace(/\{\{first_name\}\}/g, recipientFirstName)
            .replace(/\{\{email\}\}/g, lead.email || "")
            .replace(/\{\{phone\}\}/g, lead.phone || "")
            .replace(/\{\{property_address\}\}/g, lead.property_address || "")
            .replace(/\{\{opportunity_value\}\}/g, lead.opportunity_value?.toString() || "0")
            .replace(/\{\{ach_link\}\}/g, `https://peachhaus.co/payment-setup`)
            .replace(/\{\{onboarding_link\}\}/g, `https://peachhaus.co/onboard/existing-str`);
          
          // Process call-type placeholders
          processed = processCallTypePlaceholders(processed, isVideoCall, meetLink, lead.phone);
          
          return processed;
        };

        const actionType = step?.action_type || "sms";
        const isEmail = actionType === "email" || actionType === "both";
        const isFirstStep = step?.step_number === 1;
        const purpose = isFirstStep ? "first_touch" : "follow_up";
        
        // Try AI-generated message first
        let messageBody = "";
        let emailSubject = step?.template_subject ? processTemplate(step.template_subject) : "Message from PeachHaus";
        let usedAI = false;
        
        try {
          console.log(`Generating contextual ${actionType} for lead ${lead.id}, purpose: ${purpose}`);
          
          const aiResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-contextual-message`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                leadId: lead.id,
                messageType: actionType === "both" ? "sms" : actionType,
                purpose,
                templateHint: step?.template_content,
                stepNumber: step?.step_number,
                sequenceName: sequence?.name,
                // Pass call context for AI awareness
                isVideoCall,
                meetLink,
                callScheduledAt: callScheduledAt?.toISOString(),
              }),
            }
          );

          if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            if (aiResult.success && aiResult.message) {
              messageBody = aiResult.message;
              usedAI = true;
              console.log(`Using AI-generated message for lead ${lead.id}`);
            }
          } else {
            console.log(`AI generation failed, falling back to template for lead ${lead.id}`);
          }
        } catch (aiError) {
          console.error(`AI generation error for lead ${lead.id}:`, aiError);
        }
        
        // Fallback to static template if AI failed
        if (!messageBody && step?.template_content) {
          messageBody = processTemplate(step.template_content);
          // Process presentation links for template content
          messageBody = processPresentationLinks(messageBody, isEmail);
          console.log(`Using template fallback for lead ${lead.id}`);
        }
        
        if (!messageBody) {
          console.log(`No message body for lead ${lead.id}, skipping`);
          skipped++;
          continue;
        }

        let sendSuccess = false;

        // Send AI Voice Call if applicable
        if (actionType === "voice_call" && lead.phone) {
          try {
            console.log(`Initiating AI voice call for lead ${lead.id}`);
            
            // Invoke the lead-ai-voice-call function
            const voiceCallResponse = await fetch(
              `${supabaseUrl}/functions/v1/lead-ai-voice-call`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  leadId: lead.id,
                  callType: 'follow_up',
                }),
              }
            );

            const voiceCallResult = await voiceCallResponse.json();
            
            if (voiceCallResponse.ok && voiceCallResult.success) {
              console.log(`AI voice call initiated for lead ${lead.id}: ${voiceCallResult.callSid}`);
              sendSuccess = true;
              
              // Record is already created by lead-ai-voice-call function
            } else {
              console.error(`Failed to initiate voice call for lead ${lead.id}:`, voiceCallResult.error);
            }
          } catch (voiceError) {
            console.error(`Error initiating voice call for lead ${lead.id}:`, voiceError);
          }
        }

        // Send SMS if applicable
        if ((actionType === "sms" || actionType === "both") && lead.phone) {
          const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
          const twilioPhone = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

          if (twilioAccountSid && twilioAuthToken && twilioPhone) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
            
            const formData = new URLSearchParams();
            formData.append("To", lead.phone);
            formData.append("From", twilioPhone);
            formData.append("Body", messageBody);
            formData.append("StatusCallback", `${supabaseUrl}/functions/v1/twilio-status-callback`);

            const twilioResponse = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: formData.toString(),
            });

            const twilioResult = await twilioResponse.json();
            
            // Record communication
            await supabase.from("lead_communications").insert({
              lead_id: lead.id,
              communication_type: "sms",
              direction: "outbound",
              body: messageBody,
              status: twilioResponse.ok ? "sent" : "failed",
              external_id: twilioResult.sid,
              error_message: twilioResult.error_message,
              sequence_id: sequence?.id,
              step_number: step?.step_number,
              delivery_status: twilioResponse.ok ? "sent" : "failed",
            });

            sendSuccess = twilioResponse.ok;
            console.log(`SMS ${twilioResponse.ok ? "sent" : "failed"} for lead ${lead.id}`);
          }
        }

        // Send email if applicable
        if ((actionType === "email" || actionType === "both") && lead.email) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          
          if (resendApiKey) {
            // Build styled HTML email
            const htmlContent = buildStyledEmailHtml({
              subject: emailSubject,
              message: messageBody,
              recipientFirstName,
            });

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "PeachHaus Group <info@peachhausgroup.com>",
                to: [lead.email],
                cc: ["anja@peachhausgroup.com"],
                subject: emailSubject,
                html: htmlContent,
              }),
            });

            const emailResult = await emailResponse.json();

            // Record communication
            await supabase.from("lead_communications").insert({
              lead_id: lead.id,
              communication_type: "email",
              direction: "outbound",
              subject: emailSubject,
              body: messageBody,
              status: emailResponse.ok ? "sent" : "failed",
              external_id: emailResult.id,
              error_message: emailResult.message,
              sequence_id: sequence?.id,
              step_number: step?.step_number,
              delivery_status: emailResponse.ok ? "sent" : "failed",
            });

            sendSuccess = sendSuccess || emailResponse.ok;
            console.log(`Email ${emailResponse.ok ? "sent" : "failed"} for lead ${lead.id}`);
          }
        }

        // Update follow-up status
        await supabase
          .from("lead_follow_up_schedules")
          .update({
            status: sendSuccess ? "sent" : "failed",
            sent_at: sendSuccess ? new Date().toISOString() : null,
            attempt_count: followUp.attempt_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", followUp.id);

        // Update lead's last contacted time
        if (sendSuccess) {
          await supabase
            .from("leads")
            .update({ last_contacted_at: new Date().toISOString() })
            .eq("id", lead.id);

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: lead.id,
            action: `Automated follow-up sent (Step ${step?.step_number} of ${sequence?.name || 'sequence'})`,
            metadata: { 
              sequence_id: sequence?.id, 
              step_number: step?.step_number,
              action_type: actionType 
            },
          });

          processed++;
        } else {
          failed++;
        }

      } catch (err) {
        console.error(`Error processing follow-up ${followUp.id}:`, err);
        
        // Mark as failed
        await supabase
          .from("lead_follow_up_schedules")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
            attempt_count: followUp.attempt_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", followUp.id);
        
        failed++;
      }
    }

    console.log(`Follow-up processing complete: ${processed} sent, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed, 
        skipped, 
        failed,
        total: pendingFollowUps?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing scheduled follow-ups:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
