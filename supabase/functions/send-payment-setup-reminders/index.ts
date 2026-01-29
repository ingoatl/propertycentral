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

const LOGO_URL = "https://propertycentral.lovable.app/images/peachhaus-logo.png";
const MAX_REMINDERS = 6;

// Calculate days until the 1st of next month
function getDaysUntilNextFirst(): number {
  const now = new Date();
  let nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (now.getDate() === 1) nextFirst = now;
  return Math.ceil((nextFirst.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Calculate days until the 5th of next month (for payouts)
function getDaysUntilNextFifth(): number {
  const now = new Date();
  let nextFifth = new Date(now.getFullYear(), now.getMonth(), 5);
  if (now.getDate() >= 5) {
    nextFifth = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  }
  return Math.ceil((nextFifth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getFirstName(fullName: string | null): string {
  if (!fullName) return '';
  const lowerName = fullName.toLowerCase();
  if (lowerName.includes('unknown')) return '';
  return fullName.split(' ')[0] || '';
}

// CO-HOSTING reminder templates (We CHARGE them)
function getCoHostingEmailTemplates(firstName: string, name: string, setupUrl: string, propertyAddress: string, daysUntilFirst: number) {
  const greeting = firstName || 'there';
  
  return {
    // Day 2 - Friendly Check-in (Social Proof)
    2: {
      subject: 'Quick reminder: Complete your payment setup',
      message: `Just a quick follow-up on setting up your payment method. Most owners complete this in under 2 minutes. Once done, your monthly statements process automatically—no manual steps needed.`,
      urgency: null,
    },
    // Day 3 - Convenience Focus (Loss Aversion)
    3: {
      subject: 'Avoid billing delays - Complete payment setup',
      message: `Having your payment method on file means no delays with your monthly reconciliation. You'll see every charge clearly before it processes—complete transparency, zero surprises.`,
      urgency: null,
    },
    // Day 4 - Commitment
    4: {
      subject: 'Final step: Set up your payment method',
      message: `Now that your management agreement is signed, the final step is setting up payment. This ensures we can process your monthly fees and any approved property expenses seamlessly.`,
      urgency: null,
    },
    // Day 5 - Soft Urgency (Scarcity)
    5: {
      subject: `${daysUntilFirst} days until the 1st - Complete setup now`,
      message: `Just ${daysUntilFirst} days until the 1st. Complete your payment setup now to ensure your first billing cycle goes smoothly. Takes just 2 minutes.`,
      urgency: `⏰ ${daysUntilFirst} days until the 1st`,
    },
    // Day 6 - Final Reminder (Authority)
    6: {
      subject: 'Action required: Payment method needed',
      message: `This is a final reminder. Your payment method is required to continue property management services. Please complete setup today to avoid any service delays.`,
      urgency: '⚠️ Action required today',
    },
  };
}

// FULL-SERVICE reminder templates (We PAY them)
function getFullServiceEmailTemplates(firstName: string, name: string, setupUrl: string, propertyAddress: string, daysUntilFifth: number) {
  const greeting = firstName || 'there';
  
  return {
    // Day 2 - Friendly Check-in (Reciprocity)
    2: {
      subject: 'Your rental earnings are waiting',
      message: `Just following up on setting up your payout account. Once complete, your rental earnings will be deposited directly to your bank on the 5th of each month—completely automatic.`,
      urgency: null,
    },
    // Day 3 - Money Ready (Loss Aversion)
    3: {
      subject: "Don't miss your payout - Set up your bank account",
      message: `We want to make sure you receive your rental income on time. Owner payouts are processed on the 5th of each month. Set up your bank account now so you don't miss your first deposit.`,
      urgency: null,
    },
    // Day 4 - Deadline Approach (Urgency)
    4: {
      subject: `Payout deadline approaching - ${daysUntilFifth} days left`,
      message: `The 5th is approaching. To receive your payout this month, please complete your bank account setup. This is how we'll deposit your net rental earnings after the monthly reconciliation.`,
      urgency: `💰 ${daysUntilFifth} days until payout`,
    },
    // Day 5 - Last Chance (Scarcity)
    5: {
      subject: 'Payouts process on the 5th - Complete setup today',
      message: `Payouts process on the 5th. If your bank account isn't set up by then, your payout will be delayed until next month. Please complete this 2-minute setup today.`,
      urgency: '⏰ Last chance for this month',
    },
    // Day 6 - Final Reminder (Authority)
    6: {
      subject: 'Final reminder: Bank account needed for payout',
      message: `Final reminder: we can't deposit your rental earnings without your bank account on file. This is required for all full-service management clients. Please complete today to avoid payout delays.`,
      urgency: '⚠️ Required for payout',
    },
  };
}

// CO-HOSTING SMS templates
function getCoHostingSmsTemplates(firstName: string, setupUrl: string, daysUntilFirst: number) {
  const greeting = firstName ? `Hi ${firstName}` : 'Hi';
  
  return {
    2: `${greeting}, quick reminder to set up your payment method for monthly billing. Takes 2 min: ${setupUrl} - PeachHaus`,
    4: `${firstName || 'Hi'}, your payment setup is still pending. Complete before the 1st for smooth billing: ${setupUrl} - PeachHaus`,
    6: `Final reminder ${firstName || ''} - payment method needed for continued service. Please complete today: ${setupUrl} - PeachHaus`,
  };
}

// FULL-SERVICE SMS templates
function getFullServiceSmsTemplates(firstName: string, setupUrl: string, daysUntilFifth: number) {
  const greeting = firstName ? `Hi ${firstName}` : 'Hi';
  
  return {
    2: `${greeting}, set up your bank account so we can deposit your rental earnings! Takes 2 min: ${setupUrl} - PeachHaus`,
    4: `${firstName || 'Hi'}, payouts go out on the 5th. Complete your bank setup to receive your earnings: ${setupUrl} - PeachHaus`,
    6: `Final reminder ${firstName || ''} - bank account needed for your payout. Please complete today: ${setupUrl} - PeachHaus`,
  };
}

// Build Fortune 500-style email HTML
function buildReminderEmailHtml(
  firstName: string,
  name: string,
  subject: string,
  message: string,
  setupUrl: string,
  propertyAddress: string,
  serviceType: 'cohosting' | 'full_service',
  reminderDay: number,
  urgencyText: string | null
): string {
  const isCoHosting = serviceType === 'cohosting';
  const ctaText = isCoHosting ? 'Set Up Payment Method' : 'Set Up Payout Account';
  const purposeTitle = isCoHosting ? 'Management Fees & Expenses' : 'Monthly Rental Payouts';
  const purposeDescription = isCoHosting 
    ? 'For any management fees or approved property expenses. You\'ll see every charge before it posts.'
    : 'We deposit your net rental earnings on the 5th of each month, following monthly reconciliation.';
  
  const paymentOptions = isCoHosting ? `
    <table style="width: 100%; margin-top: 16px;">
      <tr>
        <td style="padding: 12px 16px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; margin-bottom: 8px;">
          <div style="font-weight: 700; color: #166534; font-size: 14px;">US Bank Account (ACH)</div>
          <div style="font-size: 12px; color: #374151; margin-top: 2px;"><strong>1% processing fee</strong> - Recommended</div>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="font-weight: 600; color: #374151; font-size: 14px;">Credit/Debit Card</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">3% processing fee</div>
        </td>
      </tr>
    </table>
  ` : `
    <table style="width: 100%; margin-top: 16px;">
      <tr>
        <td style="padding: 12px 16px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px;">
          <div style="font-weight: 700; color: #166534; font-size: 14px;">US Bank Account (ACH)</div>
          <div style="font-size: 12px; color: #166534; margin-top: 2px;"><strong>No fees for payouts</strong></div>
        </td>
      </tr>
    </table>
  `;

  const urgencyBanner = urgencyText ? `
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <div style="font-size: 14px; color: #92400e; font-weight: 600;">${urgencyText}</div>
    </div>
  ` : '';

  const reminderBadge = `REMINDER ${reminderDay - 1} OF 5`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px;" />
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 12px; background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; border-radius: 20px; font-size: 11px; font-weight: 700; color: #fbbf24; letter-spacing: 0.5px;">
                      ${reminderBadge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Property Info Bar -->
          ${propertyAddress ? `
          <tr>
            <td style="background: #f8fafc; padding: 12px 32px; border-bottom: 1px solid #e5e7eb;">
              <span style="font-size: 12px; color: #6b7280;">Property: </span>
              <span style="font-size: 12px; font-weight: 600; color: #111827;">${propertyAddress}</span>
            </td>
          </tr>
          ` : ''}
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <!-- Urgency Banner -->
              ${urgencyBanner}
              
              <!-- Greeting -->
              <div style="font-size: 16px; color: #111827; margin-bottom: 20px;">
                Hi <strong>${firstName || 'there'}</strong>,
              </div>
              
              <!-- Main Message -->
              <div style="font-size: 15px; color: #374151; line-height: 1.7; margin-bottom: 24px;">
                ${message}
              </div>
              
              <!-- Purpose Box -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #86efac;">
                <div style="font-size: 11px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 8px;">
                  ${isCoHosting ? '💳 Payment Method For' : '💰 Payout Account For'}
                </div>
                <div style="font-size: 15px; font-weight: 700; color: #166534; margin-bottom: 4px;">${purposeTitle}</div>
                <div style="font-size: 13px; color: #15803d; line-height: 1.5;">${purposeDescription}</div>
              </div>
              
              <!-- Payment Options -->
              ${paymentOptions}
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${setupUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
                  ${ctaText} →
                </a>
              </div>
              
              <!-- Security Note -->
              <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 24px;">
                <div style="font-size: 13px; color: #475569; line-height: 1.6;">
                  <strong>🔒 Secure & Encrypted</strong><br>
                  We use Stripe, trusted by millions of businesses. Your information is never stored on our servers.
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: top; padding-right: 16px;">
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png" alt="Ingo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover;" />
                  </td>
                  <td style="vertical-align: top; border-left: 3px solid #f59e0b; padding-left: 12px;">
                    <div style="font-weight: 700; font-size: 14px; color: #111827;">Ingo Schaer</div>
                    <div style="font-size: 12px; color: #6b7280;">Co-Founder, Operations Manager</div>
                    <div style="font-size: 12px; margin-top: 4px;">
                      <a href="tel:+14048005932" style="color: #111827; text-decoration: none;">(404) 800-5932</a> · 
                      <a href="mailto:ingo@peachhausgroup.com" style="color: #2563eb; text-decoration: none;">ingo@peachhausgroup.com</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 11px; color: #9ca3af;">
                © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting daily payment setup reminders check");

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

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const daysUntilFirst = getDaysUntilNextFirst();
    const daysUntilFifth = getDaysUntilNextFifth();

    logStep("Date context", { today, daysUntilFirst, daysUntilFifth });

    // Fetch all pending payment setup requests
    const { data: pendingRequests, error: fetchError } = await supabase
      .from("payment_setup_requests")
      .select(`
        id,
        owner_id,
        initial_sent_at,
        last_reminder_sent_at,
        reminder_count,
        service_type,
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

    const remindersSent: { ownerId: string; reminderDay: number; serviceType: string }[] = [];

    for (const request of pendingRequests) {
      try {
        // Get owner details with property info
        const { data: owner, error: ownerError } = await supabase
          .from("property_owners")
          .select("id, name, email, phone, stripe_customer_id, has_payment_method, service_type")
          .eq("id", request.owner_id)
          .single();

        if (ownerError || !owner) {
          logStep(`Owner not found for request ${request.id}`, { ownerId: request.owner_id });
          continue;
        }

        // Skip owners who already have a payment method
        if (owner.has_payment_method === true) {
          logStep(`Skipping ${owner.name} - has payment method, marking completed`);
          await supabase
            .from("payment_setup_requests")
            .update({
              status: "completed",
              completed_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", request.id);
          continue;
        }

        // Get property address for context
        const { data: properties } = await supabase
          .from("properties")
          .select("address, name")
          .eq("owner_id", request.owner_id)
          .limit(1);
        
        const propertyAddress = properties?.[0]?.address || properties?.[0]?.name || '';

        // Determine service type (from request, owner, or default to cohosting)
        const serviceType = (request.service_type || owner.service_type || 'cohosting') as 'cohosting' | 'full_service';

        // Check if already sent today
        const lastSentDate = request.last_reminder_sent_at 
          ? new Date(request.last_reminder_sent_at).toISOString().split('T')[0]
          : null;
        
        if (lastSentDate === today) {
          logStep(`Already sent reminder today for ${owner.name}`);
          continue;
        }

        // Calculate reminder day (1 = initial, 2-6 = follow-ups)
        const currentReminderCount = request.reminder_count || 0;
        const nextReminderDay = currentReminderCount + 2; // +2 because day 1 was the initial email

        if (nextReminderDay > MAX_REMINDERS) {
          logStep(`Max reminders reached for ${owner.name}`);
          continue;
        }

        // Get setup URL
        let setupUrl = request.stripe_session_url;
        if (!setupUrl) {
          setupUrl = `https://propertycentral.lovable.app/owner-payment-setup?owner=${request.owner_id}`;
        }

        const firstName = getFirstName(owner.name);

        // Get the appropriate templates
        const isCoHosting = serviceType === 'cohosting';
        const emailTemplates = isCoHosting 
          ? getCoHostingEmailTemplates(firstName, owner.name, setupUrl, propertyAddress, daysUntilFirst)
          : getFullServiceEmailTemplates(firstName, owner.name, setupUrl, propertyAddress, daysUntilFifth);
        
        const smsTemplates = isCoHosting
          ? getCoHostingSmsTemplates(firstName, setupUrl, daysUntilFirst)
          : getFullServiceSmsTemplates(firstName, setupUrl, daysUntilFifth);

        const emailTemplate = emailTemplates[nextReminderDay as keyof typeof emailTemplates];
        
        if (!emailTemplate) {
          logStep(`No template for day ${nextReminderDay} for ${owner.name}`);
          continue;
        }

        logStep(`Sending reminder day ${nextReminderDay} to ${owner.name}`, { 
          serviceType, 
          email: owner.email,
          phone: owner.phone 
        });

        // Send email if available
        if (owner.email) {
          try {
            const emailHtml = buildReminderEmailHtml(
              firstName,
              owner.name,
              emailTemplate.subject,
              emailTemplate.message,
              setupUrl,
              propertyAddress,
              serviceType,
              nextReminderDay,
              emailTemplate.urgency
            );

            await resend.emails.send({
              from: "PeachHaus <info@peachhausgroup.com>",
              to: [owner.email],
              subject: emailTemplate.subject,
              html: emailHtml,
            });
            logStep(`Email sent to ${owner.name}`, { day: nextReminderDay });
          } catch (emailError: any) {
            logStep(`Failed to send email to ${owner.name}`, { error: emailError.message });
          }
        }

        // Send SMS if available and it's a reminder day with SMS (2, 4, 6)
        const smsMessage = smsTemplates[nextReminderDay as keyof typeof smsTemplates];
        if (owner.phone && ghlApiKey && ghlLocationId && smsMessage) {
          try {
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
              logStep(`SMS sent to ${owner.name}`, { day: nextReminderDay });
            }
          } catch (smsError: any) {
            logStep(`Failed to send SMS to ${owner.name}`, { error: smsError.message });
          }
        }

        // Update the request with new reminder count and timestamp
        await supabase
          .from("payment_setup_requests")
          .update({
            last_reminder_sent_at: now.toISOString(),
            reminder_count: currentReminderCount + 1,
            service_type: serviceType,
            updated_at: now.toISOString(),
          })
          .eq("id", request.id);

        remindersSent.push({ 
          ownerId: owner.id, 
          reminderDay: nextReminderDay, 
          serviceType 
        });
      } catch (requestError: any) {
        logStep(`Error processing request ${request.id}`, { error: requestError.message });
      }
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
