import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PAYMENT-SETUP-REMINDERS] ${step}${detailsStr}`);
};

// Research-backed reminder schedule and messaging
// Based on best practices from payment collection, behavioral psychology, and customer success
const REMINDER_SCHEDULE = {
  // Day 3: Friendly check-in - helpful, not pushy
  reminder_1: { daysAfter: 3, type: 'friendly_checkin' },
  // Day 7: Benefits focused - remind them of value
  reminder_2: { daysAfter: 7, type: 'benefits_focus' },
  // Day 14: Final reminder - gentle urgency
  final_reminder: { daysAfter: 14, type: 'final_reminder' },
};

interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface PaymentRequest {
  id: string;
  owner_id: string;
  initial_sent_at: string;
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  final_reminder_sent_at: string | null;
  stripe_session_url: string | null;
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return '';
  const lowerName = fullName.toLowerCase();
  if (lowerName.includes('unknown')) return '';
  return fullName.split(' ')[0] || '';
}

function getSmsTemplates(firstName: string, setupUrl: string) {
  const greeting = firstName ? `Hi ${firstName}` : 'Hi';
  
  return {
    friendly_checkin: `${greeting}, just a quick reminder to set up your payment method for easier monthly billing. It only takes 2 mins: ${setupUrl} - PeachHaus`,
    
    benefits_focus: `${greeting}, your payment setup is still pending. Once complete, your monthly fees process automatically—no manual steps needed. Quick link: ${setupUrl} - PeachHaus`,
    
    final_reminder: `${greeting}, final reminder to complete your payment setup. This ensures smooth monthly billing. Takes 2 mins: ${setupUrl} - PeachHaus`,
  };
}

function getEmailTemplates(firstName: string, name: string, setupUrl: string) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  
  return {
    friendly_checkin: {
      subject: 'Quick reminder: Complete your payment setup',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 30px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">🍑 PeachHaus</h1>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 40px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">${greeting}</p>
      
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
        Just wanted to follow up on setting up your payment method. I know life gets busy, but this quick 2-minute setup ensures:
      </p>
      
      <ul style="color: #4a5568; line-height: 2; margin-bottom: 24px;">
        <li>Your monthly statements process smoothly</li>
        <li>No delays in your property management</li>
        <li>One less thing to think about each month</li>
      </ul>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${setupUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
          Complete Setup →
        </a>
      </div>
      
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        Questions? Just reply to this email or call us at (404) 800-5932.
      </p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
      <p>© ${new Date().getFullYear()} PeachHaus Group</p>
    </div>
  </div>
</body>
</html>`,
    },
    
    benefits_focus: {
      subject: 'Your payment setup is almost complete',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 30px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">🍑 PeachHaus</h1>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 40px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">${greeting}</p>
      
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
        We noticed your payment method setup is still pending. Here's why other property owners love having it done:
      </p>
      
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #10b981;">
        <p style="color: #166534; font-weight: 600; margin: 0 0 16px 0;">✨ What you'll get:</p>
        <ul style="color: #15803d; margin: 0; padding: 0 0 0 20px; line-height: 2;">
          <li><strong>Set it and forget it</strong> — No more manual payments</li>
          <li><strong>Complete visibility</strong> — See every charge before it posts</li>
          <li><strong>Instant receipts</strong> — Email confirmations for every transaction</li>
          <li><strong>Bank-level security</strong> — Your info is encrypted end-to-end</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${setupUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
          Finish Setup (2 mins) →
        </a>
      </div>
      
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        Need help? We're just a call away at (404) 800-5932.
      </p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
      <p>© ${new Date().getFullYear()} PeachHaus Group</p>
    </div>
  </div>
</body>
</html>`,
    },
    
    final_reminder: {
      subject: 'Final reminder: Complete your payment setup',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 30px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">🍑 PeachHaus</h1>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 40px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">${greeting}</p>
      
      <p style="color: #4a5568; line-height: 1.8; margin-bottom: 20px;">
        This is a final reminder to complete your payment method setup. Having this in place ensures your property management services continue smoothly without any interruptions.
      </p>
      
      <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <p style="color: #92400e; margin: 0; font-size: 15px;">
          <strong>⏰ Quick action needed:</strong> Complete your 2-minute setup to avoid any delays with your monthly billing.
        </p>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${setupUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
          Complete Setup Now →
        </a>
      </div>
      
      <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
        If you're having any issues or have questions, please reply to this email or call us at (404) 800-5932. We're here to help!
      </p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #a0aec0; font-size: 12px;">
      <p>© ${new Date().getFullYear()} PeachHaus Group</p>
    </div>
  </div>
</body>
</html>`,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting payment setup reminders check");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    // Fetch all pending payment setup requests
    const { data: pendingRequests, error: fetchError } = await supabase
      .from("payment_setup_requests")
      .select(`
        id,
        owner_id,
        initial_sent_at,
        reminder_1_sent_at,
        reminder_2_sent_at,
        final_reminder_sent_at,
        stripe_session_url
      `)
      .eq("status", "pending");

    if (fetchError) {
      throw new Error(`Failed to fetch pending requests: ${fetchError.message}`);
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      logStep("No pending payment setup requests found");
      return new Response(JSON.stringify({ message: "No pending reminders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${pendingRequests.length} pending requests`);

    const now = new Date();
    const remindersSent: { ownerId: string; type: string }[] = [];

    for (const request of pendingRequests) {
      // Get owner details
      const { data: owner, error: ownerError } = await supabase
        .from("property_owners")
        .select("id, name, email, phone")
        .eq("id", request.owner_id)
        .single();

      if (ownerError || !owner) {
        logStep(`Owner not found for request ${request.id}`, { ownerId: request.owner_id });
        continue;
      }

      const initialSentAt = new Date(request.initial_sent_at);
      const daysSinceInitial = Math.floor((now.getTime() - initialSentAt.getTime()) / (1000 * 60 * 60 * 24));

      logStep(`Checking reminders for owner ${owner.name}`, { daysSinceInitial });

      let reminderType: string | null = null;
      let reminderColumn: string | null = null;

      // Determine which reminder to send
      if (daysSinceInitial >= REMINDER_SCHEDULE.final_reminder.daysAfter && !request.final_reminder_sent_at) {
        reminderType = 'final_reminder';
        reminderColumn = 'final_reminder_sent_at';
      } else if (daysSinceInitial >= REMINDER_SCHEDULE.reminder_2.daysAfter && !request.reminder_2_sent_at) {
        reminderType = 'benefits_focus';
        reminderColumn = 'reminder_2_sent_at';
      } else if (daysSinceInitial >= REMINDER_SCHEDULE.reminder_1.daysAfter && !request.reminder_1_sent_at) {
        reminderType = 'friendly_checkin';
        reminderColumn = 'reminder_1_sent_at';
      }

      if (!reminderType || !reminderColumn) {
        logStep(`No reminder due for owner ${owner.name}`);
        continue;
      }

      // Get or generate setup URL
      let setupUrl = request.stripe_session_url;
      if (!setupUrl) {
        // Generate a new setup URL if not available
        logStep(`No setup URL for owner ${owner.name}, skipping`);
        continue;
      }

      const firstName = getFirstName(owner.name);
      const smsTemplates = getSmsTemplates(firstName, setupUrl);
      const emailTemplates = getEmailTemplates(firstName, owner.name, setupUrl);

      // Send SMS if phone available
      if (owner.phone && ghlApiKey && ghlLocationId) {
        try {
          const smsMessage = smsTemplates[reminderType as keyof typeof smsTemplates];
          
          // Format phone for GHL
          let formattedPhone = owner.phone.replace(/\D/g, '');
          if (formattedPhone.length === 10) {
            formattedPhone = '+1' + formattedPhone;
          } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
          }

          // Find or create contact in GHL
          const searchResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/search?query=${encodeURIComponent(formattedPhone)}&locationId=${ghlLocationId}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${ghlApiKey}`,
                Version: "2021-07-28",
              },
            }
          );

          const searchData = await searchResponse.json();
          let contactId = searchData.contacts?.[0]?.id;

          if (!contactId) {
            // Create contact
            const createResponse = await fetch(
              "https://services.leadconnectorhq.com/contacts/",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ghlApiKey}`,
                  "Content-Type": "application/json",
                  Version: "2021-07-28",
                },
                body: JSON.stringify({
                  locationId: ghlLocationId,
                  phone: formattedPhone,
                  name: owner.name,
                  email: owner.email,
                }),
              }
            );
            const createData = await createResponse.json();
            contactId = createData.contact?.id;
          }

          if (contactId) {
            await fetch(
              `https://services.leadconnectorhq.com/conversations/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${ghlApiKey}`,
                  "Content-Type": "application/json",
                  Version: "2021-07-28",
                },
                body: JSON.stringify({
                  type: "SMS",
                  contactId,
                  message: smsMessage,
                }),
              }
            );
            logStep(`SMS sent to ${owner.name}`, { type: reminderType });
          }
        } catch (smsError: any) {
          logStep(`Failed to send SMS to ${owner.name}`, { error: smsError.message });
        }
      }

      // Send email if available
      if (owner.email) {
        try {
          const emailTemplate = emailTemplates[reminderType as keyof typeof emailTemplates];
          
          await resend.emails.send({
            from: "PeachHaus <info@peachhausgroup.com>",
            to: [owner.email],
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          });
          logStep(`Email sent to ${owner.name}`, { type: reminderType });
        } catch (emailError: any) {
          logStep(`Failed to send email to ${owner.name}`, { error: emailError.message });
        }
      }

      // Update the reminder sent timestamp
      const updateData: any = {
        [reminderColumn]: now.toISOString(),
        updated_at: now.toISOString(),
      };

      await supabase
        .from("payment_setup_requests")
        .update(updateData)
        .eq("id", request.id);

      remindersSent.push({ ownerId: owner.id, type: reminderType });
    }

    logStep(`Completed. Sent ${remindersSent.length} reminders`);

    return new Response(JSON.stringify({ 
      success: true, 
      remindersSent: remindersSent.length,
      details: remindersSent,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});