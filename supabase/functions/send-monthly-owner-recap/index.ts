import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// Helper to encode UTF-8 string to base64 (works with non-Latin1 characters)
function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const elevenLabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
const ghlApiKey = Deno.env.get("GHL_API_KEY");
const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

// Sarah voice - professional, natural-sounding
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

// Helper: Number to spoken words for TTS
function numberToWords(num: number): string {
  if (num === 0) return "zero";
  
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
                "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", 
                "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  
  function convertHundreds(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return tens[ten] + (one ? " " + ones[one] : "");
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return ones[hundred] + " hundred" + (remainder ? " " + convertHundreds(remainder) : "");
  }
  
  if (num < 0) return "negative " + numberToWords(Math.abs(num));
  
  const rounded = Math.round(num);
  
  if (rounded >= 1000000) {
    const millions = Math.floor(rounded / 1000000);
    const remainder = rounded % 1000000;
    return numberToWords(millions) + " million" + (remainder ? " " + numberToWords(remainder) : "");
  }
  
  if (rounded >= 1000) {
    const thousands = Math.floor(rounded / 1000);
    const remainder = rounded % 1000;
    return numberToWords(thousands) + " thousand" + (remainder ? " " + numberToWords(remainder) : "");
  }
  
  return convertHundreds(rounded);
}

function formatCurrencyForTTS(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "zero dollars";
  return numberToWords(rounded) + " dollars";
}

