import { useState, useRef, useCallback, useEffect } from "react";

interface UsePresentationAudioOptions {
  voiceId?: string;
  onAudioEnd?: () => void;
  preloadSlides?: Array<{ id: string; script: string }>;
}

export function usePresentationAudio(options: UsePresentationAudioOptions = {}) {
  // Sarah voice - professional female narrator
  const { voiceId = "EXAVITQu4vr4xnSDxMaL", preloadSlides = [] } = options;
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  const onAudioEndRef = useRef<(() => void) | null>(null);
  const preloadingRef = useRef(false);

  // Preload audio for slides on mount
  useEffect(() => {
    if (preloadSlides.length === 0 || preloadingRef.current) return;
    
    preloadingRef.current = true;
    
    const preloadAudio = async () => {
      // Preload first 3 slides for immediate playback
      const slidesToPreload = preloadSlides.slice(0, 3);
      
      await Promise.all(
        slidesToPreload.map(async (slide) => {
          if (audioCache.current.has(slide.id) || !slide.script) return;
          
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
                  text: slide.script, 
                  voiceId 
                }),
              }
            );

            if (response.ok) {
              const audioBlob = await response.blob();
              const audioUrl = URL.createObjectURL(audioBlob);
              audioCache.current.set(slide.id, audioUrl);
            }
          } catch (error) {
            console.error(`Failed to preload audio for slide ${slide.id}:`, error);
          }
        })
      );
      
      setIsPreloaded(true);
    };
    
    preloadAudio();
  }, [preloadSlides, voiceId]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAudioForSlide = useCallback(async (
    slideId: string, 
    script: string,
    onEnd?: () => void
  ): Promise<void> => {
    if (isMuted || !script) {
      // If muted, call onEnd immediately
      onEnd?.();
      return;
    }
    
    // Stop any currently playing audio
    stopAudio();
    setCurrentSlideId(slideId);
    onAudioEndRef.current = onEnd || null;

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
          onEnd?.();
          return;
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);
        audioCache.current.set(slideId, audioUrl);
      } catch (error) {
        console.error("Failed to generate audio:", error);
        setIsLoading(false);
        onEnd?.();
        return;
      }
      
      setIsLoading(false);
    }

    // Play the audio
    audioRef.current = new Audio(audioUrl);
    audioRef.current.volume = 0.8;
    setIsPlaying(true);
    
    // Handle audio end
    audioRef.current.onended = () => {
      setIsPlaying(false);
      onAudioEndRef.current?.();
    };
    
    try {
      await audioRef.current.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsPlaying(false);
      onEnd?.();
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
    isPlaying,
    currentSlideId,
    isPreloaded
  };
}