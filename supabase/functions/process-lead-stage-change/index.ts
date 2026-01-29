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

const LOGO_URL = "https://propertycentral.lovable.app/images/peachhaus-logo.png";

// Owner-facing onboarding timeline steps (6 steps including payment and photos)
const OWNER_TIMELINE_STEPS = [
  { key: 'payment', label: 'Setup Payment', icon: '💳' },
  { key: 'onboarding_form', label: 'Complete Onboarding Form', icon: '📋' },
  { key: 'insurance', label: 'Submit Insurance', icon: '🛡️' },
  { key: 'inspection', label: 'Schedule Inspection', icon: '🏠' },
  { key: 'photos', label: 'Book Photos & Tour', icon: '📸' },
  { key: 'onboarded', label: 'Onboarded', icon: '🎉' },
];

// Map lead stages to timeline step index (returns the CURRENT step, not the completed step)
function getTimelineStep(stage: string): number {
  switch(stage) {
    case 'contract_signed': 
      return 0; // Current step: Setup Payment
    case 'ach_form_signed': 
      return 1; // Current step: Complete Onboarding Form
    case 'onboarding_form_requested': 
      return 2; // Current step: Submit Insurance
    case 'insurance_requested': 
      return 3; // Current step: Schedule Inspection (this is the CURRENT step, not completed)
    case 'inspection_scheduled': 
      return 3; // Still on Schedule Inspection (inspection booked but not yet done)
    case 'photos_walkthrough':
      return 4; // Current step: Book Photos & Tour
    case 'ops_handoff': 
      return 6; // All done (beyond timeline - all checkmarks)
    default: 
      return -1; // Pre-onboarding stages (don't show timeline)
  }
}

// Build visual timeline HTML for emails
function buildTimelineHtml(currentStage: string): string {
  const currentStep = getTimelineStep(currentStage);
  if (currentStep < 0) return ''; // Don't show for pre-onboarding stages
  
  const stepsHtml = OWNER_TIMELINE_STEPS.map((step, i) => {
    const isCompleted = i < currentStep;
    const isCurrent = i === currentStep;
    
    let bgColor = '#e5e7eb'; // gray for upcoming
    let textColor = '#9ca3af';
    let labelColor = '#6b7280';
    let labelWeight = '500';
    let statusContent = '';
    
    if (isCompleted) {
      bgColor = '#10b981'; // green
      textColor = '#ffffff';
      labelColor = '#10b981';
      statusContent = '✓';
    } else if (isCurrent) {
      bgColor = '#f59e0b'; // amber/orange
      textColor = '#ffffff';
      labelColor = '#111827';
      labelWeight = '700';
      statusContent = `${i + 1}`;
    } else {
      statusContent = `${i + 1}`;
    }
    
    return `
      <td style="text-align: center; width: 20%; padding: 0 4px; vertical-align: top;">
        <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="width: 36px; height: 36px; background: ${bgColor}; border-radius: 50%; text-align: center; vertical-align: middle;">
              <span style="color: ${textColor}; font-size: 14px; font-weight: 700; line-height: 36px; display: block;">${statusContent}</span>
            </td>
          </tr>
        </table>
        <div style="font-size: 11px; color: ${labelColor}; margin-top: 8px; font-weight: ${labelWeight}; line-height: 1.3;">
          ${step.label}
        </div>
      </td>
    `;
  }).join('');
  
  // Build the connecting line
  const progressPercent = Math.min(100, (currentStep / (OWNER_TIMELINE_STEPS.length - 1)) * 100);
  
  return `
    <div style="margin: 24px 0; padding: 24px 20px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="text-transform: uppercase; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1.2px; margin-bottom: 20px; text-align: center;">
        📍 Your Onboarding Progress
      </div>
      
      <!-- Progress bar background -->
      <div style="position: relative; margin: 0 40px 16px 40px; height: 4px; background: #e2e8f0; border-radius: 2px;">
        <div style="position: absolute; top: 0; left: 0; height: 4px; background: linear-gradient(90deg, #10b981 0%, #10b981 ${progressPercent}%, #e2e8f0 ${progressPercent}%); border-radius: 2px; width: 100%;"></div>
      </div>
      
      <table width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
        <tr>
          ${stepsHtml}
        </tr>
      </table>
      
      <div style="margin-top: 16px; text-align: center; font-size: 10px; color: #94a3b8;">
        <span style="color: #10b981;">✓ Completed</span> &nbsp;•&nbsp; 
        <span style="color: #f59e0b;">● Current Step</span> &nbsp;•&nbsp; 
        <span style="color: #9ca3af;">○ Upcoming</span>
      </div>
    </div>
  `;
}

