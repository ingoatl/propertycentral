import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Feature screenshots captured from the portal
const FEATURE_SCREENSHOTS: Record<string, string> = {
  "messages": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/messages.png",
  "maintenance": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/maintenance.png",
  "screenings": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/screenings.png",
  "marketing": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/marketing.png",
  "voice-recap": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/voice-recap.png",
  "onboarding": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/onboarding.png",
  "schedule-calls": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/schedule-calls.png",
  "reports": "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/feature-screenshots/reports.png",
};

// Map feature_key to screenshot key
const FEATURE_KEY_TO_SCREENSHOT: Record<string, string> = {
  "owner_messages": "messages",
  "owner_voicemail": "messages",
  "maintenance_tracking": "maintenance",
  "maintenance_requests": "maintenance",
  "guest_screening": "screenings",
  "tenant_verification": "screenings",
  "marketing_activity": "marketing",
  "marketing_stats": "marketing",
  "voice_recap": "voice-recap",
  "monthly_recap": "voice-recap",
  "onboarding_timeline": "onboarding",
  "onboarding_progress": "onboarding",
  "schedule_call": "schedule-calls",
  "owner_calls": "schedule-calls",
  "pdf_reports": "reports",
  "owner_statements": "reports",
};

interface Feature {
  id: string;
  feature_key: string;
  title: string;
  description: string;
  screenshot_url: string | null;
  category: string;
  relevant_for_onboarding: boolean;
  relevant_for_active: boolean;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  second_owner_name: string | null;
  second_owner_email: string | null;
  last_feature_email_sent: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
  rental_type: string | null;
}

function getScreenshotUrl(featureKey: string): string | null {
  const screenshotKey = FEATURE_KEY_TO_SCREENSHOT[featureKey];
  if (screenshotKey && FEATURE_SCREENSHOTS[screenshotKey]) {
    return FEATURE_SCREENSHOTS[screenshotKey];
  }
  return null;
}

