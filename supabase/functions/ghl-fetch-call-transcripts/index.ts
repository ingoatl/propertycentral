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
    const callsToAnalyze = [];

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

      // Try to find matching owner by phone number FIRST
      const phoneNumber = call.fromNumber || call.toNumber;
      let ownerId = null;
      let leadId = null;
      let propertyId = null;
      let matchedName = null;
      let matchedEmail = null;

      if (phoneNumber) {
        // Clean phone number for matching
        const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
        
        // Try to match to property owner first
        const { data: matchingOwners } = await supabase
          .from("property_owners")
          .select("id, name, email, phone")
          .or(`phone.ilike.%${cleanPhone}%,secondary_phone.ilike.%${cleanPhone}%`)
          .limit(1);

        if (matchingOwners && matchingOwners.length > 0) {
          ownerId = matchingOwners[0].id;
          matchedName = matchingOwners[0].name;
          matchedEmail = matchingOwners[0].email;
          console.log(`Matched call ${call.id} to owner: ${matchedName}`);

          // Get a property for this owner
          const { data: ownerProperty } = await supabase
            .from("properties")
            .select("id")
            .eq("owner_id", ownerId)
            .limit(1)
            .single();

          if (ownerProperty) {
            propertyId = ownerProperty.id;
          }
        } else {
          // Try to match to lead
          const { data: matchingLeads } = await supabase
            .from("leads")
            .select("id, name, email")
            .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${phoneNumber}%`)
            .limit(1);

          if (matchingLeads && matchingLeads.length > 0) {
            leadId = matchingLeads[0].id;
            matchedName = matchingLeads[0].name;
            matchedEmail = matchingLeads[0].email;
            console.log(`Matched call ${call.id} to lead: ${matchedName}`);
          } else {
            console.log(`No owner or lead match found for phone: ${phoneNumber}`);
            // Still proceed - we'll create the record without a match
            matchedName = phoneNumber; // Use phone as fallback name
          }
        }
      }

      // Create communication record - store even without match
      const communicationData = {
        lead_id: leadId,
        owner_id: ownerId,
        property_id: propertyId,
        communication_type: "call",
        direction: call.direction || "inbound",
        body: call.transcript || null,
        subject: call.summary || `Call from ${matchedName || call.fromNumber || 'Unknown'}`,
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
            matchedName,
            matchedEmail,
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
          owner_id: ownerId,
          lead_id: leadId,
          has_transcript: !!call.transcript,
          matched_name: matchedName,
        });

        // Add timeline entry if we found an owner
        if (ownerId) {
          await supabase.from("lead_timeline").insert({
            lead_id: leadId,
            action: `Call synced from HighLevel${call.transcript ? ' (with transcript)' : ''} - ${matchedName}`,
            metadata: {
              ghl_call_id: call.id,
              duration: call.duration,
              sentiment: call.sentiment,
              owner_id: ownerId,
            },
          });
        }

        // Queue for analysis if has transcript
        if (call.transcript && call.transcript.length > 50) {
          callsToAnalyze.push({
            communicationId: inserted.id,
            ownerId,
            leadId,
            propertyId,
            matchedName,
            matchedEmail,
            callDuration: call.duration,
            transcript: call.transcript,
            ghlCallId: call.id,
          });
        }
      }
    }

    // Trigger analysis for calls with transcripts
    for (const callData of callsToAnalyze) {
      try {
        console.log(`Triggering analysis for call ${callData.communicationId}`);
        const analysisResponse = await fetch(
          `${supabaseUrl}/functions/v1/analyze-call-transcript`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(callData),
          }
        );

        if (!analysisResponse.ok) {
          const errorText = await analysisResponse.text();
          console.error(`Analysis failed for call ${callData.communicationId}:`, errorText);
        } else {
          console.log(`Analysis triggered for call ${callData.communicationId}`);
        }
      } catch (analysisError) {
        console.error(`Error triggering analysis for call ${callData.communicationId}:`, analysisError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: syncedCalls.length,
        analyzedCount: callsToAnalyze.length,
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
