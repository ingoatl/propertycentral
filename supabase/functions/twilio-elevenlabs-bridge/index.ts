import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mulaw to PCM conversion table
const MULAW_TO_PCM = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const mu = ~i & 0xFF;
  const sign = (mu & 0x80) ? -1 : 1;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0F;
  const sample = sign * ((mantissa << 1) + 33) * (1 << exponent) - sign * 33;
  MULAW_TO_PCM[i] = sample;
}

// PCM to Mulaw conversion
function pcmToMulaw(sample: number): number {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;
  
  const sign = sample < 0 ? 0x80 : 0;
  if (sign) sample = -sample;
  if (sample > MULAW_MAX) sample = MULAW_MAX;
  
  sample += MULAW_BIAS;
  
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  
  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const mulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  
  return mulaw;
}

// Convert mulaw 8kHz to PCM 16kHz (upsample 2x with linear interpolation)
function mulawToPcm16k(mulawData: Uint8Array): Int16Array {
  const pcm8k = new Int16Array(mulawData.length);
  for (let i = 0; i < mulawData.length; i++) {
    pcm8k[i] = MULAW_TO_PCM[mulawData[i]];
  }
  
  // Upsample from 8kHz to 16kHz with linear interpolation
  const pcm16k = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length; i++) {
    pcm16k[i * 2] = pcm8k[i];
    if (i < pcm8k.length - 1) {
      pcm16k[i * 2 + 1] = Math.round((pcm8k[i] + pcm8k[i + 1]) / 2);
    } else {
      pcm16k[i * 2 + 1] = pcm8k[i];
    }
  }
  
  return pcm16k;
}

// Convert PCM 16kHz to mulaw 8kHz (downsample 2x)
function pcm16kToMulaw8k(pcmData: Int16Array): Uint8Array {
  // Downsample from 16kHz to 8kHz (take every other sample)
  const mulawData = new Uint8Array(Math.floor(pcmData.length / 2));
  for (let i = 0; i < mulawData.length; i++) {
    mulawData[i] = pcmToMulaw(pcmData[i * 2]);
  }
  return mulawData;
}

// Base64 encode/decode helpers
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function int16ToBytes(int16Array: Int16Array): Uint8Array {
  return new Uint8Array(int16Array.buffer);
}

function bytesToInt16(bytes: Uint8Array): Int16Array {
  // Create a new buffer and copy bytes to ensure proper alignment
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return new Int16Array(buffer);
}

