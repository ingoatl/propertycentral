import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, audioUrl, leadId, callSid } = await req.json();

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let audioData: Uint8Array;

    // Get audio data either from base64 or URL
    if (audio) {
      audioData = processBase64Chunks(audio);
    } else if (audioUrl) {
      const audioResponse = await fetch(audioUrl);
      const arrayBuffer = await audioResponse.arrayBuffer();
      audioData = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('No audio data provided');
    }

    console.log(`Transcribing audio: ${audioData.length} bytes`);

    // Create form data for ElevenLabs STT
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioData).buffer as ArrayBuffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model_id', 'scribe_v1');
    formData.append('tag_audio_events', 'true');
    formData.append('diarize', 'true');
    formData.append('language_code', 'eng');

    const transcribeResponse = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: formData,
      }
    );

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('ElevenLabs STT error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const transcription = await transcribeResponse.json();
    console.log('Transcription result:', transcription);

    // If we have a lead ID, update the lead with insights
    if (leadId && transcription.text) {
      // Extract key insights using simple analysis
      const text = transcription.text.toLowerCase();
      
      const insights = {
        interested: text.includes('interested') || text.includes('tell me more') || text.includes('sounds good'),
        concerns: text.includes('concern') || text.includes('worry') || text.includes('not sure'),
        timeline: text.includes('soon') || text.includes('immediately') || text.includes('asap') 
          ? 'urgent' 
          : text.includes('month') || text.includes('later') 
          ? 'future' 
          : 'unknown',
        budget_mentioned: text.includes('budget') || text.includes('cost') || text.includes('price') || text.includes('fee'),
      };

      // Update lead notes with transcription summary
      const { data: lead } = await supabase
        .from('leads')
        .select('notes')
        .eq('id', leadId)
        .single();

      const newNote = `\n\n--- Call Transcription (${new Date().toLocaleDateString()}) ---\n${transcription.text}`;
      
      await supabase
        .from('leads')
        .update({ 
          notes: (lead?.notes || '') + newNote,
          ai_summary: `Call insights: ${insights.interested ? 'Shows interest. ' : ''}${insights.concerns ? 'Has concerns. ' : ''}Timeline: ${insights.timeline}.`
        })
        .eq('id', leadId);

      // Add timeline entry
      await supabase.from('lead_timeline').insert({
        lead_id: leadId,
        action: 'call_transcribed',
        metadata: { 
          call_sid: callSid,
          word_count: transcription.words?.length || 0,
          insights,
        },
      });

      // Update communication record if we have a call SID
      if (callSid) {
        await supabase
          .from('lead_communications')
          .update({ 
            body: transcription.text,
            status: 'transcribed',
          })
          .eq('external_id', callSid);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcription: transcription.text,
        words: transcription.words,
        audioEvents: transcription.audio_events,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
