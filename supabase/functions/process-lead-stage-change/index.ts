import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Format phone number to E.164 format (e.g., +17709065022)
function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's already 11 digits starting with 1, just add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Return as-is with + if it has more digits (international)
  if (digits.length > 10) {
    return `+${digits}`;
  }
  
  // Return original if we can't parse it
  return phone;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Psychology-driven message templates by stage (Cialdini principles + SPIN)
const STAGE_PSYCHOLOGY_TEMPLATES: Record<string, { sms?: string; email_subject?: string; email_body?: string; principle: string }> = {
  new_lead: {
    sms: "Hi {{name}}! This is {{sender}} from PeachHaus. Thanks for reaching out about property management. I've got some market insights for {{property_address}} I'd love to share. What time works for a quick call?",
    email_subject: "Welcome to PeachHaus - Your Property Management Partner",
    email_body: `Hi {{name}},

Thank you for your interest in PeachHaus property management! We're excited to learn more about your property at {{property_address}}.

**Why owners choose us:**
✓ Average 23% higher rental income vs. self-managed
✓ 4.9★ rating from property owners
✓ Full-service management with transparent reporting

I'd love to schedule a quick discovery call to discuss your goals. What time works best for you?

Looking forward to connecting!`,
    principle: "Reciprocity + Social Proof"
  },
  unreached: {
    sms: "Hi {{name}}, just following up on property management for your rental. We have 2 onboarding spots open this month - still interested? Reply YES and I'll share next steps.",
    email_subject: "Quick follow-up on your property",
    email_body: `Hi {{name}},

I wanted to follow up on your property management inquiry. We currently have limited availability for new properties this month.

Would you like to schedule a quick call to discuss how we can help maximize your rental income?

Best regards`,
    principle: "Scarcity + Urgency"
  },
  call_scheduled: {
    sms: "Looking forward to our call, {{name}}! I'll be calling you at the scheduled time. Feel free to text if anything changes.",
    email_subject: "Confirming Our Discovery Call",
    email_body: `Hi {{name}},

I'm looking forward to our upcoming conversation about your property at {{property_address}}.

**To prepare, it would be helpful to know:**
- Your current rental situation (if any)
- Your goals for the property
- Any specific concerns or questions

This helps me provide the most relevant information for your situation.

Talk soon!`,
    principle: "Commitment + Preparation"
  },
  call_attended: {
    sms: "Great speaking with you, {{name}}! As discussed, I'm preparing a management proposal for {{property_address}}. You'll receive it shortly.",
    email_subject: "Next Steps After Our Conversation",
    email_body: `Hi {{name}},

Thank you for the great conversation today! Based on what we discussed, I'm confident PeachHaus is the right partner for your property at {{property_address}}.

**Key points we covered:**
{{ai_call_summary}}

**Next Steps:**
1. Review the management agreement (coming shortly)
2. Sign when ready
3. We'll begin our onboarding process

Let me know if you have any questions!`,
    principle: "Commitment + Consistency"
  },
  contract_out: {
    sms: "Hi {{name}}, your PeachHaus management agreement is ready for signature. Let me know if you have any questions!",
    email_subject: "Your Management Agreement is Ready",
    email_body: `Hi {{name}},

Your management agreement for {{property_address}} is ready for review and signature.

**What happens after signing:**
1. You'll set up ACH for easy revenue deposits
2. We'll collect property details and access info
3. Professional photos and listing optimization
4. You start earning within 2-3 weeks

The agreement is straightforward - let me know if anything needs clarification.

Ready when you are!`,
    principle: "Clarity + Momentum"
  },
  contract_signed: {
    sms: "Welcome to PeachHaus, {{name}}! 🎉 Your agreement is signed. Next up: setting up your direct deposit for rental income. Check your email!",
    email_subject: "Welcome to the PeachHaus Family! 🎉",
    email_body: `Congratulations {{name}}!

Welcome to PeachHaus! Your management agreement is now complete, and we're thrilled to have you on board.

**Immediate Next Step:**
Please complete your ACH setup so we can deposit your rental income directly: {{ach_link}}

**Coming Soon:**
- Your onboarding coordinator will reach out within 24 hours
- We'll schedule property access and photo shoot
- Your property will be live within 2-3 weeks

Thank you for trusting us with your property!`,
    principle: "Celebration + Momentum"
  },
  ach_form_signed: {
    sms: "Perfect, {{name}}! ACH is set up. Last step: complete your property info so we can start marketing. Link in your email!",
    email_subject: "ACH Complete - One More Step!",
    email_body: `Great news {{name}}!

Your direct deposit is all set up. You're almost ready to start earning.

**Final Step:**
Complete your property information form so we can begin marketing: {{onboarding_link}}

This takes about 10-15 minutes and helps us create the best listing for your property.

Almost there!`,
    principle: "Progress + Near-completion"
  },
  ops_handoff: {
    sms: "{{name}}, your property is now with our operations team! They'll reach out shortly to schedule access and photos. Exciting times ahead!",
    email_subject: "Your Property is in Good Hands",
    email_body: `Hi {{name}},

Great news - your onboarding is complete and your property is now with our operations team!

**What's Happening Next:**
1. Our ops coordinator will contact you within 24-48 hours
2. We'll schedule property access and professional photography
3. Listing optimization and publishing
4. You'll start receiving booking notifications!

Thank you for completing everything so quickly. We can't wait to get you earning!

The PeachHaus Team`,
    principle: "Trust + Handoff"
  }
};