// Fetch caller context from database
async function fetchCallerContext(callerPhone: string): Promise<{
  name: string | null;
  propertyAddress: string | null;
  stage: string | null;
  lastContact: string | null;
  isNewCaller: boolean;
  hasScheduledCall: boolean;
  notes: string | null;
  communicationHistory: { calls: number; emails: number; sms: number };
}> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Normalize phone number for lookup
  let normalizedPhone = callerPhone;
  if (normalizedPhone.startsWith('+1')) {
    normalizedPhone = normalizedPhone.substring(2);
  } else if (normalizedPhone.startsWith('+')) {
    normalizedPhone = normalizedPhone.substring(1);
  }

  // Look up lead by phone
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, property_address, stage, notes, last_contacted_at')
    .or(`phone.eq.${callerPhone},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
    .maybeSingle();

  if (!lead) {
    // Check property owners
    const { data: owner } = await supabase
      .from('property_owners')
      .select('id, name, phone, properties(address)')
      .or(`phone.eq.${callerPhone},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone},phone.ilike.%${normalizedPhone}%`)
      .maybeSingle();

    if (owner) {
      return {
        name: owner.name,
        propertyAddress: owner.properties?.[0]?.address || null,
        stage: 'owner',
        lastContact: null,
        isNewCaller: false,
        hasScheduledCall: false,
        notes: null,
        communicationHistory: { calls: 0, emails: 0, sms: 0 },
      };
    }

    return {
      name: null,
      propertyAddress: null,
      stage: null,
      lastContact: null,
      isNewCaller: true,
      hasScheduledCall: false,
      notes: null,
      communicationHistory: { calls: 0, emails: 0, sms: 0 },
    };
  }

  // Get communication history
  const { data: communications } = await supabase
    .from('lead_communications')
    .select('communication_type')
    .eq('lead_id', lead.id);

  const calls = communications?.filter(c => c.communication_type === 'call').length || 0;
  const emails = communications?.filter(c => c.communication_type === 'email').length || 0;
  const sms = communications?.filter(c => c.communication_type === 'sms').length || 0;

  // Check for scheduled discovery call
  const now = new Date();
  const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const { data: scheduledCall } = await supabase
    .from('discovery_calls')
    .select('id')
    .eq('lead_id', lead.id)
    .eq('status', 'scheduled')
    .gte('scheduled_at', thirtyMinutesAgo.toISOString())
    .lte('scheduled_at', thirtyMinutesFromNow.toISOString())
    .maybeSingle();

  return {
    name: lead.name,
    propertyAddress: lead.property_address,
    stage: lead.stage,
    lastContact: lead.last_contacted_at,
    isNewCaller: false,
    hasScheduledCall: !!scheduledCall,
    notes: lead.notes,
    communicationHistory: { calls, emails, sms },
  };
}

// Generate dynamic greeting based on caller context
function generateDynamicGreeting(context: Awaited<ReturnType<typeof fetchCallerContext>>): string {
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (context.hasScheduledCall && context.name) {
    return `${timeGreeting} ${context.name}! Thank you for joining our scheduled call. I'm excited to speak with you about your property. How are you doing today?`;
  }

  if (context.name) {
    if (context.stage === 'owner') {
      return `${timeGreeting} ${context.name}! Great to hear from you. How can I help you with your property today?`;
    }
    
    if (context.communicationHistory.calls > 0) {
      return `${timeGreeting} ${context.name}! It's great to hear from you again. How can I help you today?`;
    }
    
    if (context.propertyAddress) {
      return `${timeGreeting} ${context.name}! Thank you for calling about ${context.propertyAddress}. I'm here to help - what questions can I answer for you?`;
    }
    
    return `${timeGreeting} ${context.name}! Thank you for calling Peachhaus Property Management. How can I assist you today?`;
  }

  // New or unknown caller
  return `${timeGreeting}! Thank you for calling Peachhaus Property Management. My name is Ava, and I'd be happy to help you. May I ask who I'm speaking with?`;
}

