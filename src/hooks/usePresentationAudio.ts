import { useState, useRef, useCallback } from "react";

interface UsePresentationAudioOptions {
  voiceId?: string;
}

export function usePresentationAudio(options: UsePresentationAudioOptions = {}) {
  const { voiceId = "EXAVITQu4vr4xnSDxMaL" } = options; // Sarah voice - professional female
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const playAudioForSlide = useCallback(async (slideId: string, script: string) => {
    if (isMuted || !script) return;
    
    // Stop any currently playing audio
    stopAudio();
    setCurrentSlideId(slideId);

    // Check cache first
    let audioUrl = audioCache.current.get(slideId);
    
    if (!audioUrl) {
      setIsLoading(true);
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              text: script, 
              voiceId 
            }),
          }
        );

        if (!response.ok) {
          console.error("TTS request failed:", response.status);
          setIsLoading(false);
          return;
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        audioCache.current.set(slideId, audioUrl);
      } catch (error) {
        console.error("Failed to generate audio:", error);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(false);
    }

    // Play the audio
    audioRef.current = new Audio(audioUrl);
    audioRef.current.volume = 0.8;
    
    try {
      await audioRef.current.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
    }
  }, [isMuted, voiceId, stopAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        // Muting - stop current audio
        stopAudio();
      }
      return !prev;
    });
  }, [stopAudio]);

  return { 
    playAudioForSlide, 
    stopAudio,
    isMuted, 
    setIsMuted,
    toggleMute,
    isLoading,
    currentSlideId
  };
}