function generateWhatsNewEmail(
  ownerName: string,
  secondOwnerName: string | null,
  propertyName: string,
  features: Feature[],
  hasBookings: boolean,
  isOnboarding: boolean,
  portalUrl: string
): string {
  const greeting = secondOwnerName 
    ? `${ownerName.split(' ')[0]} & ${secondOwnerName.split(' ')[0]}`
    : ownerName.split(' ')[0];

  let personalizedText = '';
  let featuresForYou: Feature[] = [];
  
  if (isOnboarding) {
    personalizedText = `Since your property is currently in onboarding, you'll especially love tracking your progress and scheduling calls directly from your portal.`;
    featuresForYou = features.filter(f => f.relevant_for_onboarding);
  } else if (hasBookings) {
    personalizedText = `With active bookings at your property, you'll love seeing guest verification details and real-time maintenance updates.`;
    featuresForYou = features.filter(f => f.relevant_for_active && ['security', 'maintenance'].includes(f.category));
  } else {
    personalizedText = `We're working to secure bookings for ${propertyName}—use the Marketing Activity tab to track exactly how we're promoting your property.`;
    featuresForYou = features.filter(f => f.category === 'marketing');
  }

  // Generate feature cards with screenshots
  const featureCards = features.map((feature, index) => {
    const isHighlighted = featuresForYou.some(f => f.id === feature.id);
    const screenshotUrl = getScreenshotUrl(feature.feature_key);
    const isEven = index % 2 === 0;
    
    // Card with screenshot
    if (screenshotUrl) {
      return `
        <tr>
          <td style="padding: 0 0 24px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              <!-- Screenshot -->
              <tr>
                <td style="padding: 0;">
                  <img src="${screenshotUrl}" alt="${feature.title}" style="width: 100%; height: auto; display: block; border-radius: 16px 16px 0 0;" />
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td>
                        ${isHighlighted ? '<span style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">✨ Perfect for You</span>' : ''}
                        <h3 style="margin: ${isHighlighted ? '12px' : '0'} 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                          ${feature.title}
                        </h3>
                        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #475569;">
                          ${feature.description}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }
    
    // Card without screenshot (compact)
    return `
      <tr>
        <td style="padding: 0 0 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${isHighlighted ? 'linear-gradient(135deg, #eff6ff, #f0f9ff)' : '#f8fafc'}; border-radius: 12px; border: 1px solid ${isHighlighted ? '#bfdbfe' : '#e2e8f0'};">
            <tr>
              <td style="padding: 20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="48" valign="top">
                      <div style="width: 40px; height: 40px; background: ${isHighlighted ? '#3b82f6' : '#e2e8f0'}; color: ${isHighlighted ? '#ffffff' : '#64748b'}; border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px;">
                        ${isHighlighted ? '⭐' : '✓'}
                      </div>
                    </td>
                    <td style="padding-left: 16px;">
                      <h3 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 600; color: #0f172a;">
                        ${feature.title}
                      </h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #475569;">
                        ${feature.description}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>What's New at PeachHaus</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 48px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" style="height: 40px; width: auto;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-size: 11px; font-weight: 600; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Product Update
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Card -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; overflow: hidden;">
                <tr>
                  <td style="padding: 48px 40px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500; color: #94a3b8; letter-spacing: 0.5px;">
                      Hi ${greeting} 👋
                    </p>
                    <h1 style="margin: 0 0 16px 0; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: -0.03em; line-height: 1.2;">
                      Your Owner Portal<br/>Just Got Better
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #cbd5e1; line-height: 1.6;">
                      We've been building new features to give you complete transparency into how we manage <strong style="color: #ffffff;">${propertyName}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Personalized Note -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #dbeafe, #e0e7ff); border-radius: 14px; border-left: 4px solid #3b82f6;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0; font-size: 15px; color: #1e40af; line-height: 1.6;">
                      💡 <em>"${personalizedText}"</em>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Features Section Header -->
          <tr>
            <td style="padding: 16px 0;">
              <h2 style="margin: 0; font-size: 13px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase;">
                ✨ New Features
              </h2>
            </td>
          </tr>

          <!-- Feature Cards with Screenshots -->
          ${featureCards}

          <!-- Primary CTA -->
          <tr>
            <td style="padding: 24px 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 18px 56px; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; letter-spacing: -0.01em; box-shadow: 0 4px 14px rgba(15,23,42,0.25);">
                      Open Your Portal →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact Card -->
          <tr>
            <td style="padding: 0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <tr>
                  <td style="padding: 32px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                      Questions? We're here.
                    </h3>
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                      Reply to this email, leave a voicemail in your portal, or text us anytime.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 10px;">
                          <a href="${portalUrl}#messages" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            🎤 Voicemail
                          </a>
                        </td>
                        <td style="padding-right: 10px;">
                          <a href="sms:+14048005932" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            💬 Text Us
                          </a>
                        </td>
                        <td>
                          <a href="${portalUrl}#schedule" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            📞 Schedule Call
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: #334155;">
                Thank you for your partnership.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
                Anja & Ingo · <span style="color: #94a3b8;">Co-Founders, PeachHaus Group</span>
              </p>
              <p style="margin: 0 0 20px 0; font-size: 12px; color: #94a3b8;">
                (404) 800-5932 · info@peachhausgroup.com
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                © ${new Date().getFullYear()} PeachHaus Group LLC. All rights reserved.<br/>
                You're receiving this because you're a valued property owner partner.
              </p>
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { owner_id, property_id, test_email, force_send } = await req.json();

    if (!owner_id || !property_id) {
      throw new Error("owner_id and property_id are required");
    }

    console.log(`Sending What's New email for owner ${owner_id}, property ${property_id}`);

    // Fetch owner details
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, second_owner_name, second_owner_email, last_feature_email_sent")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) {
      throw new Error(`Owner not found: ${ownerError?.message}`);
    }

    // Fetch property details
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, name, address, rental_type")
      .eq("id", property_id)
      .single();

    if (propError || !property) {
      throw new Error(`Property not found: ${propError?.message}`);
    }

    // Check if property is in onboarding
    const { data: onboardingProject } = await supabase
      .from("onboarding_projects")
      .select("id, status")
      .eq("property_id", property_id)
      .maybeSingle();

    const isOnboarding = onboardingProject && onboardingProject.status !== 'completed';

    // Check if property has bookings
    const { count: bookingCount } = await supabase
      .from("ownerrez_bookings")
      .select("*", { count: "exact", head: true })
      .eq("property_id", property_id);

    const hasBookings = (bookingCount || 0) > 0;

    // Fetch features - if force_send, get all features; otherwise only new since last email
    const lastEmailDate = force_send ? '2020-01-01T00:00:00Z' : (owner.last_feature_email_sent || '2024-01-01T00:00:00Z');
    
    const { data: features, error: featuresError } = await supabase
      .from("feature_changelog")
      .select("*")
      .gte("released_at", lastEmailDate)
      .order("released_at", { ascending: false });

    if (featuresError) {
      throw new Error(`Error fetching features: ${featuresError.message}`);
    }

    // If no features found and force_send, get the latest features anyway
    let featuresToSend = features || [];
    if (force_send && featuresToSend.length === 0) {
      console.log("Force send: fetching all features");
      const { data: allFeatures } = await supabase
        .from("feature_changelog")
        .select("*")
        .order("released_at", { ascending: false })
        .limit(8);
      featuresToSend = allFeatures || [];
    }

    if (featuresToSend.length === 0 && !force_send) {
      console.log("No new features since last email");
      return new Response(
        JSON.stringify({ success: false, message: "No new features to announce" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter features based on owner status (skip filter if force_send with all features)
    let relevantFeatures = featuresToSend;
    if (!force_send) {
      relevantFeatures = featuresToSend.filter(f => {
        if (isOnboarding) return f.relevant_for_onboarding;
        return f.relevant_for_active;
      });
    } else {
      // For force_send, include features relevant to either type
      relevantFeatures = featuresToSend.filter(f => f.relevant_for_onboarding || f.relevant_for_active);
    }

    if (relevantFeatures.length === 0 && !force_send) {
      console.log("No relevant features for this owner type");
      return new Response(
        JSON.stringify({ success: false, message: "No relevant features for this owner" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // If still no features after filtering, use what we have
    if (relevantFeatures.length === 0) {
      relevantFeatures = featuresToSend;
    }

    // Generate portal URL with magic link
    const token = crypto.randomUUID();
    const { error: sessionError } = await supabase
      .from("owner_portal_sessions")
      .insert({
        owner_id: owner.id,
        email: owner.email,
        token,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        property_id: property.id,
        property_name: property.name,
      });

    if (sessionError) {
      console.error("Error creating session:", sessionError);
    }

    const baseUrl = "https://propertycentral.lovable.app";
    const portalUrl = `${baseUrl}/owner?token=${token}`;

    // Generate email HTML
    const emailHtml = generateWhatsNewEmail(
      owner.name,
      owner.second_owner_name,
      property.name,
      relevantFeatures,
      hasBookings,
      isOnboarding || false,
      portalUrl
    );

    // Prepare recipients
    const toEmails = [test_email || owner.email];
    if (!test_email && owner.second_owner_email) {
      toEmails.push(owner.second_owner_email);
    }

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus <updates@peachhausgroup.com>",
        to: toEmails,
        subject: `🚀 What's New at PeachHaus: ${relevantFeatures.length} New Features for ${property.name}`,
        html: emailHtml,
        reply_to: "info@peachhausgroup.com",
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      throw new Error(`Resend API error: ${errorText}`);
    }

    const resendResult = await resendResponse.json();
    console.log("Email sent successfully:", resendResult);

    // Update owner's last_feature_email_sent timestamp
    if (!test_email) {
      await supabase
        .from("property_owners")
        .update({ last_feature_email_sent: new Date().toISOString() })
        .eq("id", owner.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `What's New email sent to ${toEmails.join(", ")}`,
        features_count: relevantFeatures.length,
        email_id: resendResult.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-whats-new-email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
