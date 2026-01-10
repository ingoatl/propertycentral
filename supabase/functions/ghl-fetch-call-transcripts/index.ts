import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract caller name from transcript
function extractCallerNameFromTranscript(transcript: string): string | null {
  if (!transcript) return null;
  
  // Common name introduction patterns
  const patterns = [
    /(?:this is|my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /(?:hi,? this is|hey,? it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /(?:can i get your name|may i have your name).*?\n.*?(?:human:|caller:)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /human:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\./gi,
  ];
  
  // Known team members to exclude
  const teamMembers = ['ingo', 'tom', 'anja', 'jason', 'peachhaus', 'peach', 'haus'];
  
  for (const pattern of patterns) {
    const matches = [...transcript.matchAll(pattern)];
    for (const match of matches) {
      const name = match[1]?.trim();
      if (name && name.length >= 2 && name.length <= 30) {
        const nameLower = name.toLowerCase();
        // Skip if it's a team member name
        if (!teamMembers.some(tm => nameLower.includes(tm))) {
          return name;
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
      // Fetch call logs with pagination to get more historical calls
      console.log(`Fetching call logs from HighLevel for location: ${ghlLocationId}`);
      
      let page = 1;
      const maxPages = 10; // Fetch up to 10 pages of calls
      let hasMore = true;
      
      while (hasMore && page <= maxPages) {
        console.log(`Fetching page ${page} of call logs...`);
        const response = await fetch(
          `https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs?locationId=${ghlLocationId}&page=${page}`,
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
          // Don't throw on pagination errors, just stop fetching
          if (page === 1) {
            throw new Error(`HighLevel API error: ${response.status}`);
          }
          break;
        }

        const data = await response.json();
        const pageCalls = data.callLogs || [];
        console.log(`Page ${page}: fetched ${pageCalls.length} calls`);
        
        callLogs.push(...pageCalls);
        
        // Stop if no more calls or fewer than expected (assuming ~10 per page)
        hasMore = pageCalls.length >= 10;
        page++;
      }
      
      console.log(`Total fetched: ${callLogs.length} call logs from HighLevel (${page - 1} pages)`);
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
      let matchedName = null;
      let matchedEmail = null;

      if (phoneNumber) {
        // Clean phone number for matching
        const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
        
        // Try to match to property owner first
        const { data: matchingOwners } = await supabase
          .from("property_owners")
          .select("id, name, email, phone")
          .ilike("phone", `%${cleanPhone}%`)
          .limit(1);

        if (matchingOwners && matchingOwners.length > 0) {
          ownerId = matchingOwners[0].id;
          matchedName = matchingOwners[0].name;
          matchedEmail = matchingOwners[0].email;
          console.log(`Matched call ${call.id} to owner: ${matchedName}`);
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
            // No match found - store as unmatched call (don't auto-create leads)
            console.log(`No match found for phone: ${phoneNumber} - storing as unmatched call`);
            
            // Try to extract name from transcript for display purposes only
            if (call.transcript) {
              const extractedName = extractCallerNameFromTranscript(call.transcript);
              if (extractedName) {
                matchedName = extractedName;
                console.log(`Extracted caller name from transcript: ${extractedName}`);
              }
            }
            
            // Leave leadId and ownerId as null - this is an unmatched call
            // It will still be stored in lead_communications for manual review
          }
        }
      } else {
        console.log(`No phone number for call ${call.id} - skipping`);
        continue;
      }

      // Create communication record - store even without match
      // Note: property_id is not in lead_communications table, so we don't include it
      // Use the original call date from GHL, not current timestamp
      const callDate = call.createdAt ? new Date(call.createdAt).toISOString() : new Date().toISOString();
      
      // Provide default body for calls without transcript to avoid null constraint violation
      const callBody = call.transcript || 
        `Voice AI call with ${matchedName || call.fromNumber || 'Unknown Caller'}. Duration: ${call.duration ? Math.round(call.duration / 60) + ' min' : 'Unknown'}. ${call.summary || ''}`.trim();
      
      const communicationData: Record<string, unknown> = {
        lead_id: leadId,
        owner_id: ownerId,
        communication_type: "call",
        direction: call.direction || "inbound",
        body: callBody, // Use default body if no transcript
        subject: call.summary || `Voice AI Call - ${matchedName || call.fromNumber || 'Unknown'}`,
        status: call.status || "completed",
        ghl_call_id: call.id,
        call_duration: call.duration || null,
        call_recording_url: call.recordingUrl || null,
        created_at: callDate, // Use original call date
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
            callType: "voice_ai", // Mark as AI bot call
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
