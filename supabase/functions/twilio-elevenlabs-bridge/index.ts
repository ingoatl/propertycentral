import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID');

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Handle WebSocket upgrade from Twilio
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
        console.error("Failed to get ElevenLabs signed URL");
        twilioSocket.close();
        return;
      }

      const { signed_url } = await signedUrlResponse.json();
      console.log("Got ElevenLabs signed URL, connecting...");

      // Connect to ElevenLabs
      elevenLabsSocket = new WebSocket(signed_url);

      elevenLabsSocket.onopen = () => {
        console.log("ElevenLabs WebSocket connected");
      };

      elevenLabsSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("ElevenLabs message:", data.type);

          // Handle audio from ElevenLabs
          if (data.type === 'audio' && data.audio && streamSid) {
            // ElevenLabs sends base64 audio - forward to Twilio
            const twilioMessage = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: data.audio // Already base64
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
        // Forward audio from Twilio to ElevenLabs
        // Twilio sends mulaw 8kHz, ElevenLabs expects PCM 16kHz
        // For now, send raw - ElevenLabs may handle conversion
        const audioMessage = {
          user_audio_chunk: data.media.payload
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
