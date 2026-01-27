import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseStoredPresentationAudioOptions {
  presentation: "onboarding" | "owner-portal";
  onAudioEnd?: () => void;
}

export function useStoredPresentationAudio(options: UseStoredPresentationAudioOptions) {
  const { presentation } = options;
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);
  
  // Audio element for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCache = useRef<Map<string, string>>(new Map());
  const onAudioEndRef = useRef<(() => void) | null>(null);
  // Mutex lock to prevent double-play
  const isPlayingSlideRef = useRef<string | null>(null);

  // Build the storage URL for a slide
  const getStorageUrl = useCallback((slideId: string) => {
    const { data } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(`presentation-audio/${presentation}/${slideId}.mp3`);
    return data.publicUrl;
  }, [presentation]);

  // Preload audio URLs on mount
  useEffect(() => {
    const preloadUrls = async () => {
      // Test if first slide audio exists
      const testUrl = getStorageUrl("title");
      try {
        const response = await fetch(testUrl, { method: "HEAD" });
        if (response.ok) {
          setIsPreloaded(true);
        }
      } catch {
        console.log("Audio files not yet generated");
      }
    };
    preloadUrls();
  }, [getStorageUrl]);

  const stopAudio = useCallback(() => {
    isPlayingSlideRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const playAudioForSlide = useCallback(async (
    slideId: string,
    _script: string, // Kept for API compatibility
    onEnd?: () => void
  ): Promise<void> => {
    if (isMuted) {
      onEnd?.();
      return;
    }
    
    // Prevent double-play
    if (isPlayingSlideRef.current === slideId) {
      console.log("Already playing slide:", slideId);
      return;
    }
    
    // Stop current audio
    stopAudio();
    
    // Lock this slide
    isPlayingSlideRef.current = slideId;
    setCurrentSlideId(slideId);
    onAudioEndRef.current = onEnd || null;

    // Get or build URL
    let audioUrl = audioUrlCache.current.get(slideId);
    if (!audioUrl) {
      audioUrl = getStorageUrl(slideId);
      audioUrlCache.current.set(slideId, audioUrl);
    }

    setIsLoading(true);

    // Create and play audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    audio.src = audioUrl;
    
    audio.oncanplaythrough = () => {
      setIsLoading(false);
      setIsPlaying(true);
      audio.play().catch(err => {
        console.error("Playback error:", err);
        setIsPlaying(false);
        isPlayingSlideRef.current = null;
        onEnd?.();
      });
    };

    audio.onended = () => {
      isPlayingSlideRef.current = null;
      setIsPlaying(false);
      onAudioEndRef.current?.();
    };

    audio.onerror = (e) => {
      console.error("Audio error:", e);
      setIsLoading(false);
      setIsPlaying(false);
      isPlayingSlideRef.current = null;
      onEnd?.();
    };

    audio.load();
  }, [isMuted, getStorageUrl, stopAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        stopAudio();
      }
      return !prev;
    });
  }, [stopAudio]);

  // Initialize audio context on user interaction
  const initAudioContext = useCallback(() => {
    // No-op for stored audio, but kept for API compatibility
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    playAudioForSlide,
    stopAudio,
    isMuted,
    setIsMuted,
    toggleMute,
    isLoading,
    isPlaying,
    currentSlideId,
    isPreloaded,
    initAudioContext,
  };
}
