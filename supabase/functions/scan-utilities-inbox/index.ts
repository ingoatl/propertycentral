import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Complete property mapping with multiple label variants for flexible matching
const PROPERTY_MAP: Record<string, { id: string; name: string; streetNum: string }> = {
  "alpine": { id: "695bfc2a-4187-4377-8e25-18aa2fcd0454", name: "Alpine", streetNum: "4241" },
  "family retreat": { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat", streetNum: "5360" },
  "lavish living": { id: "96e2819b-c0e8-4281-b535-5c99c39973b3", name: "Lavish Living", streetNum: "3069" },
  "luxurious": { id: "9904f14f-4cf0-44d7-bc3e-1207bcc28a34", name: "Luxurious & Spacious", streetNum: "2580" },
  "modern": { id: "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", name: "Modern + Cozy Townhome", streetNum: "169" },
  "scandi chic": { id: "6c80c23b-997a-45af-8702-aeb7a7cf3e81", name: "Scandi Chic", streetNum: "3155" },
  "scandinavian retreat": { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat", streetNum: "5198" },
};

// Street number to property lookup
const STREET_NUM_MAP: Record<string, { id: string; name: string }> = {
  "4241": { id: "695bfc2a-4187-4377-8e25-18aa2fcd0454", name: "Alpine" },
  "5360": { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat" },
  "3069": { id: "96e2819b-c0e8-4281-b535-5c99c39973b3", name: "Lavish Living" },
  "2580": { id: "9904f14f-4cf0-44d7-bc3e-1207bcc28a34", name: "Luxurious & Spacious" },
  "169": { id: "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", name: "Modern + Cozy Townhome" },
  "3155": { id: "6c80c23b-997a-45af-8702-aeb7a7cf3e81", name: "Scandi Chic" },
  "5198": { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat" },
};

// Additional label name variants
const LABEL_VARIANTS: Record<string, { id: string; name: string }> = {
  "osburn": { id: "695bfc2a-4187-4377-8e25-18aa2fcd0454", name: "Alpine" },
  "durham": { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat" },
  "rita": { id: "96e2819b-c0e8-4281-b535-5c99c39973b3", name: "Lavish Living" },
  "roswell": { id: "9904f14f-4cf0-44d7-bc3e-1207bcc28a34", name: "Luxurious & Spacious" },
  "willow": { id: "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", name: "Modern + Cozy Townhome" },
  "duvall": { id: "6c80c23b-997a-45af-8702-aeb7a7cf3e81", name: "Scandi Chic" },
  "laurel": { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat" },
  "vinings": { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat" },
};

// Comprehensive provider patterns
const PROVIDERS = [
  // Gas
  { pattern: /scana/i, type: "gas", name: "SCANA Energy" },
  { pattern: /gas\s*south/i, type: "gas", name: "Gas South" },
  { pattern: /georgia\s*natural|gng|ga\s*natural/i, type: "gas", name: "GA Natural Gas" },
  { pattern: /atlanta\s*gas/i, type: "gas", name: "Atlanta Gas Light" },
  { pattern: /infinite\s*energy/i, type: "gas", name: "Infinite Energy" },
  
  // Electric
  { pattern: /georgia\s*power|ga\s*power/i, type: "electric", name: "Georgia Power" },
  { pattern: /jackson\s*emc|jacksonemc|myjacksonemc/i, type: "electric", name: "Jackson EMC" },
  { pattern: /cobb\s*emc/i, type: "electric", name: "Cobb EMC" },
  { pattern: /walton\s*emc/i, type: "electric", name: "Walton EMC" },
  { pattern: /sawnee\s*emc/i, type: "electric", name: "Sawnee EMC" },
  { pattern: /greystone|grey\s*stone/i, type: "electric", name: "GreyStone Power" },
  
  // Water - more patterns
  { pattern: /cobb.*water|cobbcounty/i, type: "water", name: "Cobb County Water" },
  { pattern: /smyrna/i, type: "water", name: "Smyrna Water" },
  { pattern: /dekalb/i, type: "water", name: "DeKalb County Water" },
  { pattern: /gwinnett/i, type: "water", name: "Gwinnett County Water" },
  { pattern: /fulton.*water/i, type: "water", name: "Fulton County Water" },
  { pattern: /roswell.*water|city.*roswell/i, type: "water", name: "Roswell Water" },
  { pattern: /kennesaw/i, type: "water", name: "Kennesaw Water" },
  { pattern: /atlanta.*water|watershed/i, type: "water", name: "Atlanta Watershed" },
  { pattern: /utility\s*billing|utility\s*service/i, type: "water", name: "Utility Billing" },
  
  // Internet/Cable
  { pattern: /spectrum|charter/i, type: "internet", name: "Spectrum" },
  { pattern: /xfinity|comcast/i, type: "internet", name: "Xfinity" },
  { pattern: /att\.com|at&t|att\s/i, type: "internet", name: "AT&T" },
  { pattern: /google\s*fiber/i, type: "internet", name: "Google Fiber" },
  { pattern: /verizon/i, type: "internet", name: "Verizon" },
  { pattern: /t-mobile|tmobile/i, type: "internet", name: "T-Mobile" },
  
  // Trash
  { pattern: /waste\s*management|wm\.com/i, type: "trash", name: "Waste Management" },
  { pattern: /republic\s*services/i, type: "trash", name: "Republic Services" },
];

function detectProvider(text: string): { type: string; name: string } | null {
  for (const p of PROVIDERS) {
    if (p.pattern.test(text)) return { type: p.type, name: p.name };
  }
  return null;
}

// Enhanced amount extraction
function extractAmount(text: string): number | null {
  // Priority patterns for bill amounts
  const patterns = [
    /total\s*(?:due|amount|balance|owed)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /amount\s*(?:due|owed|payable)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /balance\s*(?:due|forward|total)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /(?:new|current)\s*(?:balance|charges)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /payment\s*(?:amount|due)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /(?:your|this)\s*(?:bill|statement)[:\s]*\$?\s*([\d,]+\.?\d*)/gi,
    /(?:pay|paid)\s*\$?\s*([\d,]+\.?\d*)/gi,
    /charged\s*\$?\s*([\d,]+\.?\d*)/gi,
  ];
  
  for (const pattern of patterns) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(text);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ""));
      if (amount >= 5 && amount <= 3000) return amount;
    }
  }
  
  // Fallback: find the largest reasonable dollar amount
  const allAmounts = text.match(/\$\s*([\d,]+\.\d{2})/g);
  if (allAmounts) {
    const amounts = allAmounts
      .map(m => parseFloat(m.replace(/[$,]/g, "")))
      .filter(a => a >= 5 && a <= 3000);
    if (amounts.length > 0) return Math.max(...amounts);
  }
  
  return null;
}

function extractAccountNumber(text: string): string | null {
  const patterns = [
    /account\s*(?:#|num|number|no)?[:\s]*(\d{6,15})/gi,
    /acct\s*(?:#|num|number|no)?[:\s]*(\d{6,15})/gi,
    /customer\s*(?:#|id|number)?[:\s]*(\d{6,15})/gi,
  ];
  
  for (const p of patterns) {
    p.lastIndex = 0;
    const match = p.exec(text);
    if (match) return match[1];
  }
  return null;
}

// Match label to property using multiple strategies
function matchLabelToProperty(labelName: string): { id: string; name: string } | null {
  const lowerLabel = labelName.toLowerCase();
  
  // Strategy 1: Street number match
  for (const [streetNum, prop] of Object.entries(STREET_NUM_MAP)) {
    if (lowerLabel.includes(streetNum)) {
      return prop;
    }
  }
  
  // Strategy 2: Label variant match (street names)
  for (const [variant, prop] of Object.entries(LABEL_VARIANTS)) {
    if (lowerLabel.includes(variant)) {
      return prop;
    }
  }
  
  // Strategy 3: Property name match
  for (const [key, prop] of Object.entries(PROPERTY_MAP)) {
    if (lowerLabel.includes(key)) {
      return prop;
    }
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
  const TIMEOUT_MS = 50000;
  
  try {
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

    // Fetch ALL Gmail labels
    console.log("Fetching all Gmail labels...");
    const labelsRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!labelsRes.ok) throw new Error("Failed to fetch Gmail labels");
    
    const labelsData = await labelsRes.json();
    
    // Log all labels for debugging
    console.log("ALL LABELS:", labelsData.labels?.map((l: any) => l.name).join(", "));
    
    const utilityLabels: { id: string; name: string; propertyId: string; propertyName: string }[] = [];
    
    // Find ANY label under "Utilities/" folder
    for (const label of labelsData.labels || []) {
      const labelName = label.name || "";
      
      if (labelName.startsWith("Utilities/")) {
        const subLabelName = labelName.replace("Utilities/", "");
        console.log(`\nProcessing label: "${subLabelName}"`);
        
        const property = matchLabelToProperty(subLabelName);
        
        if (property) {
          utilityLabels.push({
            id: label.id,
            name: subLabelName,
            propertyId: property.id,
            propertyName: property.name,
          });
          console.log(`  ✓ Matched to: ${property.name}`);
        } else {
          console.log(`  ✗ No match found for: ${subLabelName}`);
        }
      }
    }

    console.log(`\n=== Found ${utilityLabels.length} utility labels ===\n`);

    // Get existing message IDs to avoid duplicates
    const { data: existing } = await supabase
      .from("utility_readings")
      .select("gmail_message_id")
      .not("gmail_message_id", "is", null);
    
    const existingIds = new Set(existing?.map(r => r.gmail_message_id) || []);

    let newReadings = 0;
    let skippedDupe = 0;
    let skippedNoProvider = 0;
    let skippedNoAmount = 0;
    const propertyStats: Record<string, { name: string; count: number; types: Set<string> }> = {};

    // Process each utility label
    for (const utilLabel of utilityLabels) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.log("⚠ Approaching timeout, stopping");
        break;
      }

      console.log(`\n--- ${utilLabel.propertyName} (${utilLabel.name}) ---`);
      
      if (!propertyStats[utilLabel.propertyId]) {
        propertyStats[utilLabel.propertyId] = { 
          name: utilLabel.propertyName, 
          count: 0, 
          types: new Set() 
        };
      }
      
      // Fetch ALL emails from this label (no date filter to get everything)
      const searchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${utilLabel.id}&maxResults=200`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (!searchRes.ok) {
        console.log(`  Failed to fetch messages`);
        continue;
      }
      
      const { messages = [] } = await searchRes.json();
      console.log(`  Found ${messages.length} total emails`);

      for (const msg of messages) {
        if (existingIds.has(msg.id)) {
          skippedDupe++;
          continue;
        }
        
        if (Date.now() - startTime > TIMEOUT_MS) break;

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

          // Extract body recursively
          let body = "";
          const extractBody = (payload: any): string => {
            if (payload.body?.data) {
              try {
                return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              } catch { return ""; }
            }
            if (payload.parts) {
              let result = "";
              for (const part of payload.parts) {
                result += extractBody(part);
              }
              return result;
            }
            return "";
          };
          body = extractBody(msgData.payload);

          // Strip HTML for text analysis
          const textContent = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
          const fullText = `${subject} ${from} ${textContent}`;
          
          // Detect provider
          const provider = detectProvider(fullText);
          if (!provider) {
            skippedNoProvider++;
            continue;
          }

          // Extract amount
          const amount = extractAmount(fullText);
          if (!amount) {
            skippedNoAmount++;
            continue;
          }

          const accountNum = extractAccountNumber(fullText);
          
          // Parse bill date from email date
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
            propertyStats[utilLabel.propertyId].types.add(provider.type);
            existingIds.add(msg.id);
            console.log(`  + ${provider.type}: ${provider.name} $${amount}`);
          } else {
            console.log(`  Error inserting: ${insertErr.message}`);
          }
          
        } catch (e) {
          console.error("  Error processing message:", e);
        }
      }
    }

    // Summary
    console.log("\n========== SUMMARY ==========");
    for (const [id, stats] of Object.entries(propertyStats)) {
      console.log(`${stats.name}: ${stats.count} readings (${[...stats.types].join(", ")})`);
    }
    console.log(`\nTotal: ${newReadings} new readings`);
    console.log(`Skipped: ${skippedDupe} duplicates, ${skippedNoProvider} no provider, ${skippedNoAmount} no amount`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        newReadings, 
        skippedDuplicates: skippedDupe,
        skippedNoProvider,
        skippedNoAmount,
        properties: Object.entries(propertyStats).map(([id, stats]) => ({
          id,
          name: stats.name,
          count: stats.count,
          types: [...stats.types],
        })),
        labelsProcessed: utilityLabels.length,
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