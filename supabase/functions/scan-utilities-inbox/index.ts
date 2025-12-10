import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hardcoded Company-Owned property mappings
const PROPERTIES = [
  { id: "695bfc2a-4187-4377-8e25-18aa2fcd0454", name: "Alpine", streetNum: "4241", keywords: ["osburn", "duluth"], zip: "30096" },
  { id: "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b", name: "Family Retreat", streetNum: "5360", keywords: ["durham", "lilburn"], zip: "30047" },
  { id: "96e2819b-c0e8-4281-b535-5c99c39973b3", name: "Lavish Living", streetNum: "3069", keywords: ["rita"], zip: "30080" },
  { id: "9904f14f-4cf0-44d7-bc3e-1207bcc28a34", name: "Luxurious Apartment", streetNum: "2580", keywords: ["roswell"], zip: "30076" },
  { id: "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", name: "Modern Townhome", streetNum: "169", keywords: ["willow"], zip: "30076" },
  { id: "6c80c23b-997a-45af-8702-aeb7a7cf3e81", name: "Scandi Chic", streetNum: "3155", keywords: ["duvall", "kennesaw"], zip: "30144" },
  { id: "9f7f6d4d-9873-46be-926f-c5a48863a946", name: "Scandinavian Retreat", streetNum: "5198", keywords: ["laurel", "bridge"], zip: "30082" },
];

// Known account number mappings
const ACCOUNT_MAP: Record<string, string> = {
  "100118047": "6c80c23b-997a-45af-8702-aeb7a7cf3e81", // Cobb Water - Scandi Chic
  "4310134357135": "9f7f6d4d-9873-46be-926f-c5a48863a946", // SCANA - Scandinavian Retreat
  "4918100": "9f7f6d4d-9873-46be-926f-c5a48863a946", // Smyrna Water - Scandinavian Retreat
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

function matchProperty(text: string, accountNum: string | null): { id: string; method: string } | null {
  const searchText = text.toUpperCase();
  
  // 1. Account number match (highest priority)
  if (accountNum && ACCOUNT_MAP[accountNum]) {
    return { id: ACCOUNT_MAP[accountNum], method: "account" };
  }
  
  // 2. Street number + keyword match
  for (const prop of PROPERTIES) {
    if (searchText.includes(prop.streetNum)) {
      const hasKeyword = prop.keywords.some(k => searchText.includes(k.toUpperCase()));
      if (hasKeyword) {
        return { id: prop.id, method: "address" };
      }
      // Zip code fallback
      if (searchText.includes(prop.zip)) {
        return { id: prop.id, method: "zip" };
      }
    }
  }
  
  // 3. Keyword-only match (lower confidence)
  for (const prop of PROPERTIES) {
    const matchCount = prop.keywords.filter(k => searchText.includes(k.toUpperCase())).length;
    if (matchCount >= 2) {
      return { id: prop.id, method: "keywords" };
    }
  }
  
  return null;
}

function isBillEmail(subject: string): boolean {
  const s = subject.toLowerCase();
  const billKeywords = ["bill", "invoice", "statement", "payment due", "amount due", "ready to view", "balance"];
  const skipKeywords = ["offer", "giveaway", "tips", "newsletter", "survey", "welcome", "confirm", "outage"];
  
  if (skipKeywords.some(k => s.includes(k))) return false;
  return billKeywords.some(k => s.includes(k));
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

    // Get existing message IDs
    const { data: existing } = await supabase
      .from("utility_readings")
      .select("gmail_message_id")
      .not("gmail_message_id", "is", null);
    
    const existingIds = new Set(existing?.map(r => r.gmail_message_id) || []);

    // Search for utility emails
    const searchQuery = `newer_than:${months * 30}d (from:gassouth OR from:scanaenergy OR from:georgiapower OR from:cobbcounty OR from:smyrnaga OR from:dekalb)`;
    
    console.log("Search:", searchQuery);
    
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!searchRes.ok) throw new Error("Gmail search failed");
    
    const { messages = [] } = await searchRes.json();
    console.log(`Found ${messages.length} emails`);

    let newReadings = 0;
    let matched = 0;

    // Process messages (limit to 30 to prevent timeout)
    for (const msg of messages.slice(0, 30)) {
      if (existingIds.has(msg.id)) continue;
      
      // Check time - stop if approaching timeout
      if (Date.now() - startTime > 25000) {
        console.log("Approaching timeout, stopping");
        break;
      }

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
        
        if (!isBillEmail(subject)) {
          console.log(`Skip (not bill): ${subject.substring(0, 50)}`);
          continue;
        }

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
          console.log(`Skip (no provider): ${subject.substring(0, 50)}`);
          continue;
        }

        // Extract data
        const amount = extractAmount(fullText);
        if (!amount) {
          console.log(`Skip (no amount): ${subject.substring(0, 50)}`);
          continue;
        }

        const accountNum = extractAccountNumber(fullText);
        const propMatch = matchProperty(fullText, accountNum);
        
        // Parse bill date
        let billDate = new Date().toISOString().split("T")[0];
        try {
          const d = new Date(date);
          if (!isNaN(d.getTime())) billDate = d.toISOString().split("T")[0];
        } catch {}

        // Insert reading
        const { error: insertErr } = await supabase.from("utility_readings").insert({
          property_id: propMatch?.id || null,
          utility_type: provider.type,
          provider: provider.name,
          account_number: accountNum,
          bill_date: billDate,
          amount_due: amount,
          gmail_message_id: msg.id,
          match_method: propMatch?.method || "unmatched",
          raw_email_data: { subject, from, date, extracted_at: new Date().toISOString() },
        });

        if (!insertErr) {
          newReadings++;
          if (propMatch) matched++;
          console.log(`Added: ${provider.name} $${amount} - ${propMatch ? `MATCHED (${propMatch.method})` : "UNMATCHED"}`);
        }
        
      } catch (e) {
        console.error("Error processing message:", e);
      }
    }

    console.log(`Done: ${newReadings} new, ${matched} matched`);

    return new Response(
      JSON.stringify({ success: true, newReadings, matched, totalEmails: messages.length }),
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
