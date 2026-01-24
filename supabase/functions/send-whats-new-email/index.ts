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

  // Generate feature cards HTML (2-column layout)
  const featureCards = features.map((feature, idx) => {
    const isHighlighted = featuresForYou.some(f => f.id === feature.id);
    const badge = isHighlighted ? `<span style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">⭐ For You</span>` : '';
    
    return `
      <tr>
        <td style="padding: 12px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(145deg, #ffffff, #f8fafc); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            ${feature.screenshot_url ? `
            <tr>
              <td style="padding: 0;">
                <img src="${feature.screenshot_url}" alt="${feature.title}" style="width: 100%; height: auto; display: block; border-radius: 12px 12px 0 0;" />
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 20px;">
                <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #1e293b;">
                  ${feature.title}${badge}
                </h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
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
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 0 0 30px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" style="height: 50px; width: auto;" />
                  </td>
                  <td align="right">
                    <span style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">
                      PRODUCT UPDATE 2.0
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a, #1e3a5f); border-radius: 16px; padding: 50px 40px; text-align: center;">
              <h1 style="margin: 0 0 16px 0; font-size: 32px; font-weight: 800; color: white; line-height: 1.2;">
                Your Portal Just Got Smarter
              </h1>
              <p style="margin: 0; font-size: 18px; color: #94a3b8; line-height: 1.6;">
                ${features.length} new features designed for complete transparency
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 0 20px 0;">
              <p style="margin: 0; font-size: 18px; color: #334155; line-height: 1.6;">
                Hi ${greeting},
              </p>
              <p style="margin: 16px 0 0 0; font-size: 16px; color: #64748b; line-height: 1.7;">
                We've been building. Your Owner Portal just received a major upgrade with powerful new features designed to give you unprecedented visibility into how we manage <strong style="color: #334155;">${propertyName}</strong>.
              </p>
            </td>
          </tr>

          <!-- Personalized Section -->
          <tr>
            <td style="padding: 0 0 30px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #dbeafe, #ede9fe); border-radius: 12px; border-left: 4px solid #3b82f6;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: #3b82f6; letter-spacing: 1px;">
                      🎯 TAILORED FOR YOU
                    </p>
                    <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.6;">
                      ${personalizedText}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Features Header -->
          <tr>
            <td style="padding: 0 0 20px 0;">
              <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">
                What's New
              </h2>
            </td>
          </tr>

          <!-- Feature Cards -->
          ${featureCards}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 18px 40px; border-radius: 30px; font-size: 16px; font-weight: 700; text-decoration: none; box-shadow: 0 8px 30px rgba(59, 130, 246, 0.4);">
                      Explore Your Updated Portal →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feedback Section -->
          <tr>
            <td style="background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 40px; margin-bottom: 16px;">💬</div>
                <h3 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #1e293b;">
                  We'd Love Your Feedback
                </h3>
                <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b; line-height: 1.7;">
                  Have questions? Want a walkthrough? We're here for you—choose how you'd like to connect:
                </p>
              </div>
              
              <!-- Communication Options Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 8px;">
                    <a href="${portalUrl}#schedule-call" style="display: block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 16px 20px; border-radius: 12px; text-decoration: none; text-align: center;">
                      <span style="font-size: 24px; display: block; margin-bottom: 6px;">📞</span>
                      <span style="font-size: 14px; font-weight: 600;">Schedule a Call</span>
                      <span style="display: block; font-size: 12px; opacity: 0.9; margin-top: 4px;">Video or phone</span>
                    </a>
                  </td>
                  <td style="padding: 8px;">
                    <a href="mailto:info@peachhausgroup.com?subject=Feedback on ${encodeURIComponent(propertyName)} Portal" style="display: block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 16px 20px; border-radius: 12px; text-decoration: none; text-align: center;">
                      <span style="font-size: 24px; display: block; margin-bottom: 6px;">✉️</span>
                      <span style="font-size: 14px; font-weight: 600;">Send Email</span>
                      <span style="display: block; font-size: 12px; opacity: 0.9; margin-top: 4px;">Reply anytime</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px;">
                    <a href="sms:+14048005932" style="display: block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 16px 20px; border-radius: 12px; text-decoration: none; text-align: center;">
                      <span style="font-size: 24px; display: block; margin-bottom: 6px;">💬</span>
                      <span style="font-size: 14px; font-weight: 600;">Text Us</span>
                      <span style="display: block; font-size: 12px; opacity: 0.9; margin-top: 4px;">(404) 800-5932</span>
                    </a>
                  </td>
                  <td style="padding: 8px;">
                    <a href="${portalUrl}#messages" style="display: block; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 16px 20px; border-radius: 12px; text-decoration: none; text-align: center;">
                      <span style="font-size: 24px; display: block; margin-bottom: 6px;">🎤</span>
                      <span style="font-size: 14px; font-weight: 600;">Leave Voicemail</span>
                      <span style="display: block; font-size: 12px; opacity: 0.9; margin-top: 4px;">In your portal</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #334155;">
                Thank you for trusting PeachHaus with your property.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #64748b;">
                Warm regards,<br/>
                <strong>Anja & Ingo</strong><br/>
                PeachHaus Group
              </p>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                (404) 800-5932 &nbsp;|&nbsp; info@peachhausgroup.com
              </p>
            </td>
          </tr>

          <!-- Legal -->
          <tr>
            <td style="padding: 20px 0 0 0; border-top: 1px solid #e2e8f0; text-align: center;">
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