function formatPercentForTTS(percent: number): string {
  const rounded = Math.round(percent);
  return numberToWords(rounded) + " percent";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Get owner's first name(s)
function getOwnerFirstNames(name: string, secondName?: string | null): string {
  const firstName1 = name?.split(' ')[0] || "there";
  const firstName2 = secondName?.split(' ')[0];
  if (firstName2 && firstName2 !== firstName1) {
    return `${firstName1} and ${firstName2}`;
  }
  return firstName1;
}

// Check if today is the last day of the month
function isLastDayOfMonth(): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

// Get previous month name
function getPreviousMonthName(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toLocaleString('default', { month: 'long' });
}

function getPreviousMonthStart(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Generate voice script based on property data
function generateVoiceScript(
  propertyName: string,
  ownerNames: string,
  rentalType: string | null,
  metrics: any,
  marketingStats: any,
  hasBookings: boolean,
  onboardingStage: string | null
): string {
  const previousMonthName = getPreviousMonthName();
  
  // Check if still onboarding
  if (onboardingStage && onboardingStage !== 'ops_handoff') {
    return composeOnboardingScript(ownerNames, propertyName, onboardingStage, rentalType, marketingStats);
  }
  
  // No bookings yet
  if (!hasBookings) {
    return composeNoBookingsScript(ownerNames, propertyName, rentalType, marketingStats);
  }
  
  // Performance recap
  return composePerformanceRecapScript(ownerNames, propertyName, previousMonthName, rentalType, metrics, marketingStats);
}

function composeOnboardingScript(
  ownerNames: string,
  propertyName: string,
  stage: string,
  rentalType: string | null,
  marketingStats: any
): string {
  const isHybrid = rentalType === "hybrid";
  let script = `Hi ${ownerNames}, welcome to PeachHaus! We're excited to be partnering with you on ${propertyName}. `;
  
  const callsMade = marketingStats?.calls_made || 0;
  
  if (isHybrid) {
    script += `Our marketing team is already building your property's digital presence. We've begun drafting your listing copy and identifying the best platforms to showcase your home. `;
    if (callsMade > 0) {
      script += `We've also made ${callsMade} outreach calls to corporate housing coordinators, building relationships for quality bookings. `;
    }
  } else {
    script += `Our team is already reaching out to corporate housing coordinators, insurance adjusters, and relocation specialists in your area. `;
    if (callsMade > 0) {
      script += `So far, we've contacted ${callsMade} companies to start generating interest. `;
    }
  }
  
  script += `Thank you for trusting PeachHaus. We're here to make this process smooth and get you earning as quickly as possible.`;
  return script;
}

function composeNoBookingsScript(
  ownerNames: string,
  propertyName: string,
  rentalType: string | null,
  marketingStats: any
): string {
  const isHybrid = rentalType === "hybrid";
  const callsMade = marketingStats?.calls_made || 0;
  const totalSocialPosts = (marketingStats?.instagram_posts || 0) + 
    (marketingStats?.instagram_stories || 0) + 
    (marketingStats?.facebook_posts || 0) + 
    (marketingStats?.gmb_posts || 0);
  const totalReach = marketingStats?.total_reach || 0;
  
  let script = `Hi ${ownerNames}, here's your update for ${propertyName}. `;
  
  if (isHybrid) {
    script += `Your property is now live and our marketing machine is in full gear. `;
    if (totalSocialPosts > 0) {
      if (totalReach > 1000) {
        script += `This month, we've posted ${totalSocialPosts} times across social media, reaching over ${Math.round(totalReach / 1000)} thousand potential guests. `;
      } else {
        script += `This month, we've made ${totalSocialPosts} social media posts to promote your property. `;
      }
    }
    if (callsMade > 0) {
      script += `We've also made ${callsMade} outreach calls to corporate housing coordinators. `;
    }
    script += `New listings typically take 30 to 60 days to gain full visibility in search results. We're using this time strategically to attract your first guests. `;
  } else {
    script += `Your property is market-ready and we're actively working to place your first quality tenant. `;
    if (callsMade > 0) {
      script += `This month, we've contacted ${callsMade} corporate housing companies and relocation specialists. `;
    }
  }
  
  script += `Thank you for your trust in PeachHaus. We'll be in touch as soon as that first booking comes through.`;
  return script;
}

function composePerformanceRecapScript(
  ownerNames: string,
  propertyName: string,
  monthName: string,
  rentalType: string | null,
  metrics: any,
  marketingStats: any
): string {
  const isHybrid = rentalType === "hybrid";
  const isMidTerm = rentalType === "mid_term";
  
  const totalRevenue = metrics?.totalRevenue || 0;
  const strRevenue = metrics?.strRevenue || 0;
  const mtrRevenue = metrics?.mtrRevenue || 0;
  const occupancy = metrics?.occupancyRate || 0;
  const avgRating = metrics?.averageRating || 0;
  const reviewCount = metrics?.reviewCount || 0;
  const strBookings = metrics?.strBookings || 0;
  const callsMade = marketingStats?.calls_made || 0;
  const totalSocialPosts = (marketingStats?.instagram_posts || 0) + 
    (marketingStats?.instagram_stories || 0) + 
    (marketingStats?.facebook_posts || 0) + 
    (marketingStats?.gmb_posts || 0);
  const totalReach = marketingStats?.total_reach || 0;
  
  let script = `Hi ${ownerNames}, here's your ${monthName} performance recap for ${propertyName}. `;
  
  if (isHybrid) {
    if (totalRevenue > 0) {
      script += `Last month, your property earned ${formatCurrencyForTTS(totalRevenue)} in total revenue`;
      if (strRevenue > 0 && mtrRevenue > 0) {
        script += ` — ${formatCurrencyForTTS(strRevenue)} from short-term bookings and ${formatCurrencyForTTS(mtrRevenue)} from an extended stay guest`;
      }
      script += `. `;
    }
    
    if (occupancy > 0) {
      script += `Your occupancy reached ${formatPercentForTTS(occupancy)}`;
      if (strBookings > 0) {
        script += ` with ${numberToWords(strBookings)} completed short-term stays`;
      }
      script += `. `;
    }
    
    if (avgRating > 0) {
      script += `Your guests love your property — you're averaging ${avgRating.toFixed(1)} stars`;
      if (reviewCount > 0) {
        script += ` across ${reviewCount} reviews`;
      }
      script += `. `;
    }
    
    if (totalSocialPosts > 0 || callsMade > 0) {
      script += `On the marketing side, `;
      if (totalSocialPosts > 0 && totalReach > 1000) {
        script += `we made ${totalSocialPosts} social media posts reaching over ${Math.round(totalReach / 1000)} thousand travelers`;
      }
      if (callsMade > 0) {
        script += totalSocialPosts > 0 ? `, and made ${callsMade} outreach calls` : `we made ${callsMade} outreach calls`;
      }
      script += `. `;
    }
    
  } else if (isMidTerm) {
    if (totalRevenue > 0) {
      script += `Last month, your property generated ${formatCurrencyForTTS(totalRevenue)} in rental income. `;
    }
    script += `Your current tenant remains in excellent standing with consistent on-time payments. `;
    
    if (callsMade > 0) {
      script += `We conducted ${callsMade} outreach calls to corporate housing coordinators, building relationships for future tenants. `;
    }
    
  } else {
    if (totalRevenue > 0) {
      script += `Last month, your property generated ${formatCurrencyForTTS(totalRevenue)} in rental income. `;
    }
    if (avgRating > 0) {
      script += `Your property is rated ${avgRating.toFixed(1)} stars. `;
    }
  }
  
  script += `Thank you for trusting PeachHaus with your property — we're always working behind the scenes to maximize your returns.`;
  return script;
}

// Generate SVG occupancy gauge for email
function generateOccupancyGauge(occupancy: number): string {
  const pct = Math.min(100, Math.max(0, occupancy));
  const angle = (pct / 100) * 180;
  const rad = (angle - 90) * (Math.PI / 180);
  const x = 50 + 35 * Math.cos(rad);
  const y = 50 + 35 * Math.sin(rad);
  const largeArc = angle > 90 ? 1 : 0;
  
  // Color based on occupancy
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  
  return `
    <svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <!-- Background arc -->
      <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="#e5e7eb" stroke-width="8" stroke-linecap="round"/>
      <!-- Colored arc -->
      <path d="M 15 50 A 35 35 0 ${largeArc} 1 ${x} ${y}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
      <!-- Center text -->
      <text x="50" y="48" text-anchor="middle" font-size="18" font-weight="700" fill="#1f2937">${Math.round(pct)}%</text>
    </svg>
  `;
}

// Generate SVG star rating for email
function generateStarRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  let stars = '';
  
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars += '<text x="' + (i * 18 + 9) + '" y="14" font-size="16" fill="#f59e0b">★</text>';
    } else if (i === fullStars && hasHalf) {
      stars += '<text x="' + (i * 18 + 9) + '" y="14" font-size="16" fill="#f59e0b">★</text>';
    } else {
      stars += '<text x="' + (i * 18 + 9) + '" y="14" font-size="16" fill="#d1d5db">★</text>';
    }
  }
  
  return `<svg width="90" height="18" viewBox="0 0 90 18" xmlns="http://www.w3.org/2000/svg">${stars}</svg>`;
}

