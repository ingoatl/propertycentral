import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Beautiful SVG icons for each feature category
const FEATURE_ICONS: Record<string, { svg: string; color: string; bgColor: string }> = {
  communication: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    color: '#3b82f6',
    bgColor: '#eff6ff'
  },
  maintenance: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    color: '#22c55e',
    bgColor: '#f0fdf4'
  },
  security: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    color: '#8b5cf6',
    bgColor: '#f5f3ff'
  },
  marketing: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
    color: '#f59e0b',
    bgColor: '#fffbeb'
  },
  reports: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    color: '#ef4444',
    bgColor: '#fef2f2'
  },
  scheduling: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    color: '#06b6d4',
    bgColor: '#ecfeff'
  },
  analytics: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    color: '#ec4899',
    bgColor: '#fdf2f8'
  },
  audio: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    color: '#f97316',
    bgColor: '#fff7ed'
  },
  onboarding: {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    color: '#10b981',
    bgColor: '#ecfdf5'
  }
};

// Map feature_key to icon category
function getIconCategory(featureKey: string, category: string): string {
  const keyLower = featureKey.toLowerCase();
  if (keyLower.includes('message') || keyLower.includes('voicemail') || keyLower.includes('sms')) return 'communication';
  if (keyLower.includes('maintenance') || keyLower.includes('repair') || keyLower.includes('work_order')) return 'maintenance';
  if (keyLower.includes('screen') || keyLower.includes('verify') || keyLower.includes('security')) return 'security';
  if (keyLower.includes('market') || keyLower.includes('social') || keyLower.includes('listing')) return 'marketing';
  if (keyLower.includes('report') || keyLower.includes('statement') || keyLower.includes('pdf')) return 'reports';
  if (keyLower.includes('call') || keyLower.includes('schedule') || keyLower.includes('calendar')) return 'scheduling';
  if (keyLower.includes('recap') || keyLower.includes('voice') || keyLower.includes('audio')) return 'audio';
  if (keyLower.includes('onboard') || keyLower.includes('timeline') || keyLower.includes('progress')) return 'onboarding';
  if (keyLower.includes('analytic') || keyLower.includes('metric') || keyLower.includes('performance')) return 'analytics';
  
  // Fallback to category
  if (category) return category.toLowerCase();
  return 'reports';
}

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

  // Generate icon-based feature cards
  const featureCards = features.map((feature, index) => {
    const isHighlighted = featuresForYou.some(f => f.id === feature.id);
    const iconCategory = getIconCategory(feature.feature_key, feature.category);
    const iconData = FEATURE_ICONS[iconCategory] || FEATURE_ICONS.reports;
    
    return `
      <tr>
        <td style="padding: 0 0 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid ${isHighlighted ? iconData.color + '40' : '#e2e8f0'}; ${isHighlighted ? 'box-shadow: 0 4px 12px ' + iconData.color + '15;' : ''}">
            <tr>
              <td style="padding: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <!-- Icon Container -->
                    <td width="60" valign="top">
                      <div style="width: 52px; height: 52px; background: ${iconData.bgColor}; border-radius: 14px; text-align: center; line-height: 52px;">
                        <img src="data:image/svg+xml;base64,${btoa(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="${iconData.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconData.svg.replace(/<\/?svg[^>]*>/g, '')}</svg>`)}" width="24" height="24" style="vertical-align: middle;" alt="">
                      </div>
                    </td>
                    <!-- Content -->
                    <td style="padding-left: 16px; vertical-align: top;">
                      ${isHighlighted ? `
                      <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                        <tr>
                          <td style="background: linear-gradient(135deg, ${iconData.color}, ${iconData.color}cc); color: #ffffff; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ✨ Perfect for You
                          </td>
                        </tr>
                      </table>
                      ` : ''}
                      <h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                        ${feature.title}
                      </h3>
                      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
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
                    <span style="display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; font-size: 11px; font-weight: 600; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
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
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 20px; overflow: hidden;">
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

          <!-- Features Count Badge -->
          <tr>
            <td style="padding: 0 0 20px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: #f0fdf4; color: #166534; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 8px; border: 1px solid #bbf7d0;">
                      🚀 ${features.length} New Features
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feature Cards -->
          ${featureCards}

          <!-- Primary CTA -->
          <tr>
            <td style="padding: 24px 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 18px 56px; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; letter-spacing: -0.01em; box-shadow: 0 4px 14px rgba(15,23,42,0.25);">
                      Explore Your Portal →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Help Card -->
          <tr>
            <td style="padding: 0 0 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 28px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 17px; font-weight: 600; color: #0f172a;">
                      Questions? We're here.
                    </h3>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                      Reply to this email, leave a voicemail in your portal, or text us anytime.
                    </p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 10px;">
                          <a href="${portalUrl}#messages" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            🎤 Voicemail
                          </a>
                        </td>
                        <td style="padding-right: 10px;">
                          <a href="sms:+14048005932" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            💬 Text Us
                          </a>
                        </td>
                        <td>
                          <a href="${portalUrl}#schedule" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            📞 Call
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
        .limit(10);
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
