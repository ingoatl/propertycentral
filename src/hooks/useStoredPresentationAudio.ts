import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseStoredPresentationAudioOptions {
  presentation: "onboarding" | "owner-portal" | "designer";
  onAudioEnd?: () => void;
}

// Uplifting cinematic background music URL (stored in Supabase) - with cache bust for new track
const BACKGROUND_MUSIC_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/message-attachments/presentation-audio/background-music.mp3?v=6";

export function useStoredPresentationAudio(options: UseStoredPresentationAudioOptions) {
  const { presentation } = options;
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlideId, setCurrentSlideId] = useState<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  
  // Audio elements for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCache = useRef<Map<string, string>>(new Map());
  const onAudioEndRef = useRef<(() => void) | null>(null);
  // Mutex lock to prevent double-play
  const isPlayingSlideRef = useRef<string | null>(null);

  // Build the storage URL for a slide (with cache bust for fresh audio)
  const getStorageUrl = useCallback((slideId: string) => {
    const { data } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(`presentation-audio/${presentation}/${slideId}.mp3`);
    return `${data.publicUrl}?v=3`;
  }, [presentation]);

  // Preload audio URLs on mount
  useEffect(() => {
    const preloadUrls = async () => {
      // Test if first slide audio exists
      const testSlide = presentation === "onboarding" ? "title" : "intro";
      const testUrl = getStorageUrl(testSlide);
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
  }, [getStorageUrl, presentation]);

  // Start background music (uplifting ambient) - completely optional, non-blocking
  const startBackgroundMusic = useCallback(() => {
    if (isMuted || isMusicPlaying) return;
    
    // Try to play background music but don't block if it fails
    try {
      if (!musicRef.current) {
        musicRef.current = new Audio(BACKGROUND_MUSIC_URL);
        musicRef.current.loop = true;
        musicRef.current.volume = 0.08; // Slightly louder background music at 8%
      }
      
      // Fire and forget - don't await or handle errors that would block
      musicRef.current.play()
        .then(() => setIsMusicPlaying(true))
        .catch(() => {
          // Background music is completely optional - silently ignore failures
          console.log("Background music not available - continuing without it");
        });
    } catch {
      // Ignore any errors - background music is non-essential
    }
  }, [isMuted, isMusicPlaying]);

  // Stop background music
  const stopBackgroundMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
    setIsMusicPlaying(false);
  }, []);

  const stopAudio = useCallback(() => {
    // Only clear the slide ref - don't break the autoplay mechanism
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Clear event handlers to prevent stale callbacks
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const playAudioForSlide = useCallback(async (
    slideId: string,
    _script: string, // Kept for API compatibility
    onEnd?: () => void
  ): Promise<void> => {
    // Start background music if not already playing (optional enhancement)
    startBackgroundMusic();
    
    if (isMuted) {
      // Even when muted, call onEnd after a short delay to allow auto-advance
      setTimeout(() => {
        onEnd?.();
      }, 100);
      return;
    }
    
    // Prevent double-play for same slide
    if (isPlayingSlideRef.current === slideId) {
      console.log("Already playing slide:", slideId);
      return;
    }
    
    // Stop current audio first (without clearing the ref yet)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    
    // Now lock this slide
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

    // Create audio element if needed
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    audio.src = audioUrl;
    
    // Set up event handlers
    audio.oncanplaythrough = () => {
      // Verify we're still meant to play this slide
      if (isPlayingSlideRef.current !== slideId) {
        return;
      }
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
      console.log("Audio ended for slide:", slideId);
      isPlayingSlideRef.current = null;
      setIsPlaying(false);
      // Call the stored callback
      onAudioEndRef.current?.();
    };

    audio.onerror = (e) => {
      console.error("Audio error for slide:", slideId, e);
      setIsLoading(false);
      setIsPlaying(false);
      isPlayingSlideRef.current = null;
      // Still call onEnd to allow auto-advance even if audio fails
      onEnd?.();
    };

    audio.load();
  }, [isMuted, getStorageUrl, startBackgroundMusic]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        stopAudio();
        stopBackgroundMusic();
      }
      return !prev;
    });
  }, [stopAudio, stopBackgroundMusic]);

  // Initialize audio context on user interaction
  const initAudioContext = useCallback(() => {
    // Start background music on first interaction
    startBackgroundMusic();
  }, [startBackgroundMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current = null;
      }
    };
  }, []);

  return {
    playAudioForSlide,
    stopAudio,
    stopBackgroundMusic,
    isMuted,
    setIsMuted,
    toggleMute,
    isLoading,
    isPlaying,
    isMusicPlaying,
    currentSlideId,
    isPreloaded,
    initAudioContext,
  };
}