// Generate system prompt with caller context
function generateSystemPromptOverride(context: Awaited<ReturnType<typeof fetchCallerContext>>): string {
  const basePrompt = `You are Ava, a friendly and professional AI assistant for Peachhaus Property Management, Atlanta's premier property management company specializing in mid-term rentals.`;

  if (!context.name) {
    return basePrompt + `\n\nThis appears to be a new caller. Be warm and welcoming. Collect their name and understand their needs.`;
  }

  let contextPrompt = basePrompt + `\n\nCALLER CONTEXT:`;
  contextPrompt += `\n- Name: ${context.name}`;
  
  if (context.propertyAddress) {
    contextPrompt += `\n- Property: ${context.propertyAddress}`;
  }
  
  if (context.stage && context.stage !== 'owner') {
    contextPrompt += `\n- Lead Stage: ${context.stage.replace(/_/g, ' ')}`;
  }
  
  if (context.stage === 'owner') {
    contextPrompt += `\n- This is a property OWNER, not a lead. Provide white-glove service.`;
  }
  
  if (context.hasScheduledCall) {
    contextPrompt += `\n- This is a SCHEDULED DISCOVERY CALL - be prepared to discuss property management services in detail.`;
  }
  
  if (context.communicationHistory.calls > 0) {
    contextPrompt += `\n- Previous calls: ${context.communicationHistory.calls}`;
  }
  
  if (context.notes) {
    contextPrompt += `\n- Notes: ${context.notes.substring(0, 200)}`;
  }

  contextPrompt += `\n\nUse this context to personalize the conversation. Reference their property if relevant. Be warm, professional, and helpful.`;
  
  // Add transfer rules
  contextPrompt += `\n\nTRANSFER RULES:`;
  contextPrompt += `\n- If caller asks for a human or seems frustrated, offer to transfer to a team member`;
  contextPrompt += `\n- If discussing complex legal, financial, or contract matters, offer to transfer`;
  contextPrompt += `\n- If caller explicitly requests to schedule a call with a human, help schedule and confirm`;

  return contextPrompt;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log("Twilio WebSocket connection request received");

  const { socket: twilioSocket, response } = Deno.upgradeWebSocket(req);
  
  let elevenLabsSocket: WebSocket | null = null;
  let streamSid: string | null = null;
  let callSid: string | null = null;
  let callerNumber: string | null = null;
  let leadName: string | null = null;
  let audioChunksSent = 0;
  let audioChunksReceived = 0;
  let callerContext: Awaited<ReturnType<typeof fetchCallerContext>> | null = null;

  const connectToElevenLabs = async () => {
    try {
      // Fetch caller context if we have a phone number
      if (callerNumber) {
        console.log("Fetching caller context for:", callerNumber);
        callerContext = await fetchCallerContext(callerNumber);
        console.log("Caller context:", JSON.stringify(callerContext, null, 2));
      }

      console.log("Getting ElevenLabs signed URL...");
      const signedUrlResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY || '',
          },
        }
      );

      if (!signedUrlResponse.ok) {
        const errorText = await signedUrlResponse.text();
        console.error("Failed to get ElevenLabs signed URL:", signedUrlResponse.status, errorText);
        return;
      }

      const { signed_url } = await signedUrlResponse.json();
      console.log("Got ElevenLabs signed URL, connecting...");

      elevenLabsSocket = new WebSocket(signed_url);

      elevenLabsSocket.onopen = () => {
        console.log("ElevenLabs WebSocket connected");
        
        // Send conversation config with dynamic first message and context
        if (callerContext && elevenLabsSocket) {
          const dynamicGreeting = generateDynamicGreeting(callerContext);
          const systemPromptOverride = generateSystemPromptOverride(callerContext);
          
          console.log("Sending dynamic greeting:", dynamicGreeting);
          
          // Send conversation initialization with overrides
          const initMessage = {
            type: "conversation_initiation_client_data",
            conversation_initiation_client_data: {
              conversation_config_override: {
                agent: {
                  prompt: {
                    prompt: systemPromptOverride
                  },
                  first_message: dynamicGreeting,
                }
              },
              custom_llm_extra_body: {
                caller_name: callerContext.name || "Unknown",
                caller_phone: callerNumber,
                caller_property: callerContext.propertyAddress || "Not specified",
                caller_stage: callerContext.stage || "new",
                has_scheduled_call: callerContext.hasScheduledCall,
              }
            }
          };
          
          elevenLabsSocket.send(JSON.stringify(initMessage));
        }
      };

      elevenLabsSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log all message types except ping for debugging
          if (data.type !== 'ping') {
            console.log("ElevenLabs received:", data.type);
          }

          // Handle conversation initiation metadata - this confirms the agent is ready
          if (data.type === 'conversation_initiation_metadata') {
            console.log("ElevenLabs agent initialized, conversation_id:", data.conversation_initiation_metadata_event?.conversation_id);
          }

          // Handle audio from ElevenLabs - it sends audio in "audio" type messages
          if (data.type === 'audio') {
            // Try multiple possible audio data locations
            let audioBase64: string | null = null;
            
            if (data.audio_event?.audio_base_64) {
              audioBase64 = data.audio_event.audio_base_64;
            } else if (data.audio) {
              audioBase64 = data.audio;
            }
            
            if (audioBase64 && streamSid) {
              audioChunksReceived++;
              if (audioChunksReceived <= 3 || audioChunksReceived % 50 === 0) {
                console.log(`Processing ElevenLabs audio chunk #${audioChunksReceived}, base64 length: ${audioBase64.length}`);
              }
              
              try {
                // Decode base64 PCM audio from ElevenLabs (16kHz, 16-bit, mono)
                const pcmBytes = base64ToBytes(audioBase64);
                const pcm16k = bytesToInt16(pcmBytes);
                
                // Convert to mulaw 8kHz for Twilio
                const mulawData = pcm16kToMulaw8k(pcm16k);
                const mulawBase64 = bytesToBase64(mulawData);
                
                // Send to Twilio
                const twilioMessage = {
                  event: 'media',
                  streamSid: streamSid,
                  media: {
                    payload: mulawBase64
                  }
                };
                twilioSocket.send(JSON.stringify(twilioMessage));
                
                if (audioChunksReceived <= 3) {
                  console.log(`Sent audio chunk #${audioChunksReceived} to Twilio, mulaw size: ${mulawData.length} bytes`);
                }
              } catch (audioError) {
                console.error("Error converting ElevenLabs audio:", audioError);
              }
            }
          }

          // Handle agent response text for logging
          if (data.type === 'agent_response') {
            console.log("Agent speaking:", data.agent_response_event?.agent_response?.substring(0, 100));
          }

          // Handle user transcript for logging
          if (data.type === 'user_transcript') {
            console.log("User said:", data.user_transcript_event?.user_transcript?.substring(0, 100));
          }

          // Handle interruption
          if (data.type === 'interruption') {
            console.log("User interrupted agent");
          }

          // Handle client tool calls (like transfer to human)
          if (data.type === 'client_tool_call') {
            const toolCall = data.client_tool_call;
            console.log("Client tool call received:", toolCall?.tool_name);
            
            if (toolCall?.tool_name === 'transfer_to_human') {
              console.log("Transfer to human requested");
              // TODO: Implement call transfer logic
            }
          }

        } catch (e) {
          console.error("Error processing ElevenLabs message:", e);
        }
      };

      elevenLabsSocket.onerror = (error) => {
        console.error("ElevenLabs WebSocket error:", error);
      };

      elevenLabsSocket.onclose = (event) => {
        console.log("ElevenLabs WebSocket closed, code:", event.code, "reason:", event.reason);
        
        // Trigger post-call processing
        if (callSid && callerNumber) {
          triggerPostCallProcessing(callSid, callerNumber, callerContext);
        }
      };

    } catch (error) {
      console.error("Error setting up ElevenLabs connection:", error);
    }
  };

  // Trigger post-call processing to create action items
  async function triggerPostCallProcessing(
    callSid: string, 
    callerPhone: string,
    context: Awaited<ReturnType<typeof fetchCallerContext>> | null
  ) {
    try {
      console.log("Triggering post-call processing for call:", callSid);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/voice-ai-post-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          callSid,
          callerPhone,
          callerName: context?.name || null,
          callerStage: context?.stage || null,
          propertyAddress: context?.propertyAddress || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Post-call processing triggered:", result);
      } else {
        console.error("Post-call processing failed:", await response.text());
      }
    } catch (error) {
      console.error("Error triggering post-call processing:", error);
    }
  }

  twilioSocket.onopen = () => {
    console.log("Twilio WebSocket connected");
  };

  twilioSocket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        callSid = data.start.callSid;
        
        // Extract custom parameters from Twilio stream
        const customParams = data.start.customParameters || {};
        callerNumber = customParams.caller_number || null;
        leadName = customParams.lead_name || null;
        
        console.log("Twilio stream started:", { streamSid, callSid, callerNumber, leadName });
        
        // Now connect to ElevenLabs after we have the caller info
        await connectToElevenLabs();
      } 
      else if (data.event === 'media') {
        if (elevenLabsSocket?.readyState === WebSocket.OPEN) {
          // Decode mulaw audio from Twilio (8kHz)
          const mulawData = base64ToBytes(data.media.payload);
          
          // Convert mulaw 8kHz to PCM 16kHz for ElevenLabs
          const pcm16k = mulawToPcm16k(mulawData);
          const pcmBytes = int16ToBytes(pcm16k);
          const pcmBase64 = bytesToBase64(pcmBytes);
          
          // Send to ElevenLabs in the correct format
          const audioMessage = {
            user_audio_chunk: pcmBase64
          };
          elevenLabsSocket.send(JSON.stringify(audioMessage));
          
          audioChunksSent++;
          if (audioChunksSent <= 3 || audioChunksSent % 100 === 0) {
            console.log(`Sent audio chunk #${audioChunksSent} to ElevenLabs, PCM size: ${pcmBytes.length} bytes`);
          }
        }
      }
      else if (data.event === 'stop') {
        console.log("Twilio stream stopped");
        elevenLabsSocket?.close();
      }
    } catch (e) {
      console.error("Error processing Twilio message:", e);
    }
  };

  twilioSocket.onerror = (error) => {
    console.error("Twilio WebSocket error:", error);
    elevenLabsSocket?.close();
  };

  twilioSocket.onclose = () => {
    console.log("Twilio WebSocket closed");
    elevenLabsSocket?.close();
  };

  return response;
});