// Generate Fortune 500 style email HTML with visual diagrams
function generateEmailHtml(
  ownerName: string,
  secondOwnerName: string | null,
  propertyName: string,
  propertyAddress: string,
  metrics: any,
  marketingStats: any,
  audioUrl: string,
  portalUrl: string,
  monthName: string,
  recapId: string
): string {
  const year = new Date().getFullYear();
  
  const ownerGreeting = secondOwnerName 
    ? `${ownerName?.split(' ')[0]} & ${secondOwnerName?.split(' ')[0]}`
    : ownerName?.split(' ')[0] || 'Valued Owner';
  
  const totalRevenue = metrics?.totalRevenue || 0;
  const strRevenue = metrics?.strRevenue || 0;
  const mtrRevenue = metrics?.mtrRevenue || 0;
  const occupancy = metrics?.occupancyRate || 0;
  const avgRating = metrics?.averageRating || 0;
  const reviewCount = metrics?.reviewCount || 0;
  const strBookings = metrics?.strBookings || 0;
  const mtrBookings = metrics?.mtrBookings || 0;
  
  const totalSocialPosts = (marketingStats?.instagram_posts || 0) + 
    (marketingStats?.instagram_stories || 0) + 
    (marketingStats?.facebook_posts || 0) + 
    (marketingStats?.gmb_posts || 0);
  const callsMade = marketingStats?.calls_made || 0;
  const totalReach = marketingStats?.total_reach || 0;

  // Determine if this is a new property with no data
  const isNewProperty = totalRevenue === 0 && occupancy === 0 && strBookings === 0 && mtrBookings === 0;

  // Generate inline SVG for occupancy (no external images needed)
  const occupancyPct = Math.min(100, Math.max(0, occupancy));
  const occupancyColor = occupancyPct >= 80 ? '#22c55e' : occupancyPct >= 50 ? '#f59e0b' : '#ef4444';
  const occupancyLabel = occupancyPct >= 80 ? 'Excellent' : occupancyPct >= 50 ? 'Good' : occupancyPct > 0 ? 'Building' : 'Getting started';

  // Generate star rating display
  const fullStars = Math.floor(avgRating);
  const hasHalf = avgRating - fullStars >= 0.5;
  let starDisplay = '';
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      starDisplay += '★';
    } else if (i === fullStars && hasHalf) {
      starDisplay += '★';
    } else {
      starDisplay += '☆';
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Performance Recap - ${propertyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" height="36" style="display: block;">
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background: rgba(255,255,255,0.15); color: #ffffff; font-size: 11px; font-weight: 600; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${monthName} ${year}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Property Info -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; border-bottom: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">${propertyName}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${propertyAddress}</p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <p style="margin: 0; font-size: 16px; color: #334155;">Dear ${ownerGreeting},</p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                Here's your ${monthName} performance summary. ${totalRevenue > 0 ? 'Great month!' : 'We\'re working hard to maximize your returns.'}
              </p>
            </td>
          </tr>
          
          ${isNewProperty ? `
          <!-- New Property Message -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border: 1px solid #fbbf24;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 24px;">🏠</p>
                    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #92400e;">
                      Your Property is Getting Set Up
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #a16207; line-height: 1.5;">
                      We're actively preparing your listing and reaching out to potential guests. Full performance metrics will appear after your first bookings!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : `
          <!-- Total Revenue Hero -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); border-radius: 14px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.85); font-weight: 600;">Total Revenue</p>
                    <p style="margin: 12px 0 0 0; font-size: 48px; font-weight: 700; color: #ffffff; letter-spacing: -2px;">${formatCurrency(totalRevenue)}</p>
                    ${strRevenue > 0 && mtrRevenue > 0 ? `
                    <p style="margin: 10px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.8);">
                      ${formatCurrency(strRevenue)} STR + ${formatCurrency(mtrRevenue)} MTR
                    </p>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Metrics Grid -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Occupancy -->
                  <td width="48%" style="vertical-align: top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 24px; text-align: center;">
                          <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Occupancy</p>
                          <p style="margin: 0; font-size: 36px; font-weight: 700; color: ${occupancyColor};">${Math.round(occupancyPct)}%</p>
                          <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">${occupancyLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="4%"></td>
                  <!-- Guest Rating -->
                  <td width="48%" style="vertical-align: top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 24px; text-align: center;">
                          <p style="margin: 0 0 12px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Guest Rating</p>
                          ${avgRating > 0 ? `
                          <p style="margin: 0; font-size: 36px; font-weight: 700; color: #0f172a;">${avgRating.toFixed(1)}</p>
                          <p style="margin: 6px 0 0 0; font-size: 16px; color: #f59e0b; letter-spacing: 2px;">${starDisplay}</p>
                          <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">${reviewCount} review${reviewCount !== 1 ? 's' : ''}</p>
                          ` : `
                          <p style="margin: 0; font-size: 28px; color: #94a3b8;">—</p>
                          <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">No reviews yet</p>
                          `}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}
          
          <!-- Bookings Summary -->
          ${(strBookings > 0 || mtrBookings > 0) ? `
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 18px 24px;">
                    <p style="margin: 0; font-size: 14px; color: #166534;">
                      <strong>📅 Bookings:</strong>
                      ${strBookings > 0 ? `${strBookings} short-term stay${strBookings !== 1 ? 's' : ''}` : ''}
                      ${strBookings > 0 && mtrBookings > 0 ? ' + ' : ''}
                      ${mtrBookings > 0 ? `${mtrBookings} mid-term tenant${mtrBookings !== 1 ? 's' : ''}` : ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Marketing Activities -->
          ${(totalSocialPosts > 0 || callsMade > 0) ? `
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); border-radius: 12px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #1e40af;">📣 Marketing Activity</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${totalSocialPosts > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e3a8a;">
                          📱 <strong>${totalSocialPosts}</strong> social posts
                          ${totalReach > 0 ? ` reaching <span style="color: #3b82f6; font-weight: 600;">${totalReach.toLocaleString()}</span> travelers` : ''}
                        </td>
                      </tr>
                      ` : ''}
                      ${callsMade > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; font-size: 14px; color: #1e3a8a;">
                          📞 <strong>${callsMade}</strong> corporate outreach calls
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Voice Recap CTA -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 14px; overflow: hidden;">
                <tr>
                  <td style="padding: 28px 32px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-size: 24px;">🎧</p>
                    <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.95);">Listen to Your Personalized Voice Recap</p>
                    <a href="https://propertycentral.lovable.app/recap/${recapId}" style="display: inline-block; background-color: #ffffff; color: #ea580c; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 40px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">▶ Play Audio Summary</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Portal CTA -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 10px; box-shadow: 0 4px 12px rgba(15,23,42,0.2);">View Full Dashboard →</a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 28px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #334155;">Thank you for trusting PeachHaus with your property.</p>
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                Warm regards,<br>
                <strong>Anja & Ingo</strong><br>
                PeachHaus Group<br>
                (404) 800-5932 · info@peachhausgroup.com
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

// Send email via Resend
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  cc?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!resendApiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus <info@peachhausgroup.com>",
        to: [to],
        cc: cc ? [cc] : undefined,
        subject,
        html,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Generate audio via ElevenLabs
async function generateAudio(text: string): Promise<{ audioBuffer?: ArrayBuffer; error?: string }> {
  if (!elevenLabsApiKey) {
    return { error: "ELEVENLABS_API_KEY not configured" };
  }
  
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      return { error: `ElevenLabs error: ${error}` };
    }
    
    const audioBuffer = await response.arrayBuffer();
    return { audioBuffer };
  } catch (error) {
    return { error: String(error) };
  }
}

// Find or create GHL contact by phone
async function findOrCreateGhlContact(
  phone: string,
  name: string,
  email?: string
): Promise<{ contactId: string | null; error?: string }> {
  if (!ghlApiKey || !ghlLocationId) {
    return { contactId: null, error: "GHL not configured" };
  }

  try {
    // Format phone
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '1' + formattedPhone;
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    // Search for existing contact
    const searchUrl = `https://services.leadconnectorhq.com/contacts/search`;
    const searchResponse = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",
      },
      body: JSON.stringify({
        locationId: ghlLocationId,
        query: formattedPhone,
        limit: 1,
      }),
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contacts && searchData.contacts.length > 0) {
        console.log(`Found existing GHL contact: ${searchData.contacts[0].id}`);
        return { contactId: searchData.contacts[0].id };
      }
    }

    // Create new contact if not found
    console.log(`Creating new GHL contact for ${formattedPhone}`);
    const createResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Content-Type": "application/json",
          "Version": "2021-07-28",
        },
        body: JSON.stringify({
          locationId: ghlLocationId,
          phone: formattedPhone,
          name: name,
          email: email || undefined,
          tags: ["property-owner", "recap-recipient"],
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error(`GHL contact creation failed: ${error}`);
      return { contactId: null, error: `Contact creation failed: ${error}` };
    }

    const createData = await createResponse.json();
    console.log(`Created GHL contact: ${createData.contact?.id}`);
    return { contactId: createData.contact?.id || null };
  } catch (error) {
    console.error(`GHL contact error: ${error}`);
    return { contactId: null, error: String(error) };
  }
}