// AI-powered message personalization
async function personalizeMessageWithAI(
  template: string, 
  lead: Record<string, unknown>, 
  stage: string
): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return template;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional property management sales assistant. Personalize the following message template based on the lead's information. Keep the same structure and length, but make it feel personal and relevant. Do not add new sections or change the core message. Only return the personalized message, nothing else.`
          },
          {
            role: "user", 
            content: `Template: ${template}\n\nLead Info:\n- Name: ${lead.name}\n- Property: ${lead.property_address || 'Not specified'}\n- Property Type: ${lead.property_type || 'Not specified'}\n- Notes: ${lead.notes || 'None'}\n- AI Summary: ${lead.ai_summary || 'None'}\n- Current Stage: ${stage}\n\nPersonalize this message for the lead.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    const result = await response.json();
    return result.choices?.[0]?.message?.content || template;
  } catch (error) {
    console.error("AI personalization error:", error);
    return template;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId, newStage, previousStage, autoTriggered, triggerSource } = await req.json();
    console.log(`Processing stage change for lead ${leadId}: ${previousStage} -> ${newStage}`);
    console.log(`Auto-triggered: ${autoTriggered}, Source: ${triggerSource || 'manual'}`);

    // Fetch the lead with all details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // Log the stage change event
    await supabase.from("lead_event_log").insert({
      lead_id: leadId,
      event_type: "stage_changed",
      event_source: triggerSource || "manual",
      event_data: { 
        previous_stage: previousStage, 
        new_stage: newStage,
        auto_triggered: autoTriggered || false
      },
      stage_changed_to: newStage,
      processed: true
    });

    // Fetch automations for this stage
    const { data: automations, error: autoError } = await supabase
      .from("lead_automations")
      .select("*")
      .eq("trigger_stage", newStage)
      .eq("is_active", true)
      .order("delay_minutes", { ascending: true });

    if (autoError) {
      console.error("Error fetching automations:", autoError);
      throw autoError;
    }

    // Get psychology template for this stage
    const psychologyTemplate = STAGE_PSYCHOLOGY_TEMPLATES[newStage];
    
    console.log(`Found ${automations?.length || 0} automations for stage ${newStage}`);
    if (psychologyTemplate) {
      console.log(`Using psychology principle: ${psychologyTemplate.principle}`);
    }

    // Process each automation
    for (const automation of automations || []) {
      try {
        // Replace template variables with enhanced placeholders
        const processTemplate = (template: string) => {
          const baseUrl = supabaseUrl.replace('.supabase.co', '');
          return template
            .replace(/\{\{name\}\}/g, lead.name?.split(' ')[0] || lead.name || "") // First name only
            .replace(/\{\{full_name\}\}/g, lead.name || "")
            .replace(/\{\{email\}\}/g, lead.email || "")
            .replace(/\{\{phone\}\}/g, lead.phone || "")
            .replace(/\{\{property_address\}\}/g, lead.property_address || "your property")
            .replace(/\{\{property_type\}\}/g, lead.property_type || "property")
            .replace(/\{\{opportunity_value\}\}/g, lead.opportunity_value?.toString() || "0")
            .replace(/\{\{ach_link\}\}/g, `${baseUrl}/payment-setup?lead=${leadId}`)
            .replace(/\{\{onboarding_link\}\}/g, `${baseUrl}/onboard/existing-str?lead=${leadId}`)
            .replace(/\{\{sender\}\}/g, "Anja")
            .replace(/\{\{ai_call_summary\}\}/g, lead.ai_summary || "We discussed your property management needs and goals.")
            .replace(/\{\{ai_next_action\}\}/g, lead.ai_next_action || "Review and sign the management agreement");
        };

        // Determine message content - use automation template or fall back to psychology template
        let messageBody = "";
        let emailSubject = automation.template_subject || "";
        
        if (automation.template_content) {
          messageBody = processTemplate(automation.template_content);
        } else if (psychologyTemplate) {
          // Use psychology-driven templates as fallback
          if (automation.action_type === "sms" && psychologyTemplate.sms) {
            messageBody = processTemplate(psychologyTemplate.sms);
          } else if (automation.action_type === "email" && psychologyTemplate.email_body) {
            messageBody = processTemplate(psychologyTemplate.email_body);
            emailSubject = emailSubject || processTemplate(psychologyTemplate.email_subject || "Update from PeachHaus");
          }
        }

        // AI personalization for high-value leads or AI-enabled automations
        if (automation.ai_enabled && messageBody) {
          console.log(`Personalizing message with AI for automation "${automation.name}"`);
          messageBody = await personalizeMessageWithAI(messageBody, lead, newStage);
        }

        if (automation.action_type === "sms" && lead.phone && messageBody) {
          // Send SMS via Twilio or Telnyx
          const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
          const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
          
          let smsSent = false;
          let externalId = "";
          let errorMessage = "";

          // Format destination phone to E.164
          const formattedPhone = formatPhoneE164(lead.phone);
          console.log(`Sending SMS to ${formattedPhone} (original: ${lead.phone})`);

          // Try Telnyx first (preferred), then fall back to Twilio
          if (telnyxApiKey) {
            try {
              const fromPhone = formatPhoneE164(Deno.env.get("TELNYX_PHONE_NUMBER") || "+14049247251");
              console.log(`Telnyx from phone: ${fromPhone}`);
              
              const telnyxResponse = await fetch("https://api.telnyx.com/v2/messages", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${telnyxApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: fromPhone,
                  to: formattedPhone,
                  text: messageBody,
                }),
              });
              const telnyxResult = await telnyxResponse.json();
              smsSent = telnyxResponse.ok;
              externalId = telnyxResult.data?.id || "";
              if (!smsSent) errorMessage = JSON.stringify(telnyxResult.errors || telnyxResult);
            } catch (e) {
              console.error("Telnyx SMS error:", e);
            }
          }
          
          // Fallback to Twilio
          if (!smsSent && twilioAccountSid && twilioAuthToken) {
            const twilioPhone = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
            
            const formData = new URLSearchParams();
            formData.append("To", formattedPhone);
            formData.append("From", formatPhoneE164(twilioPhone!));
            formData.append("Body", messageBody);

            const twilioResponse = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: formData.toString(),
            });

            const twilioResult = await twilioResponse.json();
            smsSent = twilioResponse.ok;
            externalId = twilioResult.sid || "";
            if (!smsSent) errorMessage = twilioResult.error_message || "";
          }

          // Record communication
          await supabase.from("lead_communications").insert({
            lead_id: leadId,
            communication_type: "sms",
            direction: "outbound",
            body: messageBody,
            status: smsSent ? "sent" : "failed",
            external_id: externalId,
            error_message: errorMessage || null,
          });

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: leadId,
            action: `Automated SMS sent: "${automation.name}"`,
            metadata: { 
              automation_id: automation.id, 
              message_id: externalId,
              psychology_principle: psychologyTemplate?.principle,
              ai_personalized: automation.ai_enabled
            },
          });

          console.log(`SMS ${smsSent ? 'sent' : 'failed'} for automation "${automation.name}"`);
          
        } else if (automation.action_type === "email" && lead.email && messageBody) {
          // Send email via Resend
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          
          if (resendApiKey) {
            // Convert plain text to HTML with nice formatting
            const htmlBody = messageBody
              .replace(/\n\n/g, '</p><p>')
              .replace(/\n/g, '<br>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/✓/g, '✅');

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "PeachHaus <info@peachhausgroup.com>",
                to: [lead.email],
                subject: emailSubject || "Message from PeachHaus",
                text: messageBody,
                html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><p>${htmlBody}</p><br><p style="color: #666;">Best regards,<br>The PeachHaus Team</p></div>`,
              }),
            });

            const emailResult = await emailResponse.json();

            // Record communication
            await supabase.from("lead_communications").insert({
              lead_id: leadId,
              communication_type: "email",
              direction: "outbound",
              subject: emailSubject,
              body: messageBody,
              status: emailResponse.ok ? "sent" : "failed",
              external_id: emailResult.id,
              error_message: emailResult.message,
            });

            // Add timeline entry
            await supabase.from("lead_timeline").insert({
              lead_id: leadId,
              action: `Automated email sent: "${automation.name}"`,
              metadata: { 
                automation_id: automation.id, 
                email_id: emailResult.id,
                psychology_principle: psychologyTemplate?.principle,
                ai_personalized: automation.ai_enabled
              },
            });

            console.log(`Email sent for automation "${automation.name}"`);
          }
        } else if (automation.action_type === "ai_qualify") {
          // Trigger AI qualification
          await fetch(`${supabaseUrl}/functions/v1/lead-ai-assistant`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ leadId, action: "qualify" }),
          });

          console.log(`AI qualification triggered for lead ${leadId}`);
        }
      } catch (automationError) {
        console.error(`Error processing automation "${automation.name}":`, automationError);
        // Continue with other automations
      }
    }

    // Schedule follow-up sequences for this stage
    try {
      console.log(`Scheduling follow-up sequences for stage ${newStage}`);
      await fetch(`${supabaseUrl}/functions/v1/schedule-lead-follow-ups`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leadId, stage: newStage }),
      });
      console.log(`Follow-up sequences scheduled for lead ${leadId}`);
    } catch (seqError) {
      console.error("Error scheduling follow-up sequences:", seqError);
    }

    return new Response(
      JSON.stringify({ success: true, automationsProcessed: automations?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing lead stage change:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
