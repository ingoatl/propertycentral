import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    
    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL_API_KEY and GHL_LOCATION_ID are required");
    }

    const { callId, syncAll, limit = 50 } = await req.json();

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let callLogs = [];

    if (callId) {
      // Fetch single call transcript
      console.log(`Fetching transcript for call: ${callId}`);
      const response = await fetch(
        `https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs/${callId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HighLevel API error:", errorText);
        throw new Error(`HighLevel API error: ${response.status}`);
      }

      const data = await response.json();
      callLogs = [data];
    } else if (syncAll) {
      // Fetch all call logs - Voice AI endpoint doesn't accept limit param
      console.log(`Fetching call logs from HighLevel for location: ${ghlLocationId}`);
      const response = await fetch(
        `https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs?locationId=${ghlLocationId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HighLevel API error:", errorText);
        throw new Error(`HighLevel API error: ${response.status}`);
      }

      const data = await response.json();
      callLogs = data.callLogs || [];
      console.log(`Fetched ${callLogs.length} call logs from HighLevel`);
    } else {
      throw new Error("Either callId or syncAll must be provided");
    }

    const syncedCalls = [];

    for (const call of callLogs) {
      // Check if we already have this call
      const { data: existingComm } = await supabase
        .from("lead_communications")
        .select("id")
        .eq("ghl_call_id", call.id)
        .single();

      if (existingComm) {
        console.log(`Call ${call.id} already synced, skipping`);
        continue;
      }

      // Try to find matching lead by phone number
      const phoneNumber = call.fromNumber || call.toNumber;
      let leadId = null;

      if (phoneNumber) {
        // Clean phone number for matching
        const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
        
        const { data: matchingLeads } = await supabase
          .from("leads")
          .select("id")
          .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${phoneNumber}%`)
          .limit(1);

        if (matchingLeads && matchingLeads.length > 0) {
          leadId = matchingLeads[0].id;
        }
      }

      // Create communication record
      const communicationData = {
        lead_id: leadId,
        communication_type: "call",
        direction: call.direction || "inbound",
        body: call.transcript || null,
        subject: call.summary || `Call from ${call.fromNumber || 'Unknown'}`,
        status: call.status || "completed",
        ghl_call_id: call.id,
        call_duration: call.duration || null,
        call_recording_url: call.recordingUrl || null,
        metadata: {
          ghl_data: {
            fromNumber: call.fromNumber,
            toNumber: call.toNumber,
            agentId: call.agentId,
            sentiment: call.sentiment,
            extractedData: call.extractedData,
            endedReason: call.endedReason,
            createdAt: call.createdAt,
          }
        },
        external_id: call.id,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("lead_communications")
        .insert(communicationData)
        .select()
        .single();

      if (insertError) {
        console.error(`Error inserting call ${call.id}:`, insertError);
      } else {
        syncedCalls.push({
          id: inserted.id,
          ghl_call_id: call.id,
          lead_id: leadId,
          has_transcript: !!call.transcript,
        });

        // Add timeline entry if we found a lead
        if (leadId) {
          await supabase.from("lead_timeline").insert({
            lead_id: leadId,
            action: `Call synced from HighLevel${call.transcript ? ' (with transcript)' : ''}`,
            metadata: {
              ghl_call_id: call.id,
              duration: call.duration,
              sentiment: call.sentiment,
            },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedCalls.length,
        calls: syncedCalls,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error fetching GHL call transcripts:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