// Send SMS via GHL
async function sendSms(
  phone: string,
  message: string,
  ownerName: string,
  ownerEmail?: string
): Promise<{ success: boolean; error?: string }> {
  if (!ghlApiKey || !ghlLocationId) {
    console.error("GHL API not configured - missing API key or location ID");
    return { success: false, error: "GHL API not configured" };
  }
  
  try {
    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '1' + formattedPhone;
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    
    // First, find or create the contact
    const { contactId, error: contactError } = await findOrCreateGhlContact(
      formattedPhone,
      ownerName,
      ownerEmail
    );
    
    if (!contactId) {
      console.error(`Failed to get GHL contact: ${contactError}`);
      return { success: false, error: contactError || "No contact ID" };
    }
    
    console.log(`Sending SMS to ${formattedPhone} (contact: ${contactId}) via GHL...`);
    
    const response = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Content-Type": "application/json",
          "Version": "2021-04-15",
        },
        body: JSON.stringify({
          type: "SMS",
          contactId: contactId,
          message,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`GHL SMS failed (${response.status}): ${error}`);
      return { success: false, error: `GHL ${response.status}: ${error}` };
    }
    
    const result = await response.json();
    console.log(`SMS sent successfully to ${formattedPhone}`, result);
    return { success: true };
  } catch (error) {
    console.error(`SMS error: ${String(error)}`);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    
    // Allow manual trigger with specific property_id, or run for all
    const { property_id, force, test_email } = body;
    
    // Check if it's the last day of month (unless forced or specific property)
    if (!force && !property_id && !isLastDayOfMonth()) {
      return new Response(
        JSON.stringify({ message: "Not the last day of the month. Use force=true to override." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const previousMonthStart = getPreviousMonthStart();
    const previousMonthName = getPreviousMonthName();
    const recapMonth = previousMonthStart.toISOString().split('T')[0];
    
    // Fetch properties to process
    let propertiesQuery = supabase
      .from('properties')
      .select(`
        id,
        name,
        address,
        rental_type,
        owner_id,
        property_owners!inner (
          id,
          name,
          email,
          phone,
          second_owner_name,
          second_owner_email
        )
      `)
      .in('property_type', ['Client-Managed', 'Company-Owned'])
      .is('offboarded_at', null)
      .not('owner_id', 'is', null);
    
    if (property_id) {
      propertiesQuery = propertiesQuery.eq('id', property_id);
    }
    
    const { data: properties, error: propertiesError } = await propertiesQuery;
    
    if (propertiesError) {
      throw new Error(`Failed to fetch properties: ${propertiesError.message}`);
    }
    
    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ message: "No properties to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Processing ${properties.length} properties for ${previousMonthName} recap`);
    
    const results: any[] = [];
    
    for (const property of properties) {
      const owner = property.property_owners as any;
      const ownerEmail = test_email || owner.email;
      const ownerNames = getOwnerFirstNames(owner.name, owner.second_owner_name);
      
      console.log(`Processing ${property.name} for ${owner.name}`);
      
      try {
        // Check if recap already sent for this month
        const { data: existingRecap } = await supabase
          .from('owner_monthly_recaps')
          .select('id')
          .eq('property_id', property.id)
          .eq('recap_month', recapMonth)
          .single();
        
        if (existingRecap && !force) {
          console.log(`Recap already sent for ${property.name}, skipping`);
          results.push({ property: property.name, status: 'skipped', reason: 'already_sent' });
          continue;
        }
        
        // Fetch metrics from reconciliations
        const { data: reconciliation } = await supabase
          .from('monthly_reconciliations')
          .select('*')
          .eq('property_id', property.id)
          .eq('reconciliation_month', recapMonth)
          .single();
        
        // Fetch marketing stats
        const { data: marketingStats } = await supabase
          .from('owner_marketing_stats')
          .select('*')
          .eq('property_id', property.id)
          .eq('report_month', recapMonth)
          .single();
        
        // Fetch bookings to check if property has any
        const { count: bookingCount } = await supabase
          .from('ownerrez_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', property.id);
        
        const hasBookings = (bookingCount || 0) > 0;
        
        // Fetch onboarding stage from onboarding_projects
        const { data: onboardingProject } = await supabase
          .from('onboarding_projects')
          .select('status')
          .eq('property_id', property.id)
          .maybeSingle();
        
        const onboardingStage = onboardingProject?.status || null;
        
        // Fetch reviews for rating
        const { data: reviews } = await supabase
          .from('ownerrez_reviews')
          .select('rating')
          .eq('property_id', property.id);
        
        const avgRating = reviews && reviews.length > 0 
          ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length 
          : 0;
        
        // Build metrics object
        const metrics = {
          totalRevenue: reconciliation?.total_revenue || 0,
          strRevenue: reconciliation?.short_term_revenue || 0,
          mtrRevenue: reconciliation?.mid_term_revenue || 0,
          occupancyRate: reconciliation?.occupancy_rate || 0,
          strBookings: reconciliation?.str_bookings || 0,
          mtrBookings: reconciliation?.mtr_bookings || 0,
          averageRating: avgRating,
          reviewCount: reviews?.length || 0,
        };
        
        // Build marketing stats object
        const mktStats = marketingStats?.social_media ? {
          ...marketingStats.social_media,
          calls_made: marketingStats.outreach?.calls_made || 0,
        } : { calls_made: 0 };
        
        // Generate voice script
        const voiceScript = generateVoiceScript(
          property.name,
          ownerNames,
          property.rental_type,
          metrics,
          mktStats,
          hasBookings,
          onboardingStage
        );
        
        console.log(`Generated script for ${property.name}: ${voiceScript.substring(0, 100)}...`);
        
        // Generate audio
        const { audioBuffer, error: audioError } = await generateAudio(voiceScript);
        
        if (audioError || !audioBuffer) {
          console.error(`Audio generation failed for ${property.name}: ${audioError}`);
          results.push({ property: property.name, status: 'error', error: audioError });
          continue;
        }
        
        // Upload audio to storage
        const audioFileName = `${property.id}/${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2, '0')}-recap.mp3`;
        
        const { error: uploadError } = await supabase.storage
          .from('owner-voice-recaps')
          .upload(audioFileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });
        
        if (uploadError) {
          console.error(`Audio upload failed for ${property.name}: ${uploadError.message}`);
          results.push({ property: property.name, status: 'error', error: uploadError.message });
          continue;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('owner-voice-recaps')
          .getPublicUrl(audioFileName);
        
        const audioUrl = urlData.publicUrl;
        
        // Generate portal URL with magic link
        let magicLink: string | null = null;
        try {
          const { data } = await supabase.rpc('generate_owner_magic_token', {
            p_owner_id: owner.id,
          });
          magicLink = data;
        } catch {
          // Magic link generation failed, use default portal URL
        }
        
        const portalUrl = magicLink 
          ? `https://propertycentral.lovable.app/owner?token=${magicLink}`
          : `https://propertycentral.lovable.app/owner`;
        
        // Generate recap ID FIRST so we can use it in the email link
        const recapId = crypto.randomUUID();
        
        // Generate email HTML with the recap ID for the branded player link
        const emailHtml = generateEmailHtml(
          owner.name,
          owner.second_owner_name,
          property.name,
          property.address,
          metrics,
          mktStats,
          audioUrl,
          portalUrl,
          previousMonthName,
          recapId
        );
        
        // Send email
        const emailResult = await sendEmail(
          ownerEmail,
          `📊 ${previousMonthName} Performance Recap - ${property.name}`,
          emailHtml,
          owner.second_owner_email
        );
        
        // Save recap record with the same ID we used in the email
        await supabase.from('owner_monthly_recaps').upsert({
          id: recapId,
          property_id: property.id,
          owner_id: owner.id,
          recap_month: recapMonth,
          email_sent: false,
          sms_sent: false,
          audio_url: audioUrl,
          voice_script: voiceScript,
          metrics,
        }, { onConflict: 'property_id,recap_month' });
        
        // Send SMS with SHORT recap player link using recap ID + portal link
        let smsResult: { success: boolean; error?: string } = { success: false, error: 'No phone number' };
        if (owner.phone) {
          // Short URL using recap ID - the player will fetch details from the database
          const shortRecapUrl = `https://propertycentral.lovable.app/recap/${recapId}`;
          const ownerPortalUrl = `https://propertycentral.lovable.app/owner?owner=${owner.id}`;
          
          const smsMessage = `Hi ${ownerNames}! 🏠 Your ${previousMonthName} recap is ready!\n\n${metrics.totalRevenue > 0 ? `💰 ${formatCurrency(metrics.totalRevenue)}\n` : ''}🎧 Listen: ${shortRecapUrl}\n📊 Portal: ${ownerPortalUrl}\n\n— PeachHaus`;
          
          smsResult = await sendSms(owner.phone, smsMessage, owner.name, owner.email);
        }
        
        // Update recap record with send status
        await supabase.from('owner_monthly_recaps').update({
          email_sent: emailResult.success,
          sms_sent: smsResult.success,
          email_sent_at: emailResult.success ? new Date().toISOString() : null,
          sms_sent_at: smsResult.success ? new Date().toISOString() : null,
          error_message: emailResult.error || smsResult.error || null,
        }).eq('id', recapId);
        
        results.push({
          property: property.name,
          owner: owner.name,
          status: 'success',
          email_sent: emailResult.success,
          sms_sent: smsResult.success,
          audio_url: audioUrl,
        });
        
        console.log(`Completed recap for ${property.name}`);
        
      } catch (error) {
        console.error(`Error processing ${property.name}:`, error);
        results.push({ property: property.name, status: 'error', error: String(error) });
      }
    }
    
    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} properties`,
        month: previousMonthName,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in send-monthly-owner-recap:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
