import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function generateWhatsNewEmail(
  ownerName: string,
  secondOwnerName: string | null,
  propertyName: string,
  features: Feature[],
  hasBookings: boolean,
  isOnboarding: boolean,
  portalUrl: string
): string {
  // Personalized greeting
  const greeting = secondOwnerName 
    ? `${ownerName.split(' ')[0]} & ${secondOwnerName.split(' ')[0]}`
    : ownerName.split(' ')[0];

  // Personalization text based on status
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

  // Generate feature list HTML (clean, minimal Fortune 500 style)
  const featureList = features.map((feature) => {
    const isHighlighted = featuresForYou.some(f => f.id === feature.id);
    
    return `
      <tr>
        <td style="padding: 24px 0; border-bottom: 1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="60" valign="top">
                <div style="width: 48px; height: 48px; background: ${isHighlighted ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : '#f1f5f9'}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 20px;">${isHighlighted ? '⭐' : '✓'}</span>
                </div>
              </td>
              <td style="padding-left: 16px;">
                <h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 600; color: #0f172a; letter-spacing: -0.02em;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Minimal Header -->
          <tr>
            <td style="padding: 0 0 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" style="height: 36px; width: auto;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 12px; font-weight: 500; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">
                      Owner Update
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Card -->
          <tr>
            <td style="background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 30px rgba(0,0,0,0.04);">
              
              <!-- Hero -->
              <tr>
                <td style="padding: 48px 40px 32px 40px;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #3b82f6; letter-spacing: 0.5px; text-transform: uppercase;">
                    Product Update
                  </p>
                  <h1 style="margin: 0 0 16px 0; font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: -0.03em; line-height: 1.2;">
                    Your Portal Just Got Better
                  </h1>
                  <p style="margin: 0; font-size: 17px; color: #475569; line-height: 1.6;">
                    Hi ${greeting}, we've been working on new features designed to give you complete transparency into how we manage <strong style="color: #0f172a;">${propertyName}</strong>.
                  </p>
                </td>
              </tr>

              <!-- Personalized Note -->
              <tr>
                <td style="padding: 0 40px 32px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f0f9ff; border-radius: 12px; border-left: 4px solid #3b82f6;">
                    <tr>
                      <td style="padding: 20px 24px;">
                        <p style="margin: 0; font-size: 15px; color: #0369a1; line-height: 1.6; font-style: italic;">
                          "${personalizedText}"
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Features Section -->
              <tr>
                <td style="padding: 0 40px;">
                  <h2 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase;">
                    What's New
                  </h2>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    ${featureList}
                  </table>
                </td>
              </tr>

              <!-- Primary CTA -->
              <tr>
                <td style="padding: 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="${portalUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none; letter-spacing: -0.01em;">
                          Open Your Portal
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Contact Section (Fortune 500 style) -->
              <tr>
                <td style="padding: 0 40px 40px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8fafc; border-radius: 12px;">
                    <tr>
                      <td style="padding: 32px;">
                        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                          Questions? We're here.
                        </h3>
                        <p style="margin: 0 0 20px 0; font-size: 15px; color: #64748b; line-height: 1.6;">
                          Reply to this email, leave a voicemail in your portal, or text us anytime.
                        </p>
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding-right: 12px;">
                              <a href="${portalUrl}#messages" style="display: inline-block; background: #ffffff; color: #0f172a; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1px solid #e2e8f0;">
                                🎤 Leave Voicemail
                              </a>
                            </td>
                            <td style="padding-right: 12px;">
                              <a href="sms:+14048005932" style="display: inline-block; background: #ffffff; color: #0f172a; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1px solid #e2e8f0;">
                                💬 Text Us
                              </a>
                            </td>
                            <td>
                              <a href="${portalUrl}#schedule-call" style="display: inline-block; background: #ffffff; color: #0f172a; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; border: 1px solid #e2e8f0;">
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

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 500; color: #334155;">
                Thank you for your partnership.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b;">
                Anja & Ingo<br/>
                <span style="color: #94a3b8;">Co-Founders, PeachHaus Group</span>
              </p>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                (404) 800-5932 · info@peachhausgroup.com
              </p>
            </td>
          </tr>

          <!-- Legal -->
          <tr>
            <td style="padding: 24px 0 0 0; border-top: 1px solid #e2e8f0; text-align: center;">
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
    const { owner_id, property_id, test_email } = await req.json();

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

    // Fetch features new since last email
    const lastEmailDate = owner.last_feature_email_sent || '2024-01-01T00:00:00Z';
    
    const { data: features, error: featuresError } = await supabase
      .from("feature_changelog")
      .select("*")
      .gte("released_at", lastEmailDate)
      .order("released_at", { ascending: false });

    if (featuresError) {
      throw new Error(`Error fetching features: ${featuresError.message}`);
    }

    if (!features || features.length === 0) {
      console.log("No new features since last email");
      return new Response(
        JSON.stringify({ success: false, message: "No new features to announce" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter features based on owner status
    const relevantFeatures = features.filter(f => {
      if (isOnboarding) return f.relevant_for_onboarding;
      return f.relevant_for_active;
    });

    if (relevantFeatures.length === 0) {
      console.log("No relevant features for this owner type");
      return new Response(
        JSON.stringify({ success: false, message: "No relevant features for this owner" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
