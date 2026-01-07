import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

// Beautiful HTML email template builder (styled like owner statement emails)
function buildBrandedEmailHtml(
  recipientName: string,
  subject: string,
  sections: Array<{ title?: string; content?: string; highlight?: boolean; warning?: boolean; cta?: { text: string; url: string } }>
): string {
  const sectionHtml = sections.map(section => {
    if (section.cta) {
      return `
        <div style="padding: 24px 0; text-align: center;">
          <a href="${section.cta.url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
            ${section.cta.text}
          </a>
        </div>
      `;
    }
    
    if (section.warning) {
      return `
        <div style="margin: 20px 0; padding: 16px 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
          <div style="font-size: 14px; color: #92400e; font-weight: 600;">⚠️ ${section.content}</div>
        </div>
      `;
    }
    
    if (section.highlight) {
      return `
        <div style="margin: 20px 0; padding: 20px 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px;">
          ${section.title ? `<div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">${section.title}</div>` : ''}
          <div style="font-size: 14px; color: #166534; line-height: 1.6;">${section.content}</div>
        </div>
      `;
    }
    
    return `
      <div style="margin: 20px 0;">
        ${section.title ? `
          <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
            <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">${section.title}</span>
          </div>
        ` : ''}
        <div style="font-size: 14px; color: #374151; line-height: 1.7;">${section.content}</div>
      </div>
    `;
  }).join('');

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
                <td style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 32px; text-align: center;">
                  <img src="${LOGO_URL}" alt="PeachHaus" style="height: 48px; margin-bottom: 16px;" />
                  <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${subject}</div>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 32px 32px 16px 32px;">
                  <div style="font-size: 16px; color: #111827;">Hi <strong>${recipientName}</strong>,</div>
                </td>
              </tr>
              
              <!-- Content Sections -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  ${sectionHtml}
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
                        <div style="font-size: 12px; color: #111827; margin-top: 4px;">PeachHaus Group LLC</div>
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

// Build insurance verification email HTML
function buildInsuranceEmailHtml(recipientName: string): string {
  return buildBrandedEmailHtml(recipientName, "Insurance Verification Required", [
    {
      content: "As part of onboarding, we need to confirm that your property has the correct insurance in place."
    },
    {
      title: "⚠️ Why This Matters",
      content: `
        <p style="margin: 0 0 12px 0;">Standard homeowner's insurance <strong>does not cover</strong> short-term or mid-term rentals. Once paying guests are involved (even stays longer than 30 days), claims for damage or liability are often denied.</p>
        <p style="margin: 0 0 12px 0;">STR/MTR-specific insurance protects both you and PeachHaus Group from risks like property damage, liability claims, and guest-related incidents.</p>
        <p style="margin: 0;">Listing <strong>PeachHaus Group LLC as an Additional Insured</strong> extends coverage to us as your management partner, protecting both parties if a claim arises from guest activity.</p>
      `
    },
    {
      title: "💡 Already Have Coverage?",
      content: "Some insurance providers like <strong>State Farm</strong> may already cover stays of 30+ days under your existing policy. Check with your provider first!",
      highlight: true
    },
    {
      title: "📋 Here's What We Need",
      content: `
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">✓ A copy of your current insurance policy for our records</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">✓ Proof of STR/MTR-specific coverage (if you already have it, great — if not, see below)</td></tr>
          <tr><td style="padding: 8px 0;">✓ Confirmation that <strong>PeachHaus Group LLC</strong> has been added as an Additional Insured</td></tr>
        </table>
      `
    },
    {
      title: "🏠 Need STR Insurance?",
      content: "We've negotiated <strong>special rates</strong> with Steadily, a leading provider of short/mid-term rental insurance.",
      highlight: true
    },
    {
      cta: { text: "Get Your Steadily Quote →", url: "https://phg.steadilypartner.com/" }
    },
    {
      warning: true,
      content: "Your property cannot go live until insurance verification is completed."
    },
    {
      content: "Please reply to this email with your insurance documents attached.<br><br>Thank you for your attention to this matter."
    }
  ]);
}

// Build onboarding form email HTML
function buildOnboardingEmailHtml(recipientName: string): string {
  return buildBrandedEmailHtml(recipientName, "Complete Your Property Onboarding", [
    {
      content: "We're ready to capture your property details and lock in the next steps. Please complete the onboarding form below."
    },
    {
      title: "📋 Choose Your Form",
      content: `
        <table style="width: 100%;">
          <tr>
            <td style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-bottom: 12px;">
              <div style="font-weight: 700; color: #166534; margin-bottom: 4px;">Existing STR Properties</div>
              <div style="font-size: 13px; color: #374151; margin-bottom: 8px;">Already furnished and listed on Airbnb/VRBO</div>
              <a href="https://propertycentral.lovable.app/onboard/existing-str" style="display: inline-block; padding: 10px 20px; background: #166534; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Complete Existing STR Form →</a>
            </td>
          </tr>
          <tr><td style="height: 12px;"></td></tr>
          <tr>
            <td style="padding: 16px; background: #eff6ff; border-radius: 8px;">
              <div style="font-weight: 700; color: #1e40af; margin-bottom: 4px;">New STR Properties</div>
              <div style="font-size: 13px; color: #374151; margin-bottom: 8px;">New setup, not yet listed or fully furnished</div>
              <a href="https://propertycentral.lovable.app/onboard/new-str" style="display: inline-block; padding: 10px 20px; background: #1e40af; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Complete New STR Form →</a>
            </td>
          </tr>
        </table>
      `
    },
    {
      warning: true,
      content: "Please fill out every field precisely. Accurate data ensures smooth setup."
    },
    {
      title: "Why Accuracy Matters",
      content: `
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;">Ensures smooth PMS setup, pricing automation, and guest-ready configuration</li>
          <li style="margin-bottom: 8px;">Prevents delays with utilities, smart locks, cleaner assignments, etc.</li>
          <li>Taking time now prevents headaches later — for both you and our operations team</li>
        </ul>
      `
    },
    {
      content: "Once submitted, we'll update your opportunity checklist and move to the next onboarding phase.<br><br>Thanks for partnering with PeachHaus — together, we'll make this property perform at its best."
    }
  ]);
}

// Build CO-HOSTING payment email - We CHARGE them (ACH 1% or Card 3%)
function buildCoHostingPaymentEmailHtml(recipientName: string, stripeUrl: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Set Up Your Payment Method", [
    {
      content: "Congratulations on signing your co-hosting agreement with PeachHaus Group LLC! 🎉"
    },
    {
      title: "📋 This Will Be Used For",
      highlight: true,
      content: `<strong>Property Expenses & Management Fees</strong><br>For any management fees or property expenses when needed${propertyAddress ? ` for <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "💳 Choose Your Payment Method",
      content: `
        <table style="width: 100%;">
          <tr>
            <td style="padding: 16px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; margin-bottom: 8px;">
              <div style="font-weight: 700; color: #166534; font-size: 15px;">🏦 US Bank Account (ACH)</div>
              <div style="font-size: 13px; color: #374151; margin-top: 4px;"><strong>1% processing fee</strong> — Recommended</div>
            </td>
          </tr>
          <tr><td style="height: 8px;"></td></tr>
          <tr>
            <td style="padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
              <div style="font-weight: 600; color: #374151;">💳 Credit/Debit Card</div>
              <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">3% processing fee</div>
            </td>
          </tr>
        </table>
      `
    },
    {
      cta: { text: "Set Up Payment Method →", url: stripeUrl }
    },
    {
      highlight: true,
      content: "🔒 <strong>Secure & Encrypted</strong><br>We use Stripe, the industry leader in payment security. Your information is never stored on our servers."
    },
    {
      warning: true,
      content: "This secure link expires in 24 hours. If it expires, contact us and we'll send a new one."
    },
    {
      content: "If you have any questions, just reply to this email.<br><br>Thank you for choosing PeachHaus!"
    }
  ]);
}

// Build FULL-SERVICE payment email - We PAY them (ACH only, no fees)
function buildFullServicePaymentEmailHtml(recipientName: string, stripeUrl: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Set Up Your Payout Account", [
    {
      content: "Congratulations on signing your property management agreement with PeachHaus Group LLC! 🎉"
    },
    {
      title: "📋 This Will Be Used For",
      highlight: true,
      content: `<strong>✓ Receiving Rental Income</strong><br>We'll deposit your rental earnings directly to your account${propertyAddress ? ` from <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "🏦 Payout Method",
      content: `
        <table style="width: 100%;">
          <tr>
            <td style="padding: 16px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px;">
              <div style="font-weight: 700; color: #166534; font-size: 15px;">🏦 US Bank Account (ACH)</div>
              <div style="font-size: 13px; color: #166534; margin-top: 4px;"><strong>No processing fees</strong></div>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #6b7280; margin-top: 12px; font-style: italic;">Note: Only bank accounts are supported for receiving rental income deposits.</p>
      `
    },
    {
      cta: { text: "Set Up Payout Account →", url: stripeUrl }
    },
    {
      highlight: true,
      content: "🔒 <strong>Secure & Encrypted</strong><br>We use Stripe, the industry leader in payment security. Your information is never stored on our servers."
    },
    {
      warning: true,
      content: "This secure link expires in 24 hours. If it expires, contact us and we'll send a new one."
    },
    {
      content: "If you have any questions, just reply to this email.<br><br>Thank you for choosing PeachHaus!"
    }
  ]);
}

// Build welcome email for new leads
function buildWelcomeEmailHtml(recipientName: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Welcome to PeachHaus", [
    {
      content: `Thank you for your interest in PeachHaus property management! We're excited to learn more about your property${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "🏆 Why Owners Choose Us",
      content: `
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">✓ Average <strong>23% higher</strong> rental income vs. self-managed</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">✓ <strong>4.9★ rating</strong> from property owners</td></tr>
          <tr><td style="padding: 8px 0;">✓ Full-service management with <strong>transparent reporting</strong></td></tr>
        </table>
      `
    },
    {
      highlight: true,
      content: "I'd love to schedule a quick discovery call to discuss your goals and how we can maximize your rental income. What time works best for you?"
    },
    {
      content: "Looking forward to connecting!"
    }
  ]);
}

// Build follow-up email for unreached leads
function buildFollowUpEmailHtml(recipientName: string): string {
  return buildBrandedEmailHtml(recipientName, "Quick Follow-Up", [
    {
      content: "I wanted to follow up on your property management inquiry."
    },
    {
      warning: true,
      content: "We currently have <strong>limited availability</strong> for new properties this month."
    },
    {
      content: "Would you like to schedule a quick call to discuss how we can help maximize your rental income?"
    },
    {
      cta: { text: "Schedule a Call →", url: "https://peachhausgroup.com/discovery-call" }
    }
  ]);
}

// Build call scheduled confirmation email
function buildCallScheduledEmailHtml(recipientName: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Your Discovery Call is Confirmed", [
    {
      content: `I'm looking forward to our upcoming conversation about your property${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "📝 To Prepare, It Would Be Helpful To Know",
      content: `
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;">Your current rental situation (if any)</li>
          <li style="margin-bottom: 8px;">Your goals for the property</li>
          <li>Any specific concerns or questions</li>
        </ul>
      `
    },
    {
      highlight: true,
      content: "This helps me provide the most relevant information for your situation."
    },
    {
      content: "Talk soon!"
    }
  ]);
}

