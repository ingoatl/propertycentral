import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID');

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
  return new Int16Array(bytes.buffer);
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

  twilioSocket.onopen = async () => {
    console.log("Twilio WebSocket connected");
    
    try {
      // Get signed URL for ElevenLabs conversation
      const signedUrlResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
        {
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY || '',
          },
        }
      );

      if (!signedUrlResponse.ok) {
        console.error("Failed to get ElevenLabs signed URL:", await signedUrlResponse.text());
        twilioSocket.close();
        return;
      }

      const { signed_url } = await signedUrlResponse.json();
      console.log("Got ElevenLabs signed URL, connecting...");

      // Connect to ElevenLabs
      elevenLabsSocket = new WebSocket(signed_url);

      elevenLabsSocket.onopen = () => {
        console.log("ElevenLabs WebSocket connected");
        
        // Send initial configuration to ElevenLabs
        const initMessage = {
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            agent: {
              first_message: "Hello! Thank you for calling Peachhaus Property Management. How can I help you today?"
            }
          }
        };
        elevenLabsSocket!.send(JSON.stringify(initMessage));
        console.log("Sent first_message override to ElevenLabs");
      };

      elevenLabsSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type !== 'ping') {
            console.log("ElevenLabs message:", data.type);
          }

          // Handle audio from ElevenLabs (PCM 16kHz)
          if (data.type === 'audio' && data.audio_event?.audio_base_64 && streamSid) {
            // Decode base64 PCM audio from ElevenLabs
            const pcmBytes = base64ToBytes(data.audio_event.audio_base_64);
            const pcm16k = bytesToInt16(pcmBytes);
            
            // Convert to mulaw 8kHz for Twilio
            const mulawData = pcm16kToMulaw8k(pcm16k);
            const mulawBase64 = bytesToBase64(mulawData);
            
            const twilioMessage = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: mulawBase64
              }
            };
            twilioSocket.send(JSON.stringify(twilioMessage));
          }
          
          // Also check for the alternate audio format
          if (data.type === 'audio' && data.audio && streamSid) {
            const pcmBytes = base64ToBytes(data.audio);
            const pcm16k = bytesToInt16(pcmBytes);
            const mulawData = pcm16kToMulaw8k(pcm16k);
            const mulawBase64 = bytesToBase64(mulawData);
            
            const twilioMessage = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: mulawBase64
              }
            };
            twilioSocket.send(JSON.stringify(twilioMessage));
          }
        } catch (e) {
          console.error("Error processing ElevenLabs message:", e);
        }
      };

      elevenLabsSocket.onerror = (error) => {
        console.error("ElevenLabs WebSocket error:", error);
      };

      elevenLabsSocket.onclose = () => {
        console.log("ElevenLabs WebSocket closed");
      };

    } catch (error) {
      console.error("Error setting up ElevenLabs connection:", error);
      twilioSocket.close();
    }
  };

  twilioSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        callSid = data.start.callSid;
        console.log("Twilio stream started:", { streamSid, callSid });
      } 
      else if (data.event === 'media' && elevenLabsSocket?.readyState === WebSocket.OPEN) {
        // Decode mulaw audio from Twilio
        const mulawData = base64ToBytes(data.media.payload);
        
        // Convert mulaw 8kHz to PCM 16kHz
        const pcm16k = mulawToPcm16k(mulawData);
        const pcmBytes = int16ToBytes(pcm16k);
        const pcmBase64 = bytesToBase64(pcmBytes);
        
        // Send to ElevenLabs
        const audioMessage = {
          user_audio_chunk: pcmBase64
        };
        elevenLabsSocket.send(JSON.stringify(audioMessage));
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