// Beautiful HTML email template builder (styled like owner statement emails)
// Structure: Greeting → Intro Text → Timeline → Content Sections → Signature
function buildBrandedEmailHtml(
  recipientName: string,
  subject: string,
  sections: Array<{ title?: string; content?: string; highlight?: boolean; warning?: boolean; cta?: { text: string; url: string }; isIntro?: boolean }>,
  currentStage?: string
): string {
  // Separate intro sections from other sections
  const introSections = sections.filter(s => s.isIntro);
  const contentSections = sections.filter(s => !s.isIntro);
  
  const buildSectionHtml = (section: typeof sections[0]) => {
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
  };

  const introHtml = introSections.map(buildSectionHtml).join('');
  const contentHtml = contentSections.map(buildSectionHtml).join('');

  // Generate timeline HTML if stage is provided and relevant
  const timelineHtml = currentStage ? buildTimelineHtml(currentStage) : '';
  
  // Timeline explanation text
  const timelineExplanation = timelineHtml ? `
    <div style="margin: 0 0 20px 0; padding: 16px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="font-size: 13px; color: #475569; line-height: 1.6;">
        <strong>📊 Track Your Progress:</strong> The timeline above shows where you are in the onboarding process. Green checkmarks indicate completed steps, the orange circle shows your current step, and gray circles are upcoming steps.
      </div>
    </div>
  ` : '';

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

              <!-- Intro Text (before timeline) -->
              ${introHtml ? `
              <tr>
                <td style="padding: 0 32px 16px 32px;">
                  ${introHtml}
                </td>
              </tr>
              ` : ''}

              <!-- Timeline (if applicable) -->
              ${timelineHtml ? `
              <tr>
                <td style="padding: 0 32px;">
                  ${timelineHtml}
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px;">
                  ${timelineExplanation}
                </td>
              </tr>
              ` : ''}
              
              <!-- Content Sections (after timeline) -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  ${contentHtml}
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
function buildInsuranceEmailHtml(recipientName: string, currentStage: string): string {
  return buildBrandedEmailHtml(recipientName, "Insurance Verification Required", [
    {
      isIntro: true,
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
  ], currentStage);
}

// Build onboarding form email HTML
function buildOnboardingEmailHtml(recipientName: string, currentStage: string): string {
  return buildBrandedEmailHtml(recipientName, "Complete Your Property Onboarding", [
    {
      isIntro: true,
      content: "Your payment method has been set up successfully! 🎉 We're ready to capture your property details and lock in the next steps."
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
  ], currentStage);
}

// Build CO-HOSTING payment email - We CHARGE them (ACH 1% or Card 3%)
// Note: This is sent AFTER the welcome email, so content reflects they're already onboarded
function buildCoHostingPaymentEmailHtml(recipientName: string, stripeUrl: string, propertyAddress: string, currentStage: string): string {
  return buildBrandedEmailHtml(recipientName, "Set Up Your Payment Method", [
    {
      isIntro: true,
      content: `As mentioned in our welcome email, the next step is to set up your payment method${propertyAddress ? ` for <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "This Will Be Used For",
      highlight: true,
      content: `<strong>Property Expenses & Management Fees</strong><br>For any management fees or property expenses when needed. We only charge when there are actual costs to cover.`
    },
    {
      title: "Choose Your Payment Method",
      content: `
        <table style="width: 100%;">
          <tr>
            <td style="padding: 16px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; margin-bottom: 8px;">
              <div style="font-weight: 700; color: #166534; font-size: 15px;">US Bank Account (ACH)</div>
              <div style="font-size: 13px; color: #374151; margin-top: 4px;"><strong>1% processing fee</strong> - Recommended</div>
            </td>
          </tr>
          <tr><td style="height: 8px;"></td></tr>
          <tr>
            <td style="padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
              <div style="font-weight: 600; color: #374151;">Credit/Debit Card</div>
              <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">3% processing fee</div>
            </td>
          </tr>
        </table>
      `
    },
    {
      cta: { text: "Set Up Payment Method", url: stripeUrl }
    },
    {
      highlight: true,
      content: "<strong>Secure and Encrypted</strong><br>We use Stripe, the industry leader in payment security. Your information is never stored on our servers."
    },
    {
      warning: true,
      content: "This secure link expires in 24 hours. If it expires, contact us and we'll send a new one."
    },
    {
      content: "If you have any questions, just reply to this email.<br><br>Thank you for choosing PeachHaus!"
    }
  ], currentStage);
}

// Build FULL-SERVICE payment email - We PAY them (ACH only, no fees)
// Note: This is sent AFTER the welcome email, so content reflects they're already onboarded
function buildFullServicePaymentEmailHtml(recipientName: string, stripeUrl: string, propertyAddress: string, currentStage: string): string {
  return buildBrandedEmailHtml(recipientName, "Set Up Your Payout Account", [
    {
      isIntro: true,
      content: `As mentioned in our welcome email, the next step is to set up your payout account so we can deposit your rental earnings${propertyAddress ? ` from <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "Monthly Rental Payouts",
      highlight: true,
      content: `<strong>How Payouts Work</strong><br>We deposit your net rental earnings directly to your bank account on the <strong>5th of each month</strong>, following the monthly reconciliation. No fees for ACH transfers.`
    },
    {
      title: "Payout Method",
      content: `
        <table style="width: 100%;">
          <tr>
            <td style="padding: 16px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 8px;">
              <div style="font-weight: 700; color: #166534; font-size: 15px;">US Bank Account (ACH)</div>
              <div style="font-size: 13px; color: #166534; margin-top: 4px;"><strong>No processing fees</strong></div>
            </td>
          </tr>
        </table>
        <p style="font-size: 12px; color: #6b7280; margin-top: 12px; font-style: italic;">Note: Only bank accounts are supported for receiving rental income deposits.</p>
      `
    },
    {
      cta: { text: "Set Up Payout Account", url: stripeUrl }
    },
    {
      highlight: true,
      content: "<strong>Secure and Encrypted</strong><br>We use Stripe, the industry leader in payment security. Your information is never stored on our servers."
    },
    {
      warning: true,
      content: "This secure link expires in 24 hours. If it expires, contact us and we'll send a new one."
    },
    {
      content: "If you have any questions, just reply to this email.<br><br>Thank you for choosing PeachHaus!"
    }
  ], currentStage);
}

// Build inspection scheduling email HTML
function buildInspectionSchedulingEmailHtml(recipientName: string, bookingUrl: string, currentStage: string): string {
  const SMART_LOCK_URL = "https://www.amazon.com/Yale-Security-Connected-Back-Up-YRD410-WF1-BSP/dp/B0B9HWYMV5";
  const CHECKLIST_URL = "https://propertycentral.lovable.app/documents/MTR_Start_Up_Checklist.pdf";
  
  return buildBrandedEmailHtml(recipientName, "Schedule Your Onboarding Inspection", [
    {
      isIntro: true,
      content: "You're almost there! The final step before going live is to schedule your onboarding inspection."
    },
    {
      title: "🛡️ What We'll Cover During Your Inspection",
      content: `
        <table style="width: 100%;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
              <strong style="color: #f59e0b;">🔍 Safety & Onboarding Check</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">We'll document all appliance serial numbers, verify safety equipment (fire extinguishers, fire blankets, smoke/CO detectors), and ensure everything meets guest-ready standards.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
              <strong style="color: #f59e0b;">📋 Property Inventory Check</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">We verify that all essential items are in place - linens, kitchen supplies, toiletries, plungers in bathrooms, and everything guests need for a 5-star experience.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
              <strong style="color: #f59e0b;">🔐 Smart Lock Verification</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">We'll test and verify your smart lock is properly connected and working for seamless guest check-ins.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <strong style="color: #f59e0b;">✨ Final Go-Live Preparation</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">After the inspection, your property will be ready to welcome guests!</p>
            </td>
          </tr>
        </table>
      `
    },
    {
      title: "📥 Prepare for Your Inspection",
      content: `
        <p style="margin: 0 0 12px 0;">Download our inventory checklist to ensure your property has everything needed:</p>
        <a href="${CHECKLIST_URL}" style="display: inline-block; padding: 10px 20px; background: #f3f4f6; color: #374151; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #e5e7eb;">📄 Download STR/MTR Setup Checklist</a>
      `,
      highlight: true
    },
    {
      cta: { text: "Schedule Your Inspection →", url: bookingUrl }
    },
    {
      warning: true,
      content: `<strong>🔐 About the Smart Lock:</strong> If you need us to install a smart lock, we'll purchase and bring one. Not all smart locks are compatible—we use the <a href="${SMART_LOCK_URL}" style="color: #1e40af;">Yale Security Smart Lock</a> because it integrates with our property management system to automatically generate unique access codes for each guest.`
    },
    {
      warning: true,
      content: `<strong>🗄️ Utility Closet Needed:</strong> Please designate one closet or cabinet for property supplies. We'll store extra blankets, towels, cleaning supplies, and guest refills there, and install a lock during the inspection.`
    },
    {
      content: "Once your inspection is complete, we'll finalize your listing and you'll be ready to welcome guests!"
    }
  ], currentStage);
}

// Build professional photos and walkthrough email HTML
function buildPhotosWalkthroughEmailHtml(recipientName: string, currentStage: string): string {
  const PHOTOGRAPHER_URL = "https://www.fivepointsmediaco.com/";
  const LOOM_VIDEO_URL = "https://www.loom.com/share/52c1e4be2fe740cba4743cc6d4f2fd21";
  // Use Loom's embed thumbnail format which is more reliable in emails
  const LOOM_EMBED_THUMBNAIL = "https://cdn.loom.com/sessions/thumbnails/52c1e4be2fe740cba4743cc6d4f2fd21-1715789608612.jpg";
  
  return buildBrandedEmailHtml(recipientName, "Professional Photography & Virtual Tour", [
    {
      isIntro: true,
      content: `Your property is almost ready to go live! 🎉 The final step is booking professional photography and a virtual tour. <strong>Great marketing materials are one of the biggest factors in attracting quality guests and maximizing your rental income.</strong>`
    },
    {
      title: "📹 Watch: How to Book Your Photo Session",
      content: `
        <div style="margin: 16px 0; text-align: center;">
          <a href="${LOOM_VIDEO_URL}" style="display: inline-block; position: relative;">
            <img src="${LOOM_EMBED_THUMBNAIL}" alt="Watch Tutorial Video" style="max-width: 100%; width: 480px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <div style="width: 0; height: 0; border-top: 12px solid transparent; border-bottom: 12px solid transparent; border-left: 20px solid white; margin-left: 4px;"></div>
            </div>
          </a>
          <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Click to watch the 6-minute walkthrough</p>
        </div>
      `
    },
    {
      title: "📸 Meet Ramon - Your Photography Partner",
      content: `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fbbf24; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #92400e; font-size: 15px; margin-bottom: 8px;">Five Points Media Co</div>
          <div style="font-size: 14px; color: #78350f; line-height: 1.6;">
            <strong>⭐ 5.0 Rating</strong> · 67+ Google Reviews<br>
            Trusted by Keller Williams, EXP Realty, and top property managers<br>
            Specializing in Airbnb & short-term rental photography
          </div>
        </div>
        <p style="font-size: 13px; color: #6b7280; font-style: italic;">"We've been working with Ramon for a long time. He's been doing a really good job. He's specialized in Airbnb photography - floor plans, virtual tours, everything. Very professional."</p>
      `,
      highlight: true
    },
    {
      title: "✨ What's Included (SocialOS Package)",
      content: `
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
              <strong style="color: #f59e0b;">📷 25 Professional Photos</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Showcase every room with perfect lighting & angles</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
              <strong style="color: #f59e0b;">🎬 Showcase Reel</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Social media ready video for Instagram & marketing</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
              <strong style="color: #f59e0b;">🗺️ 2D Floor Plans (Add-On)</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Highly recommended - helps guests understand the layout</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; vertical-align: top;">
              <strong style="color: #f59e0b;">🏠 Virtual Tour</strong>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">Let guests walk through before booking - we've rented properties sight-unseen with this!</p>
            </td>
          </tr>
        </table>
      `
    },
    {
      title: "📋 Step-by-Step Booking Guide",
      content: `
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>1.</strong> Visit fivepointsmediaco.com (link below)</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>2.</strong> Click "Book Now" → "Book an Appointment"</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>3.</strong> Select "Short Term Rentals" category</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>4.</strong> Enter your property address & confirm details</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>5.</strong> Choose the <strong>SocialOS Package</strong> (25 photos + showcase reel)</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>6.</strong> Add <strong>2D Floor Plans</strong> (highly recommended!)</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>7.</strong> Pick a date & time - aim for <strong>11am-noon</strong> (best lighting + less traffic)</td></tr>
          <tr><td style="padding: 8px 0;"><strong>8.</strong> Enter "<strong>Ingo at PeachHaus Group</strong>" as the contact</td></tr>
        </table>
      `
    },
    {
      cta: { text: "Book Your Photo Session →", url: PHOTOGRAPHER_URL }
    },
    {
      warning: true,
      content: `<strong>⚡ Quick Turnaround:</strong> Ramon typically delivers photos next-day! Once we receive them, your listing goes live and you can start welcoming guests.`
    },
    {
      title: "💡 Why Professional Photos Matter",
      content: `
        <p style="margin: 0 0 12px 0;">Your photos are your <strong>#1 marketing asset</strong> after the property itself. Professional imagery can:</p>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 8px;">Increase booking rates by <strong>up to 40%</strong></li>
          <li style="margin-bottom: 8px;">Justify <strong>higher nightly rates</strong></li>
          <li style="margin-bottom: 8px;">Stand out from amateur listings</li>
          <li>The virtual tour alone has helped us rent properties <strong>sight-unseen!</strong></li>
        </ul>
      `,
      highlight: true
    },
    {
      content: `Please reply to this email with your confirmed booking date. We'll plan to meet you at the property for the photo shoot!<br><br><strong>Note:</strong> Drone photos are available as a separate add-on if you'd like aerial shots of the property and neighborhood.`
    }
  ], currentStage);
}

// Hosted assets for welcome email - use public app URLs for reliable delivery
const APP_BASE_URL = "https://propertycentral.lovable.app";
const ANJA_INGO_PHOTO_URL = `${APP_BASE_URL}/images/anja-ingo-hosts.jpg`;
const INGO_SIGNATURE_URL = `${APP_BASE_URL}/images/ingo-signature.png`;
const ANJA_SIGNATURE_URL = `${APP_BASE_URL}/images/anja-signature.png`;
const ANJA_BOOK_URL = `${APP_BASE_URL}/books/hybrid-rental-strategy-book.png`;
const INGO_BOOK_URL = `${APP_BASE_URL}/books/propertypreneur-book.png`;

// Build welcome onboarding email for contract_signed stage
// Matches the same style as W-9 and other stage emails
function buildWelcomeOnboardingEmailHtml(recipientName: string, propertyAddress: string): string {
  const currentYear = new Date().getFullYear();
  
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
                  <div style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Welcome to the PeachHaus Family</div>
                  ${propertyAddress ? `<div style="font-size: 13px; color: #9ca3af; margin-top: 8px;">${propertyAddress}</div>` : ''}
                </td>
              </tr>
              
              <!-- Hero Photo - Anja & Ingo -->
              <tr>
                <td style="padding: 24px 24px 0 24px;">
                  <img src="${ANJA_INGO_PHOTO_URL}" 
                       alt="Anja and Ingo Schaer - Your PeachHaus Team"
                       width="552"
                       style="width: 100%; max-width: 552px; height: auto; display: block; border-radius: 12px;">
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 24px 32px 16px 32px;">
                  <div style="font-size: 16px; color: #111827;">Dear <strong>${recipientName}</strong>,</div>
                </td>
              </tr>

              <!-- Intro Text -->
              <tr>
                <td style="padding: 0 32px 16px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    We are genuinely honored to welcome you to PeachHaus. Your decision to entrust us with your property means the world to us, and we don't take that responsibility lightly.
                  </div>
                </td>
              </tr>

              <!-- Our Promise Card -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fbbf24; border-radius: 12px; padding: 20px 24px;">
                    <div style="font-size: 12px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Our Promise to You</div>
                    <div style="font-size: 14px; color: #78350f; line-height: 1.6; font-style: italic;">
                      "We treat every property as if it were our own home. Your success is our success, and we're committed to maximizing your investment while giving you back the freedom of truly passive income."
                    </div>
                  </div>
                </td>
              </tr>

              <!-- What Sets Us Apart -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                    <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">What Sets PeachHaus Apart</span>
                  </div>
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
                        <span style="color: #f59e0b; margin-right: 8px;">✦</span>
                        <strong>Revenue-First Approach</strong> — Dynamic pricing and market optimization to maximize your returns
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
                        <span style="color: #f59e0b; margin-right: 8px;">✦</span>
                        <strong>Complete Transparency</strong> — Real-time owner portal with full financial visibility
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">
                        <span style="color: #f59e0b; margin-right: 8px;">✦</span>
                        <strong>5-Star Guest Experience</strong> — Exceptional hospitality that drives repeat bookings and reviews
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; font-size: 14px; color: #374151;">
                        <span style="color: #f59e0b; margin-right: 8px;">✦</span>
                        <strong>Data-Driven Decisions</strong> — We leverage technology and AI for smarter property management
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Onboarding Timeline -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="padding: 12px 0; border-bottom: 2px solid #f59e0b; margin-bottom: 16px;">
                    <span style="font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">Your Onboarding Journey</span>
                  </div>
                  <table style="width: 100%; background: #f9fafb; border-radius: 12px; padding: 16px;">
                    <tr>
                      <td style="padding: 16px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="text-align: center; width: 25%; vertical-align: top; padding: 0 4px;">
                              <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; margin: 0 auto 8px; line-height: 36px; color: #fff; font-weight: 700; font-size: 14px;">1</div>
                              <div style="font-size: 11px; color: #111827; font-weight: 600;">W-9 Form</div>
                              <div style="font-size: 10px; color: #6b7280;">Coming soon</div>
                            </td>
                            <td style="text-align: center; width: 25%; vertical-align: top; padding: 0 4px;">
                              <div style="width: 36px; height: 36px; background: #d1d5db; border-radius: 50%; margin: 0 auto 8px; line-height: 36px; color: #6b7280; font-weight: 700; font-size: 14px;">2</div>
                              <div style="font-size: 11px; color: #6b7280;">Payment Setup</div>
                              <div style="font-size: 10px; color: #9ca3af;">Secure link</div>
                            </td>
                            <td style="text-align: center; width: 25%; vertical-align: top; padding: 0 4px;">
                              <div style="width: 36px; height: 36px; background: #d1d5db; border-radius: 50%; margin: 0 auto 8px; line-height: 36px; color: #6b7280; font-weight: 700; font-size: 14px;">3</div>
                              <div style="font-size: 11px; color: #6b7280;">Property Details</div>
                              <div style="font-size: 10px; color: #9ca3af;">Onboarding form</div>
                            </td>
                            <td style="text-align: center; width: 25%; vertical-align: top; padding: 0 4px;">
                              <div style="width: 36px; height: 36px; background: #d1d5db; border-radius: 50%; margin: 0 auto 8px; line-height: 36px; color: #6b7280; font-weight: 700; font-size: 14px;">4</div>
                              <div style="font-size: 11px; color: #6b7280;">Go Live</div>
                              <div style="font-size: 10px; color: #9ca3af;">Start earning</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- What to Expect Next -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 20px 24px;">
                    <div style="font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">What to Expect Next</div>
                    <div style="font-size: 14px; color: #166534; line-height: 1.6;">
                      You'll receive our W-9 form for your records, followed by a secure link to set up your payment details. Each step brings you closer to welcoming your first guests!
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Closing -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <div style="font-size: 14px; color: #374151; line-height: 1.7;">
                    We're here for you every step of the way. Have questions? Just reply to this email — we personally read and respond to every message.
                  </div>
                  <div style="font-size: 14px; color: #374151; line-height: 1.7; margin-top: 12px;">
                    Here's to a rewarding partnership and the beginning of truly passive income.
                  </div>
                </td>
              </tr>
              
              <!-- Signature Section -->
              <tr>
                <td style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af;">Warmest Regards</span>
                  </div>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="text-align: center; width: 50%; padding: 0 12px; vertical-align: top;">
                        <img src="${ANJA_SIGNATURE_URL}" alt="Anja Schaer" style="height: 40px; width: auto; margin-bottom: 8px;">
                        <div style="font-weight: 700; font-size: 14px; color: #111827;">Anja Schaer</div>
                        <div style="font-size: 11px; color: #6b7280;">Co-Founder</div>
                      </td>
                      <td style="text-align: center; width: 50%; padding: 0 12px; vertical-align: top;">
                        <img src="${INGO_SIGNATURE_URL}" alt="Ingo Schaer" style="height: 40px; width: auto; margin-bottom: 8px;">
                        <div style="font-weight: 700; font-size: 14px; color: #111827;">Ingo Schaer</div>
                        <div style="font-size: 11px; color: #6b7280;">Co-Founder</div>
                      </td>
                    </tr>
                  </table>
                  <div style="text-align: center; margin-top: 16px;">
                    <a href="tel:+14048005932" style="color: #111827; text-decoration: none; font-size: 12px;">(404) 800-5932</a>
                    <span style="color: #d1d5db; margin: 0 8px;">·</span>
                    <a href="mailto:info@peachhausgroup.com" style="color: #f59e0b; text-decoration: none; font-size: 12px;">info@peachhausgroup.com</a>
                  </div>
                </td>
              </tr>
              
              <!-- Authors Section -->
              <tr>
                <td style="padding: 24px 32px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-top: 1px solid #e5e7eb;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af;">Our Expertise in Property Management</span>
                  </div>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="text-align: center; width: 50%; padding: 0 12px; vertical-align: top;">
                        <img src="${ANJA_BOOK_URL}" alt="The Hybrid Rental Strategy by Anja Schaer" style="width: 120px; height: auto; margin-bottom: 12px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <div style="font-size: 12px; font-weight: 600; color: #111827; line-height: 1.4;">The Hybrid Rental Strategy</div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">by Anja Schaer</div>
                      </td>
                      <td style="text-align: center; width: 50%; padding: 0 12px; vertical-align: top;">
                        <img src="${INGO_BOOK_URL}" alt="Propertypreneur by Ingo Schaer" style="width: 120px; height: auto; margin-bottom: 12px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <div style="font-size: 12px; font-weight: 600; color: #111827; line-height: 1.4;">Propertypreneur</div>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">by Ingo Schaer</div>
                      </td>
                    </tr>
                  </table>
                  <div style="text-align: center; margin-top: 16px;">
                    <div style="font-size: 12px; color: #6b7280; line-height: 1.6; max-width: 400px; margin: 0 auto;">
                      As published authors and industry experts, we bring proven strategies and innovative approaches to every property we manage.
                    </div>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <div style="font-size: 11px; color: #9ca3af;">
                    © ${currentYear} PeachHaus Group LLC · Atlanta, GA
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

// Build welcome email for new leads
function buildWelcomeEmailHtml(recipientName: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Welcome to PeachHaus", [
    {
      isIntro: true,
      content: `Thank you for your interest in PeachHaus property management! We're excited to learn more about your property${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ''}.`
    },
    {
      title: "Why Owners Choose Us",
      content: `
        <table style="width: 100%;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Average <strong>23% higher</strong> rental income vs. self-managed</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>4.9 star rating</strong> from property owners</td></tr>
          <tr><td style="padding: 8px 0;">Full-service management with <strong>transparent reporting</strong></td></tr>
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
      isIntro: true,
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
      isIntro: true,
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

// Build post-call email - Fortune 500 style with psychology principles
function buildCallAttendedEmailHtml(recipientName: string, propertyAddress: string, aiSummary: string): string {
  const firstName = recipientName.split(' ')[0];
  const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Fortune 500 corporate email template with Reciprocity + Commitment principles
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Next Steps After Our Conversation</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
    
    <!-- Header - Corporate Minimal with Logo -->
    <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
            <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div style="display: inline-block; background: #10b981; color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
              POST-CALL SUMMARY
            </div>
            <div style="font-size: 10px; color: #666666; margin-top: 4px; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
              ${issueDate}
            </div>
          </td>
        </tr>
      </table>
    </div>

    ${propertyAddress ? `
    <!-- Property Info Banner -->
    <div style="padding: 16px 32px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-bottom: 1px solid #86efac;">
      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: middle;">
            <div style="font-size: 10px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Property Under Discussion</div>
            <div style="font-size: 15px; font-weight: 700; color: #111111;">${propertyAddress}</div>
          </td>
        </tr>
      </table>
    </div>
    ` : ''}

    <!-- Greeting -->
    <div style="padding: 28px 32px 16px 32px;">
      <p style="font-size: 15px; line-height: 1.6; color: #111111; margin: 0;">
        Dear ${firstName},
      </p>
      <p style="font-size: 14px; line-height: 1.7; color: #444444; margin: 16px 0 0 0;">
        Thank you for taking the time to speak with us today. I truly enjoyed learning about your goals and I'm confident we can help you maximize your property's potential.
      </p>
    </div>

    <!-- Call Summary Section -->
    <div style="padding: 0 32px 20px 32px;">
      <div style="border: 2px solid #111111; border-radius: 0;">
        <div style="background: #111111; padding: 12px 20px;">
          <span style="color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">📋 What We Discussed</span>
        </div>
        <div style="padding: 20px; background: #fafafa;">
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.7; font-style: italic;">
            "${aiSummary || 'We discussed your property management needs, revenue goals, and how PeachHaus can provide a turnkey solution for your rental property.'}"
          </p>
        </div>
      </div>
    </div>

    <!-- Resources Section - Reciprocity Principle -->
    <div style="padding: 0 32px 20px 32px;">
      <div style="font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; font-weight: 600;">
        📚 Resources For You
      </div>
      <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
        <tr>
          <td style="padding: 16px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: top; width: 40px;">
                  <div style="width: 32px; height: 32px; background: #f59e0b; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px;">🏠</div>
                </td>
                <td style="vertical-align: top; padding-left: 12px;">
                  <div style="font-weight: 700; color: #92400e; font-size: 13px; margin-bottom: 4px;">Onboarding Presentation</div>
                  <div style="font-size: 12px; color: #78350f; margin-bottom: 8px;">See exactly how we'll transform your property</div>
                  <a href="https://propertycentral.lovable.app/p/onboarding" style="font-size: 12px; color: #92400e; text-decoration: underline; font-weight: 600;">View Presentation →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 8px;">
            <table style="width: 100%;">
              <tr>
                <td style="vertical-align: top; width: 40px;">
                  <div style="width: 32px; height: 32px; background: #3b82f6; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px;">📊</div>
                </td>
                <td style="vertical-align: top; padding-left: 12px;">
                  <div style="font-weight: 700; color: #1e40af; font-size: 13px; margin-bottom: 4px;">Owner Portal Preview</div>
                  <div style="font-size: 12px; color: #1e3a8a; margin-bottom: 8px;">Full transparency on performance & finances</div>
                  <a href="https://propertycentral.lovable.app/p/owner-portal" style="font-size: 12px; color: #1e40af; text-decoration: underline; font-weight: 600;">View Portal Demo →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Next Steps Section -->
    <div style="padding: 0 32px 24px 32px;">
      <div style="font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; font-weight: 600;">
        🚀 Next Steps
      </div>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 12px 16px; border-left: 3px solid #10b981; background: #f9fafb; margin-bottom: 8px;">
            <div style="font-size: 13px; color: #111827;"><strong>1.</strong> Review the resources above at your convenience</div>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
         <tr>
          <td style="padding: 12px 16px; border-left: 3px solid #f59e0b; background: #f9fafb; margin-bottom: 8px;">
            <div style="font-size: 13px; color: #111827;"><strong>2.</strong> When you're ready, I'll send the management agreement</div>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px 16px; border-left: 3px solid #3b82f6; background: #f9fafb;">
            <div style="font-size: 13px; color: #111827;"><strong>3.</strong> Sign when ready — no pressure, take your time</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Signature Section -->
    <div style="padding: 24px 32px; border-top: 1px solid #e5e7eb;">
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
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; background: #f9f9f9; border-top: 1px solid #e5e5e5;">
      <p style="margin: 0 0 8px; color: #666666; font-size: 11px;">
        Questions? Just reply to this email or call/text anytime.
      </p>
      <p style="margin: 0; color: #999999; font-size: 11px;">
        © ${new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA
      </p>
    </div>

  </div>
</body>
</html>
`;
}

// Build contract out email
function buildContractOutEmailHtml(recipientName: string, propertyAddress: string): string {
  return buildBrandedEmailHtml(recipientName, "Your Management Agreement is Ready", [
    {
      isIntro: true,
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
      isIntro: true,
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
    sms: "Great speaking with you, {{name}}! I've sent over some resources about {{property_address}} to help with your decision. Take your time reviewing – I'm here when you're ready!",
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
    // contract_signed now triggers welcome + W9 emails, NOT payment setup
    // Payment setup is sent later in welcome_email_w9 stage
    sms: "Welcome to PeachHaus, {{name}}! Your agreement is signed. Check your email for a welcome message and important documents.",
    email_subject: "Welcome to the PeachHaus Family",
    email_body: `WELCOME_ONBOARDING_HTML_TEMPLATE`,
    principle: "Celebration + Momentum"
  },
  welcome_email_w9: {
    // This stage is triggered 1 hour after contract_signed and sends payment setup email
    sms: "Hi {{name}}! Time to set up your payment details. Check your email for the secure link.",
    email_subject: "Set Up Your Payment Method - PeachHaus",
    email_body: `PAYMENT_HTML_TEMPLATE`,
    principle: "Momentum + Next Step"
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
  inspection_scheduled: {
    sms: "Hi {{name}}! 🏠 Almost there! Your final step is to schedule your onboarding inspection. Check your email for available times (Tues/Thurs, 11am-3pm EST). Can't wait to get you live!",
    email_subject: "Schedule Your Onboarding Inspection - PeachHaus",
    email_body: `INSPECTION_HTML_TEMPLATE`,
    principle: "Progress + Anticipation"
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
        model: "google/gemini-3-flash-preview",
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

    // ========== DIRECT STAGE-BASED EMAIL SENDING ==========
    // Send branded emails directly for specific stages (independent of automations)
    // This ensures emails are sent even if no automation is configured for that stage
    const directResendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (directResendApiKey && lead.email) {
      const recipientFirstName = lead.name?.split(' ')[0] || lead.name || "there";
      let directEmailHtml: string | null = null;
      let directEmailSubject: string = "";
      let sendAdminCopy = false;
      let adminEmailSubject = "";
      
      // Handle each stage that needs a direct email
      if (newStage === 'ach_form_signed') {
        // Payment method saved - send onboarding form email
        directEmailHtml = buildOnboardingEmailHtml(recipientFirstName, newStage);
        directEmailSubject = "Complete Your Property Onboarding - PeachHaus";
        sendAdminCopy = true;
        adminEmailSubject = `📋 Onboarding Form Email Sent: ${lead.name}`;
        console.log(`Sending onboarding form email for stage ${newStage}`);
      } else if (newStage === 'onboarding_form_requested') {
        // This stage needs the onboarding form email
        directEmailHtml = buildOnboardingEmailHtml(recipientFirstName, newStage);
        directEmailSubject = "Complete Your Property Onboarding - PeachHaus";
        sendAdminCopy = true;
        adminEmailSubject = `📋 Onboarding Form Email Sent: ${lead.name}`;
        console.log(`Sending direct onboarding form email for stage ${newStage}`);
      } else if (newStage === 'insurance_requested') {
        directEmailHtml = buildInsuranceEmailHtml(recipientFirstName, newStage);
        directEmailSubject = "Insurance Verification Required - PeachHaus";
        sendAdminCopy = true;
        adminEmailSubject = `🛡️ Insurance Email Sent: ${lead.name}`;
        console.log(`Sending direct insurance email for stage ${newStage}`);
      } else if (newStage === 'inspection_scheduled') {
        // Build personalized booking URL with lead info prefilled
        const bookingParams = new URLSearchParams();
        bookingParams.set('name', lead.name || '');
        bookingParams.set('email', lead.email || '');
        bookingParams.set('phone', lead.phone || '');
        bookingParams.set('address', lead.property_address || '');
        bookingParams.set('leadId', leadId);
        if (lead.property_id) bookingParams.set('propertyId', lead.property_id);
        
        const bookingUrl = `https://propertycentral.lovable.app/book-inspection?${bookingParams.toString()}`;
        directEmailHtml = buildInspectionSchedulingEmailHtml(recipientFirstName, bookingUrl, newStage);
        directEmailSubject = "Schedule Your Onboarding Inspection - PeachHaus";
        // No admin copy - admin gets notified when lead actually books
        console.log(`Sending direct inspection scheduling email for stage ${newStage}`);
      } else if (newStage === 'photos_walkthrough') {
        // PHOTOS_WALKTHROUGH: Only send for NEW STRs (not existing STRs that already have photos)
        // Check discovery_calls.current_situation to determine if this is a new property
        const { data: discoveryCall } = await supabase
          .from("discovery_calls")
          .select("current_situation, existing_listing_url")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const isNewSTR = discoveryCall?.current_situation === 'new_property' || 
                         (!discoveryCall?.current_situation && !discoveryCall?.existing_listing_url);
        const isExistingSTR = discoveryCall?.current_situation === 'self_managing' || 
                              discoveryCall?.current_situation === 'unhappy_pm' ||
                              discoveryCall?.existing_listing_url;
        
        if (isExistingSTR) {
          console.log(`Skipping photos email for ${leadId} - existing STR (situation: ${discoveryCall?.current_situation})`);
          // Don't send the photography email for existing STRs - they already have photos
        } else {
          // New STR or unknown - send the photography booking email
          directEmailHtml = buildPhotosWalkthroughEmailHtml(recipientFirstName, newStage);
          directEmailSubject = "Book Your Professional Property Photos - PeachHaus";
          sendAdminCopy = true;
          adminEmailSubject = `📸 Photo Booking Email Sent: ${lead.name}`;
          console.log(`Sending direct photos/walkthrough email for NEW STR stage ${newStage}`);
        }
      } else if (newStage === 'contract_signed') {
        // CONTRACT_SIGNED: Send welcome onboarding email FIRST (W9 and payment setup come later)
        directEmailHtml = buildWelcomeOnboardingEmailHtml(recipientFirstName, lead.property_address || "");
        // Clean subject line to avoid spam filters - no emojis, clear professional text
        directEmailSubject = "Welcome to PeachHaus - Your Onboarding Has Started";
        sendAdminCopy = true;
        adminEmailSubject = `Welcome Email Sent: ${lead.name}`;
        console.log(`Stage contract_signed: Sending welcome email FIRST for lead ${leadId}`);
      } else if (newStage === 'welcome_email_w9') {
        // WELCOME_EMAIL_W9: Send payment setup email (triggered 1 hour after contract_signed OR manually)
        console.log(`Stage welcome_email_w9: Creating payment setup email for lead ${leadId}`);
        
        // Fetch owner service type
        let serviceType = 'cohosting';
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
        
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          try {
            const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
            const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
            
            // Find or create Stripe customer
            const customers = await stripe.customers.list({ email: lead.email, limit: 1 });
            let customerId = customers.data[0]?.id;
            
            if (!customerId) {
              const customer = await stripe.customers.create({
                email: lead.email,
                name: lead.name || undefined,
                metadata: { lead_id: leadId, service_type: serviceType }
              });
              customerId = customer.id;
            }
            
            const siteUrl = "https://propertycentral.lovable.app";
            const paymentMethodTypes = serviceType === 'full_service' 
              ? ["us_bank_account" as const]
              : ["us_bank_account" as const, "card" as const];
            
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
            
            // Update lead with Stripe info
            await supabase.from("leads").update({
              stripe_customer_id: customerId,
              stripe_setup_intent_id: session.id,
              last_contacted_at: new Date().toISOString()
            }).eq("id", leadId);
            
            if (serviceType === 'full_service') {
              directEmailHtml = buildFullServicePaymentEmailHtml(recipientFirstName, session.url!, lead.property_address || "", 'contract_signed');
              directEmailSubject = "Set Up Your Payout Account - PeachHaus";
            } else {
              directEmailHtml = buildCoHostingPaymentEmailHtml(recipientFirstName, session.url!, lead.property_address || "", 'contract_signed');
              directEmailSubject = "Set Up Your Payment Method - PeachHaus";
            }
            
            // Add timeline entry for Stripe session
            await supabase.from("lead_timeline").insert({
              lead_id: leadId,
              action: `Stripe payment setup session created (${serviceType})`,
              metadata: { stripe_session_id: session.id, stripe_customer_id: customerId }
            });
            
          } catch (stripeError) {
            console.error("Stripe error in direct email:", stripeError);
            const fallbackUrl = `https://propertycentral.lovable.app/payment-setup?lead=${leadId}`;
            if (serviceType === 'full_service') {
              directEmailHtml = buildFullServicePaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "", 'contract_signed');
              directEmailSubject = "Set Up Your Payout Account - PeachHaus";
            } else {
              directEmailHtml = buildCoHostingPaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "", 'contract_signed');
              directEmailSubject = "Set Up Your Payment Method - PeachHaus";
            }
          }
        } else {
          const fallbackUrl = `https://propertycentral.lovable.app/payment-setup?lead=${leadId}`;
          directEmailHtml = buildCoHostingPaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "", 'contract_signed');
          directEmailSubject = "Set Up Your Payment Method - PeachHaus";
        }
        sendAdminCopy = true;
        adminEmailSubject = `Payment Setup Email Sent: ${lead.name}`;
      }
      
      // Send the direct email if we have HTML content
      if (directEmailHtml) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${directResendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "PeachHaus Property Management <info@peachhausgroup.com>",
              reply_to: "info@peachhausgroup.com",
              to: [lead.email],
              subject: directEmailSubject,
              html: directEmailHtml,
              headers: {
                "List-Unsubscribe": "<mailto:unsubscribe@peachhausgroup.com>",
                "X-Priority": "3",
              },
            }),
          });

          const emailResult = await emailResponse.json();
          console.log(`Direct stage email sent for ${newStage}: ${emailResponse.ok ? 'success' : 'failed'}`, emailResult);

          // Record communication
          await supabase.from("lead_communications").insert({
            lead_id: leadId,
            communication_type: "email",
            direction: "outbound",
            subject: directEmailSubject,
            body: `Direct stage email for ${newStage}`,
            status: emailResponse.ok ? "sent" : "failed",
            external_id: emailResult.id,
            error_message: emailResult.message,
          });

          // Add timeline entry
          await supabase.from("lead_timeline").insert({
            lead_id: leadId,
            action: `Stage email sent: "${directEmailSubject}"`,
            metadata: { 
              stage: newStage,
              email_id: emailResult.id,
              email_type: "direct_stage_email"
            },
          });

          // Send admin notification copy
          if (sendAdminCopy) {
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${directResendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "PeachHaus Notifications <notifications@peachhausgroup.com>",
                  to: ["info@peachhausgroup.com"],
                  subject: adminEmailSubject,
                  html: `
                    <h2>${adminEmailSubject}</h2>
                    <p><strong>Lead:</strong> ${lead.name}</p>
                    <p><strong>Email:</strong> ${lead.email}</p>
                    <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
                    <p><strong>Property:</strong> ${lead.property_address || 'Not specified'}</p>
                    <p><strong>Stage:</strong> ${newStage}</p>
                    <hr>
                    <p>The following email was sent to the lead:</p>
                    <div style="border: 1px solid #e5e7eb; padding: 16px; margin-top: 16px; border-radius: 8px;">
                      <p><strong>Subject:</strong> ${directEmailSubject}</p>
                    </div>
                  `,
                }),
              });
              console.log(`Admin notification sent for ${newStage}`);
            } catch (adminEmailError) {
              console.error("Failed to send admin notification:", adminEmailError);
            }
          }
        } catch (emailError) {
          console.error(`Error sending direct stage email for ${newStage}:`, emailError);
        }
      }
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
                const fromPhone = formatPhoneE164(Deno.env.get("TWILIO_PHONE_NUMBER") || "+17709885286");
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
            
            // Special handling for contract_signed - send Welcome email + W9, schedule payment for later
            if (newStage === 'contract_signed') {
              // CONTRACT_SIGNED: Send welcome onboarding email (NOT payment setup - that comes in welcome_email_w9)
              console.log(`Stage contract_signed: Sending welcome email for lead ${leadId}`);
              finalHtmlBody = buildWelcomeOnboardingEmailHtml(recipientFirstName, lead.property_address || "");
              emailSubject = "Welcome to the PeachHaus Family!";
              
              // Note: W9 email is sent separately after this automation loop completes
              // Payment setup email will be triggered when lead moves to welcome_email_w9 (scheduled for 1 hour later)
              
            } else if (newStage === 'welcome_email_w9') {
              // WELCOME_EMAIL_W9: This is triggered 1 hour after contract_signed - send payment setup email
              console.log(`Stage welcome_email_w9: Sending payment setup email for lead ${leadId}`);
              
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
                      lead.property_address || "",
                      'contract_signed' // Use contract_signed for timeline display
                    );
                    emailSubject = "Set Up Your Payout Account - PeachHaus";
                  } else {
                    finalHtmlBody = buildCoHostingPaymentEmailHtml(
                      recipientFirstName,
                      session.url!,
                      lead.property_address || "",
                      'contract_signed' // Use contract_signed for timeline display
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
                    finalHtmlBody = buildFullServicePaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "", 'contract_signed');
                    emailSubject = "Set Up Your Payout Account - PeachHaus";
                  } else {
                    finalHtmlBody = buildCoHostingPaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "", 'contract_signed');
                    emailSubject = "Set Up Your Payment Method - PeachHaus";
                  }
                }
              } else {
                console.log("STRIPE_SECRET_KEY not configured, using fallback URL");
                const fallbackUrl = `https://propertycentral.lovable.app/payment-setup?lead=${leadId}`;
                finalHtmlBody = buildCoHostingPaymentEmailHtml(recipientFirstName, fallbackUrl, lead.property_address || "", 'contract_signed');
                emailSubject = "Set Up Your Payment Method - PeachHaus";
              }
            } else if (newStage === 'insurance_requested') {
              finalHtmlBody = buildInsuranceEmailHtml(recipientFirstName, newStage);
            } else if (newStage === 'inspection_scheduled') {
              // Build personalized booking URL with lead info prefilled
              const bookingParams = new URLSearchParams();
              bookingParams.set('name', lead.name || '');
              bookingParams.set('email', lead.email || '');
              bookingParams.set('phone', lead.phone || '');
              bookingParams.set('address', lead.property_address || '');
              bookingParams.set('leadId', leadId);
              if (lead.property_id) bookingParams.set('propertyId', lead.property_id);
              
              const bookingUrl = `https://propertycentral.lovable.app/book-inspection?${bookingParams.toString()}`;
              finalHtmlBody = buildInspectionSchedulingEmailHtml(recipientFirstName, bookingUrl, newStage);
              emailSubject = "Schedule Your Onboarding Inspection - PeachHaus";
            } else if (newStage === 'photos_walkthrough') {
              finalHtmlBody = buildPhotosWalkthroughEmailHtml(recipientFirstName, newStage);
              emailSubject = "Book Your Professional Property Photos - PeachHaus";
            } else if (newStage === 'ach_form_signed') {
              finalHtmlBody = buildOnboardingEmailHtml(recipientFirstName, newStage);
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

    // Sync lead to GHL as backup
    try {
      console.log(`Syncing lead ${leadId} to GHL`);
      await fetch(`${supabaseUrl}/functions/v1/ghl-sync-lead`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leadId, syncReason: "stage_change", newStage }),
      });
      console.log(`GHL sync triggered for lead ${leadId}`);
    } catch (ghlError) {
      console.error("Error syncing to GHL:", ghlError);
    }

    // Trigger ops handoff automation when lead moves to ops_handoff stage
    if (newStage === "ops_handoff") {
      try {
        console.log(`Triggering ops handoff for lead ${leadId}`);
        await fetch(`${supabaseUrl}/functions/v1/ops-handoff-trigger`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ leadId }),
        });
        console.log(`Ops handoff triggered successfully for lead ${leadId}`);
      } catch (opsError) {
        console.error("Error triggering ops handoff:", opsError);
      }
    }

    // CONTRACT_SIGNED: Send W9 email separately and schedule payment setup for 1 hour later
    if (newStage === "contract_signed") {
      try {
        console.log(`Contract signed: Sending W9 email and scheduling payment setup for lead ${leadId}`);
        
        // Send W9 email immediately (separate from welcome email)
        await fetch(`${supabaseUrl}/functions/v1/send-w9-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ leadId }),
        });
        console.log(`W9 email sent for lead ${leadId}`);

        // Schedule payment setup email for 1 hour later
        const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
        await supabase.from("lead_scheduled_emails").insert({
          lead_id: leadId,
          email_type: "payment_setup",
          scheduled_for: scheduledFor,
          status: "pending",
          metadata: { 
            previous_stage: "contract_signed",
            next_stage: "welcome_email_w9"
          }
        });
        console.log(`Payment setup email scheduled for ${scheduledFor} for lead ${leadId}`);

        // Add timeline entries
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "W9 form email sent",
          metadata: { email_type: "w9_form" }
        });
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "Payment setup email scheduled (1-hour delay)",
          metadata: { scheduled_for: scheduledFor }
        });

      } catch (contractSignedError) {
        console.error("Error processing contract_signed actions:", contractSignedError);
      }
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
