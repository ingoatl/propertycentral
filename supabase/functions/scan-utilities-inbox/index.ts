import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gmail label name to property ID mapping
const LABEL_PROPERTY_MAP: Record<string, { id: string; name: string }> = {
  "169 Willow Stream": { id: "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", name: "Modern + Cozy Townhome" },
  "2580 Old Roswell": { id: "9904f14f-4cf0-44d7-bc3e-1207bcc28a34", name: "Luxurious & Spacious Apartment" },
  "3069 Rita Way": { id: "96e2819b-c0e8-4281-b535-5c99c39973b3", name: "Lavish Living" },
  "3155 Duvall Pl": { id: "6c80c23b-997a-45af-8702-aeb7a7cf3e81", name: "Scandi Chic" },
  "4241 Osburn": { id: "695bfc2a-4187-4377-8e25-18aa2fcd0454", name: "Alpine" },
  "5198 Laurel Bridge": { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat" },
  "5360 Durham Ridge": { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat" },
  "5360 Durham Rid": { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat" },
};

// All utility providers - comprehensive list
const PROVIDERS = [
  // Gas
  { pattern: /scana/i, type: "gas", name: "SCANA Energy" },
  { pattern: /gas\s*south/i, type: "gas", name: "Gas South" },
  { pattern: /georgia\s*natural\s*gas|gng/i, type: "gas", name: "Georgia Natural Gas" },
  { pattern: /atlanta\s*gas/i, type: "gas", name: "Atlanta Gas Light" },
  
  // Electric
  { pattern: /georgia\s*power/i, type: "electric", name: "Georgia Power" },
  { pattern: /jackson\s*emc|jacksonemc|myjacksonemc/i, type: "electric", name: "Jackson EMC" },
  { pattern: /cobb\s*emc/i, type: "electric", name: "Cobb EMC" },
  { pattern: /walton\s*emc/i, type: "electric", name: "Walton EMC" },
  { pattern: /sawnee\s*emc/i, type: "electric", name: "Sawnee EMC" },
  { pattern: /greystone/i, type: "electric", name: "GreyStone Power" },
  
  // Water
  { pattern: /cobb.*water|cobbcounty.*water/i, type: "water", name: "Cobb County Water" },
  { pattern: /smyrna.*water|smyrnaga/i, type: "water", name: "Smyrna Water" },
  { pattern: /dekalb.*water/i, type: "water", name: "DeKalb County Water" },
  { pattern: /gwinnett.*water|gwinnett.*count/i, type: "water", name: "Gwinnett County Water" },
  { pattern: /fulton.*water/i, type: "water", name: "Fulton County Water" },
  { pattern: /roswell.*water/i, type: "water", name: "Roswell Water" },
  { pattern: /kennesaw.*water/i, type: "water", name: "Kennesaw Water" },
  { pattern: /utility\s*billing/i, type: "water", name: "Utility Billing" },
  
  // Internet/Cable
  { pattern: /spectrum/i, type: "internet", name: "Spectrum" },
  { pattern: /xfinity|comcast/i, type: "internet", name: "Xfinity" },
  { pattern: /att\.com|at&t/i, type: "internet", name: "AT&T" },
  { pattern: /google\s*fiber/i, type: "internet", name: "Google Fiber" },
  { pattern: /verizon/i, type: "internet", name: "Verizon" },
  { pattern: /t-mobile/i, type: "internet", name: "T-Mobile" },
];

function detectProvider(text: string): { type: string; name: string } | null {
  for (const p of PROVIDERS) {
    if (p.pattern.test(text)) return { type: p.type, name: p.name };
  }
  return null;
}

function extractAmount(text: string): number | null {
  // Look for common bill amount patterns
  const patterns = [
    /total\s*(?:due|amount|balance)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /amount\s*due[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /balance\s*due[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /new\s*balance[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /\$\s*([\d,]+\.?\d*)/g,
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (amount > 5 && amount < 5000) return amount;
    }
  }
  
  // Fallback: find all dollar amounts
  const allAmounts = text.match(/\$\s*([\d,]+\.?\d*)/g);
  if (allAmounts) {
    const amounts = allAmounts
      .map(m => parseFloat(m.replace(/[$,]/g, "")))
      .filter(a => a > 5 && a < 5000);
    if (amounts.length > 0) return Math.max(...amounts);
  }
  
  return null;
}

function extractAccountNumber(text: string): string | null {
  const patterns = [
    /account\s*(?:#|num|number|no)?[:\s]*(\d{6,15})/gi,
    /acct\s*(?:#|num|number|no)?[:\s]*(\d{6,15})/gi,
  ];
  
  for (const p of patterns) {
    const match = p.exec(text);
    if (match) return match[1];
  }
  return null;
}

async function refreshToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { months = 6 } = await req.json().catch(() => ({}));
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Gmail token
    const { data: tokenData, error: tokenError } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Gmail not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await refreshToken(tokenData.refresh_token);

    // Fetch Gmail labels
    console.log("Fetching Gmail labels...");
    const labelsRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!labelsRes.ok) throw new Error("Failed to fetch Gmail labels");
    
    const labelsData = await labelsRes.json();
    const utilityLabels: { id: string; name: string; propertyId: string; propertyName: string }[] = [];
    
    // Find Utilities sub-labels
    for (const label of labelsData.labels || []) {
      if (label.name?.startsWith("Utilities/")) {
        const subLabelName = label.name.replace("Utilities/", "");
        console.log(`Found label: ${subLabelName}`);
        
        // Match to property by street number
        for (const [key, prop] of Object.entries(LABEL_PROPERTY_MAP)) {
          const streetNum = key.split(" ")[0];
          if (subLabelName.includes(streetNum)) {
            utilityLabels.push({
              id: label.id,
              name: subLabelName,
              propertyId: prop.id,
              propertyName: prop.name,
            });
            console.log(`  Mapped: ${prop.name}`);
            break;
          }
        }
      }
    }

    console.log(`Found ${utilityLabels.length} utility labels`);

    // Get existing message IDs
    const { data: existing } = await supabase
      .from("utility_readings")
      .select("gmail_message_id")
      .not("gmail_message_id", "is", null);
    
    const existingIds = new Set(existing?.map(r => r.gmail_message_id) || []);

    let newReadings = 0;
    let skippedDupe = 0;
    const propertyStats: Record<string, { name: string; count: number }> = {};

    // Process each label
    for (const utilLabel of utilityLabels) {
      if (Date.now() - startTime > 45000) {
        console.log("Approaching timeout");
        break;
      }

      console.log(`\n--- ${utilLabel.propertyName} (${utilLabel.name}) ---`);
      propertyStats[utilLabel.propertyId] = { name: utilLabel.propertyName, count: 0 };
      
      // Fetch ALL emails from this label
      const searchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${utilLabel.id}&maxResults=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (!searchRes.ok) continue;
      
      const { messages = [] } = await searchRes.json();
      console.log(`  ${messages.length} emails found`);

      for (const msg of messages) {
        if (existingIds.has(msg.id)) {
          skippedDupe++;
          continue;
        }
        
        if (Date.now() - startTime > 45000) break;

        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          
          if (!msgRes.ok) continue;
          
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          
          const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
          const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
          const date = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";

          // Extract body
          let body = "";
          const extractBody = (payload: any): string => {
            if (payload.body?.data) {
              try {
                return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              } catch { return ""; }
            }
            if (payload.parts) {
              for (const part of payload.parts) {
                const result = extractBody(part);
                if (result) return result;
              }
            }
            return "";
          };
          body = extractBody(msgData.payload);

          const fullText = `${subject} ${from} ${body}`;
          
          // Detect provider
          const provider = detectProvider(fullText);
          if (!provider) {
            console.log(`  SKIP (unknown provider): ${subject.substring(0, 50)}`);
            continue;
          }

          // Extract amount
          const amount = extractAmount(fullText);
          if (!amount) {
            console.log(`  SKIP (no amount): ${subject.substring(0, 50)}`);
            continue;
          }

          const accountNum = extractAccountNumber(fullText);
          
          // Parse bill date
          let billDate = new Date().toISOString().split("T")[0];
          try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) billDate = d.toISOString().split("T")[0];
          } catch {}

          // Insert reading
          const { error: insertErr } = await supabase.from("utility_readings").insert({
            property_id: utilLabel.propertyId,
            utility_type: provider.type,
            provider: provider.name,
            account_number: accountNum,
            bill_date: billDate,
            amount_due: amount,
            gmail_message_id: msg.id,
            match_method: "label",
            raw_email_data: { subject, from, date, label: utilLabel.name },
          });

          if (!insertErr) {
            newReadings++;
            propertyStats[utilLabel.propertyId].count++;
            existingIds.add(msg.id);
            console.log(`  + ${provider.name} $${amount} (${billDate})`);
          }
          
        } catch (e) {
          console.error("  Error:", e);
        }
      }
    }

    // Summary
    console.log("\n=== SUMMARY ===");
    for (const [id, stats] of Object.entries(propertyStats)) {
      console.log(`${stats.name}: ${stats.count} new readings`);
    }
    console.log(`Total: ${newReadings} new, ${skippedDupe} duplicates skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        newReadings, 
        skippedDuplicates: skippedDupe,
        properties: Object.values(propertyStats),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
