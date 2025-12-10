import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gmail label name to property ID mapping (based on user's Gmail label structure under "Utilities")
const LABEL_PROPERTY_MAP: Record<string, { id: string; name: string }> = {
  "169 Willow Stream": { id: "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", name: "Modern + Cozy Townhome" },
  "2580 Old Roswell": { id: "9904f14f-4cf0-44d7-bc3e-1207bcc28a34", name: "Luxurious & Spacious Apartment" },
  "3069 Rita Way": { id: "96e2819b-c0e8-4281-b535-5c99c39973b3", name: "Lavish Living" },
  "3155 Duvall Pl": { id: "6c80c23b-997a-45af-8702-aeb7a7cf3e81", name: "Scandi Chic" },
  "4241 Osburn": { id: "695bfc2a-4187-4377-8e25-18aa2fcd0454", name: "Alpine" },
  "5198 Laurel Bridge": { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat" },
  "5360 Durham Rid": { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat" },
};

// Provider detection
const PROVIDERS = [
  { pattern: /scana/i, type: "gas", name: "SCANA Energy" },
  { pattern: /gas\s*south/i, type: "gas", name: "Gas South" },
  { pattern: /georgia\s*power/i, type: "electric", name: "Georgia Power" },
  { pattern: /cobb.*water|cobbcounty/i, type: "water", name: "Cobb County Water System" },
  { pattern: /smyrna.*water|smyrnaga/i, type: "water", name: "Smyrna Water" },
  { pattern: /dekalb/i, type: "water", name: "DeKalb County Water" },
  { pattern: /gwinnett/i, type: "water", name: "Gwinnett County Water" },
];

function detectProvider(text: string): { type: string; name: string } | null {
  for (const p of PROVIDERS) {
    if (p.pattern.test(text)) return { type: p.type, name: p.name };
  }
  return null;
}

function extractAmount(text: string): number | null {
  const matches = text.match(/\$\s*([\d,]+\.?\d*)/g);
  if (!matches) return null;
  
  const amounts = matches
    .map(m => parseFloat(m.replace(/[$,]/g, "")))
    .filter(a => a > 5 && a < 5000);
  
  return amounts.length > 0 ? Math.max(...amounts) : null;
}

function extractAccountNumber(text: string): string | null {
  const patterns = [
    /account\s*(?:#|num|no)?[:\s]*(\d{6,15})/gi,
    /acct\s*(?:#|num|no)?[:\s]*(\d{6,15})/gi,
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

// Find property ID from Gmail labels
function matchPropertyFromLabels(labelIds: string[], labelMap: Map<string, string>): { id: string; name: string; method: string } | null {
  for (const labelId of labelIds) {
    const labelName = labelMap.get(labelId);
    if (labelName) {
      // Check direct match first
      for (const [key, prop] of Object.entries(LABEL_PROPERTY_MAP)) {
        if (labelName.includes(key) || key.includes(labelName.split("/").pop() || "")) {
          return { ...prop, method: "label" };
        }
      }
      // Check if label name contains any street number
      for (const [key, prop] of Object.entries(LABEL_PROPERTY_MAP)) {
        const streetNum = key.split(" ")[0];
        if (labelName.includes(streetNum)) {
          return { ...prop, method: "label" };
        }
      }
    }
  }
  return null;
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

    // Step 1: Fetch ALL Gmail labels to build a map
    console.log("Fetching Gmail labels...");
    const labelsRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/labels",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!labelsRes.ok) throw new Error("Failed to fetch Gmail labels");
    
    const labelsData = await labelsRes.json();
    const labelMap = new Map<string, string>();
    const utilityLabels: { id: string; name: string; propertyId: string; propertyName: string }[] = [];
    
    // Build label ID to name map and find Utilities sub-labels
    for (const label of labelsData.labels || []) {
      labelMap.set(label.id, label.name);
      
      // Check if this is a Utilities sub-label
      if (label.name?.startsWith("Utilities/")) {
        const subLabelName = label.name.replace("Utilities/", "");
        console.log(`Found Utilities label: ${subLabelName}`);
        
        // Match to property
        for (const [key, prop] of Object.entries(LABEL_PROPERTY_MAP)) {
          const streetNum = key.split(" ")[0];
          if (subLabelName.includes(streetNum) || subLabelName.includes(key)) {
            utilityLabels.push({
              id: label.id,
              name: subLabelName,
              propertyId: prop.id,
              propertyName: prop.name,
            });
            console.log(`  -> Mapped to: ${prop.name} (${prop.id})`);
            break;
          }
        }
      }
    }

    console.log(`Found ${utilityLabels.length} utility labels mapped to properties`);

    // Get existing message IDs
    const { data: existing } = await supabase
      .from("utility_readings")
      .select("gmail_message_id")
      .not("gmail_message_id", "is", null);
    
    const existingIds = new Set(existing?.map(r => r.gmail_message_id) || []);

    let newReadings = 0;
    let matched = 0;
    let totalProcessed = 0;

    // Step 2: For each utility label, fetch emails and create readings
    for (const utilLabel of utilityLabels) {
      if (Date.now() - startTime > 25000) {
        console.log("Approaching timeout, stopping");
        break;
      }

      console.log(`\nScanning label: ${utilLabel.name} -> ${utilLabel.propertyName}`);
      
      // Search emails with this label
      const searchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${utilLabel.id}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (!searchRes.ok) {
        console.log(`  Failed to fetch emails for ${utilLabel.name}`);
        continue;
      }
      
      const { messages = [] } = await searchRes.json();
      console.log(`  Found ${messages.length} emails`);

      // Process each email
      for (const msg of messages) {
        if (existingIds.has(msg.id)) continue;
        
        if (Date.now() - startTime > 25000) break;

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
            console.log(`  Skip (no provider): ${subject.substring(0, 40)}`);
            continue;
          }

          // Extract amount
          const amount = extractAmount(fullText);
          if (!amount) {
            console.log(`  Skip (no amount): ${subject.substring(0, 40)}`);
            continue;
          }

          const accountNum = extractAccountNumber(fullText);
          
          // Parse bill date
          let billDate = new Date().toISOString().split("T")[0];
          try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) billDate = d.toISOString().split("T")[0];
          } catch {}

          // Insert reading - property ID comes from the label!
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
            matched++;
            totalProcessed++;
            console.log(`  Added: ${provider.name} $${amount} on ${billDate}`);
          }
          
        } catch (e) {
          console.error("  Error processing message:", e);
        }
      }
    }

    console.log(`\nDone: ${newReadings} new readings, all ${matched} matched via labels`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        newReadings, 
        matched, 
        labelsFound: utilityLabels.length,
        properties: utilityLabels.map(l => l.propertyName),
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