// Build post-call email
function buildCallAttendedEmailHtml(recipientName: string, propertyAddress: string, aiSummary: string): string {
  return buildBrandedEmailHtml(recipientName, "Next Steps After Our Conversation", [
    {
      content: `Thank you for the great conversation today! Based on what we discussed, I'm confident PeachHaus is the right partner for your property${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "📋 Key Points We Covered",
      content: aiSummary || "We discussed your property management needs and goals."
    },
    {
      title: "🚀 Next Steps",
      content: `
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">1️⃣ Review the management agreement (coming shortly)</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">2️⃣ Sign when ready</td></tr>
          <tr><td style="padding: 8px 0;">3️⃣ We'll begin our onboarding process</td></tr>
        </table>
      `
    },
    {
      content: "Let me know if you have any questions!"
    }
  ]);
}

// Build contract out email
function buildContractOutEmailHtml(recipientName: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Your Management Agreement is Ready", [
    {
      content: `Your management agreement${propertyAddress ? ` for <strong>${propertyAddress}</strong>` : ''} is ready for review and signature.`
    },
    {
      title: "🚀 What Happens After Signing",
      content: `
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">1️⃣ You'll set up ACH for easy revenue deposits</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">2️⃣ We'll collect property details and access info</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">3️⃣ Professional photos and listing optimization</td></tr>
          <tr><td style="padding: 8px 0;">4️⃣ You start earning within 2-3 weeks</td></tr>
        </table>
      `
    },
    {
      highlight: true,
      content: "The agreement is straightforward — let me know if anything needs clarification."
    },
    {
      content: "Ready when you are!"
    }
  ]);
}

// Build ops handoff email
function buildOpsHandoffEmailHtml(recipientName: string): string {
  return buildBrandedEmailHtml(recipientName, "Your Property is in Good Hands", [
    {
      content: "Great news — your onboarding is complete and your property is now with our operations team!"
    },
    {
      title: "🚀 What's Happening Next",
      content: `
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">1️⃣ Our ops coordinator will contact you within 24-48 hours</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">2️⃣ We'll schedule property access and professional photography</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">3️⃣ Listing optimization and publishing</td></tr>
          <tr><td style="padding: 8px 0;">4️⃣ You'll start receiving booking notifications!</td></tr>
        </table>
      `
    },
    {
      highlight: true,
      content: "Thank you for completing everything so quickly. We can't wait to get you earning!"
    }
  ]);
}

// Psychology-driven message templates by stage (Cialdini principles + SPIN)
const STAGE_PSYCHOLOGY_TEMPLATES: Record<string, { sms?: string; email_subject?: string; email_body?: string; principle: string }> = {
  new_lead: {
    sms: "Hi {{name}}! This is {{sender}} from PeachHaus. Thanks for reaching out about property management. I've got some market insights for {{property_address}} I'd love to share. What time works for a quick call?",
    email_subject: "Welcome to PeachHaus - Your Property Management Partner",
    email_body: `WELCOME_HTML_TEMPLATE`,
    principle: "Reciprocity + Social Proof"
  },
  unreached: {
    sms: "Hi {{name}}, just following up on property management for your rental. We have 2 onboarding spots open this month - still interested? Reply YES and I'll share next steps.",
    email_subject: "Quick follow-up on your property",
    email_body: `FOLLOW_UP_HTML_TEMPLATE`,
    principle: "Scarcity + Urgency"
  },
  call_scheduled: {
    sms: "Looking forward to our call, {{name}}! I'll be calling you at the scheduled time. Feel free to text if anything changes.",
    email_subject: "Confirming Our Discovery Call",
    email_body: `CALL_SCHEDULED_HTML_TEMPLATE`,
    principle: "Commitment + Preparation"
  },
  call_attended: {
    sms: "Great speaking with you, {{name}}! As discussed, I'm preparing a management proposal for {{property_address}}. You'll receive it shortly.",
    email_subject: "Next Steps After Our Conversation",
    email_body: `CALL_ATTENDED_HTML_TEMPLATE`,
    principle: "Commitment + Consistency"
  },
  contract_out: {
    sms: "Hi {{name}}, your PeachHaus management agreement is ready for signature. Let me know if you have any questions!",
    email_subject: "Your Management Agreement is Ready",
    email_body: `CONTRACT_OUT_HTML_TEMPLATE`,
    principle: "Clarity + Momentum"
  },
  contract_signed: {
    sms: "Welcome to PeachHaus, {{name}}! 🎉 Your agreement is signed. Check your email for a secure link to set up your payment details.",
    email_subject: "Set Up Your Payment Method - PeachHaus",
    email_body: `PAYMENT_HTML_TEMPLATE`,
    principle: "Celebration + Momentum"
  },
  ach_form_signed: {
    sms: "Hi {{name}}! Your payment is set up. Please complete your property onboarding form - check your email for the link. This is the final step before we can start marketing your property!",
    email_subject: "Complete Your Property Onboarding - PeachHaus",
    email_body: `ONBOARDING_HTML_TEMPLATE`,
    principle: "Progress + Clear Instructions"
  },
  insurance_requested: {
    sms: "Hi {{name}}! Important: We need your STR insurance info before your property can go live. Check your email for details. Questions? Just reply!",
    email_subject: "Insurance Verification Required - PeachHaus",
    email_body: `INSURANCE_HTML_TEMPLATE`,
    principle: "Compliance + Partnership"
  },
  ops_handoff: {
    sms: "{{name}}, your property is now with our operations team! They'll reach out shortly to schedule access and photos. Exciting times ahead!",
    email_subject: "Your Property is in Good Hands",
    email_body: `OPS_HANDOFF_HTML_TEMPLATE`,
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

// Reset DND settings for a GHL contact before sending SMS
async function resetGhlContactDnd(contactId: string, ghlApiKey: string): Promise<void> {
  try {
    console.log(`Resetting DND for GHL contact ${contactId}`);
    const dndResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dndSettings: {
            SMS: { status: "inactive", message: "" },
            Call: { status: "inactive", message: "" },
          },
        }),
      }
    );
    const dndText = await dndResponse.text();
    console.log(`GHL DND reset response: ${dndResponse.status} - ${dndText.substring(0, 200)}`);
  } catch (dndError) {
    console.error("Failed to reset DND:", dndError);
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
          // Property Central onboarding URLs
          const siteUrl = "https://propertycentral.lovable.app";
          const existingStrOnboardingUrl = `${siteUrl}/owner-onboarding`;
          const newStrOnboardingUrl = `${siteUrl}/new-str-onboarding`;
          // Stripe payment setup URL
          const stripePaymentUrl = `${siteUrl}/payment-setup?lead=${leadId}`;
          
          return template
            .replace(/\{\{name\}\}/g, lead.name?.split(' ')[0] || lead.name || "") // First name only
            .replace(/\{\{full_name\}\}/g, lead.name || "")
            .replace(/\{\{email\}\}/g, lead.email || "")
            .replace(/\{\{phone\}\}/g, lead.phone || "")
            .replace(/\{\{property_address\}\}/g, lead.property_address || "your property")
            .replace(/\{\{property_type\}\}/g, lead.property_type || "property")
            .replace(/\{\{opportunity_value\}\}/g, lead.opportunity_value?.toString() || "0")
            .replace(/\{\{ach_link\}\}/g, stripePaymentUrl)
            .replace(/\{\{payment_link\}\}/g, stripePaymentUrl)
            .replace(/\{\{stripe_link\}\}/g, stripePaymentUrl)
            .replace(/\{\{onboarding_link\}\}/g, existingStrOnboardingUrl)
            .replace(/\{\{existing_str_onboarding\}\}/g, existingStrOnboardingUrl)
            .replace(/\{\{new_str_onboarding\}\}/g, newStrOnboardingUrl)
            .replace(/\{\{sender\}\}/g, "Ingo")
            .replace(/\{\{ai_call_summary\}\}/g, lead.ai_summary || "We discussed your property management needs and goals.")
            .replace(/\{\{ai_next_action\}\}/g, lead.ai_next_action || "Review and sign the management agreement")
            .replace(/\\n/g, "\n"); // Convert escaped newlines to actual newlines
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
          // Send SMS via GoHighLevel (preferred) with fallback to Telnyx/Twilio
          const ghlApiKey = Deno.env.get("GHL_API_KEY");
          const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
          
          let smsSent = false;
          let externalId = "";
          let errorMessage = "";
          let provider = "";

          // Format destination phone to E.164
          const formattedPhone = formatPhoneE164(lead.phone);
          console.log(`Sending SMS to ${formattedPhone} (original: ${lead.phone})`);

          // Try GoHighLevel first (preferred for 404-800-5932 number)
          if (ghlApiKey && ghlLocationId) {
            try {
              const fromPhone = "+14048005932"; // 404-800-5932
              console.log(`Sending SMS via GHL from: ${fromPhone} to: ${formattedPhone}`);
              
              // Use upsert endpoint to find or create contact in one call
              const upsertResponse = await fetch(
                `https://services.leadconnectorhq.com/contacts/upsert`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${ghlApiKey}`,
                    "Version": "2021-07-28",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    locationId: ghlLocationId,
                    phone: formattedPhone,
                    name: lead.name || "Lead",
                    email: lead.email || undefined,
                    source: "PropertyCentral",
                  }),
                }
              );

              const upsertText = await upsertResponse.text();
              console.log(`GHL upsert response: ${upsertResponse.status} - ${upsertText}`);
              
              let contactId = null;
              if (upsertResponse.ok) {
                try {
                  const upsertData = JSON.parse(upsertText);
                  contactId = upsertData.contact?.id;
                  console.log(`GHL contact ID: ${contactId}`);
                } catch (e) {
                  console.error(`Failed to parse GHL upsert response: ${e}`);
                }
              }

              if (contactId) {
                // Reset DND before sending SMS to prevent blocking
                await resetGhlContactDnd(contactId, ghlApiKey);

                // Send SMS message via GHL
                const sendResponse = await fetch(
                  `https://services.leadconnectorhq.com/conversations/messages`,
                  {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${ghlApiKey}`,
                      "Version": "2021-04-15",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      type: "SMS",
                      contactId: contactId,
                      message: messageBody,
                    }),
                  }
                );

                const sendText = await sendResponse.text();
                console.log(`GHL send SMS response: ${sendResponse.status} - ${sendText}`);
                
                if (sendResponse.ok) {
                  try {
                    const sendData = JSON.parse(sendText);
                    smsSent = true;
                    externalId = sendData.messageId || sendData.conversationId || "";
                    provider = "gohighlevel";
                    console.log(`SMS sent via GHL. Message ID: ${externalId}`);
                  } catch (e) {
                    console.error(`Failed to parse GHL send response: ${e}`);
                  }
                } else {
                  console.error("GHL SMS send error:", sendText);
                  errorMessage = sendText;
                }
              } else {
                console.error("Failed to get GHL contact ID from upsert");
                errorMessage = "No GHL contact ID from upsert";
              }
            } catch (e) {
              console.error("GHL SMS error:", e);
              errorMessage = e instanceof Error ? e.message : String(e);
            }
          } else {
            console.log("GHL credentials not configured, skipping GHL SMS");
          }

          // Fallback to Telnyx if GHL failed
          if (!smsSent) {
            const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
            if (telnyxApiKey) {
              try {
                const fromPhone = formatPhoneE164(Deno.env.get("TELNYX_PHONE_NUMBER") || "+14049247251");
                console.log(`Fallback to Telnyx from phone: ${fromPhone}`);
                
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
                provider = "telnyx";
                if (!smsSent) errorMessage = JSON.stringify(telnyxResult.errors || telnyxResult);
              } catch (e) {
                console.error("Telnyx SMS error:", e);
              }
            }
          }
          
          // Final fallback to Twilio
          if (!smsSent) {
            const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
            const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
            if (twilioAccountSid && twilioAuthToken) {
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
              provider = "twilio";
              if (!smsSent) errorMessage = twilioResult.error_message || "";
            }
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
            metadata: { provider, from_number: provider === "gohighlevel" ? "+14048005932" : undefined },
          });

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: leadId,
            action: `Automated SMS sent via ${provider || 'unknown'}: "${automation.name}"`,
            metadata: { 
              automation_id: automation.id, 
              message_id: externalId,
              provider,
              psychology_principle: psychologyTemplate?.principle,
              ai_personalized: automation.ai_enabled
            },
          });

          console.log(`SMS ${smsSent ? 'sent' : 'failed'} via ${provider} for automation "${automation.name}"`);
          
          
        } else if (automation.action_type === "email" && lead.email && messageBody) {
          // Send email via Resend
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          
          if (resendApiKey) {
            const recipientFirstName = lead.name?.split(' ')[0] || lead.name || "there";
            
            // Use branded HTML templates for ALL stages
            let finalHtmlBody: string;
            
            // Special handling for contract_signed - create Stripe checkout session based on service type
            if (newStage === 'contract_signed') {
              // Fetch owner service type to determine if co-hosting or full-service
              let serviceType = 'cohosting'; // Default to co-hosting
              if (lead.owner_id) {
                const { data: owner } = await supabase
                  .from("property_owners")
                  .select("service_type")
                  .eq("id", lead.owner_id)
                  .single();
                if (owner?.service_type) {
                  serviceType = owner.service_type;
                }
              }
              console.log(`Lead ${leadId} service type: ${serviceType}`);
              
              const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
              if (stripeKey) {
                try {
                  console.log(`Creating Stripe checkout session for lead ${leadId} (${serviceType})`);
                  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
                  
                  // Find or create Stripe customer
                  const customers = await stripe.customers.list({ email: lead.email, limit: 1 });
                  let customerId = customers.data[0]?.id;
                  
                  if (!customerId) {
                    console.log(`Creating new Stripe customer for ${lead.email}`);
                    const customer = await stripe.customers.create({
                      email: lead.email,
                      name: lead.name || undefined,
                      metadata: { lead_id: leadId, service_type: serviceType }
                    });
                    customerId = customer.id;
                  }
                  console.log(`Using Stripe customer: ${customerId}`);
                  
                  // Create checkout session based on service type
                  const siteUrl = "https://propertycentral.lovable.app";
                  
                  // Co-hosting: Allow both ACH (1%) and Card (3%) for charging owner
                  // Full-service: Only ACH (no fees) for paying owner rental income
                  const paymentMethodTypes = serviceType === 'full_service' 
                    ? ["us_bank_account" as const]  // Only ACH for receiving payouts
                    : ["us_bank_account" as const, "card" as const];  // Both for being charged
                  
                  const session = await stripe.checkout.sessions.create({
                    customer: customerId,
                    mode: "setup",
                    currency: "usd",
                    payment_method_types: paymentMethodTypes,
                    payment_method_options: {
                      us_bank_account: {
                        financial_connections: { permissions: ["payment_method"] }
                      }
                    },
                    success_url: `${siteUrl}/payment-success?lead=${leadId}&session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${siteUrl}/payment-setup?lead=${leadId}&canceled=true`,
                    metadata: { lead_id: leadId, type: "lead_payment_setup", service_type: serviceType }
                  });
                  console.log(`Stripe checkout session created: ${session.id}, URL: ${session.url}`);
                  
                  // Update lead with Stripe info
                  await supabase.from("leads").update({
                    stripe_customer_id: customerId,
                    stripe_setup_intent_id: session.id,
                    last_contacted_at: new Date().toISOString()
                  }).eq("id", leadId);
                  
                  // Build appropriate branded payment email based on service type
                  if (serviceType === 'full_service') {
                    finalHtmlBody = buildFullServicePaymentEmailHtml(
                      recipientFirstName,
                      session.url!,
                      lead.property_address || ""
                    );
                    emailSubject = "Set Up Your Payout Account - PeachHaus";
                  } else {
                    finalHtmlBody = buildCoHostingPaymentEmailHtml(
                      recipientFirstName,
                      session.url!,
                      lead.property_address || ""
                    );
                    emailSubject = "Set Up Your Payment Method - PeachHaus";
                  }
                  
                  // Add timeline entry for Stripe session
                  await supabase.from("lead_timeline").insert({
                    lead_id: leadId,
                    action: `Stripe payment setup session created (${serviceType})`,
                    metadata: { 
                      stripe_session_id: session.id,
                      stripe_customer_id: customerId,
                      service_type: serviceType,
                      payment_methods: paymentMethodTypes
                    }
                  });
                  
                } catch (stripeError) {
                  console.error("Stripe session creation failed:", stripeError);
                  // Fallback to static link if Stripe fails
                  const fallbackUrl = `https://propertycentral.lovable.app/payment-setup?lead=${leadId}`;
                  if (serviceType === 'full_service') {
                    finalHtmlBody = buildFullServicePaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "");
                    emailSubject = "Set Up Your Payout Account - PeachHaus";
                  } else {
                    finalHtmlBody = buildCoHostingPaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "");
                    emailSubject = "Set Up Your Payment Method - PeachHaus";
                  }
                }
              } else {
                console.log("STRIPE_SECRET_KEY not configured, using fallback URL");
                const fallbackUrl = `https://propertycentral.lovable.app/payment-setup?lead=${leadId}`;
                finalHtmlBody = buildCoHostingPaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "");
                emailSubject = "Set Up Your Payment Method - PeachHaus";
              }
            } else if (newStage === 'insurance_requested') {
              finalHtmlBody = buildInsuranceEmailHtml(recipientFirstName);
            } else if (newStage === 'ach_form_signed') {
              finalHtmlBody = buildOnboardingEmailHtml(recipientFirstName);
            } else if (newStage === 'new_lead') {
              finalHtmlBody = buildWelcomeEmailHtml(recipientFirstName, lead.property_address || "");
              emailSubject = emailSubject || "Welcome to PeachHaus - Your Property Management Partner";
            } else if (newStage === 'unreached') {
              finalHtmlBody = buildFollowUpEmailHtml(recipientFirstName);
              emailSubject = emailSubject || "Quick follow-up on your property";
            } else if (newStage === 'call_scheduled') {
              finalHtmlBody = buildCallScheduledEmailHtml(recipientFirstName, lead.property_address || "");
              emailSubject = emailSubject || "Confirming Our Discovery Call";
            } else if (newStage === 'call_attended') {
              finalHtmlBody = buildCallAttendedEmailHtml(recipientFirstName, lead.property_address || "", lead.ai_summary || "");
              emailSubject = emailSubject || "Next Steps After Our Conversation";
            } else if (newStage === 'contract_out') {
              finalHtmlBody = buildContractOutEmailHtml(recipientFirstName, lead.property_address || "");
              emailSubject = emailSubject || "Your Management Agreement is Ready";
            } else if (newStage === 'ops_handoff') {
              finalHtmlBody = buildOpsHandoffEmailHtml(recipientFirstName);
              emailSubject = emailSubject || "Your Property is in Good Hands";
            } else {
              // Fallback: Convert plain text to branded HTML
              finalHtmlBody = buildBrandedEmailHtml(recipientFirstName, emailSubject || "Update from PeachHaus", [
                { content: messageBody.replace(/\n/g, '<br>') }
              ]);
            }

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "PeachHaus Group LLC - Ingo Schaer <ingo@peachhausgroup.com>",
                to: [lead.email],
                subject: emailSubject || "Message from PeachHaus",
                text: messageBody + "\n\n--\nIngo Schaer\nCo-Founder, Operations Manager\nPeachHaus Group LLC\n(404) 800-5932\ningo@peachhausgroup.com",
                html: finalHtmlBody,
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
