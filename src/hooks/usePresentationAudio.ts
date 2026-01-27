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
  
  // Web Audio API for zero-latency playback
  const audioContext = useRef<AudioContext | null>(null);
  const audioBufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSource = useRef<AudioBufferSourceNode | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const onAudioEndRef = useRef<(() => void) | null>(null);
  const preloadingRef = useRef(false);
  // CRITICAL: Mutex lock to prevent double-play of same slide (React Strict Mode fix)
  const isPlayingSlideRef = useRef<string | null>(null);

  // Initialize AudioContext (must be after user interaction)
  const initAudioContext = useCallback(() => {
    if (!audioContext.current) {
      audioContext.current = new AudioContext();
      gainNode.current = audioContext.current.createGain();
      gainNode.current.gain.value = 0.8;
      gainNode.current.connect(audioContext.current.destination);
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }
    return audioContext.current;
  }, []);

  // Preload and decode audio for a slide
  const preloadAudioBuffer = useCallback(async (slideId: string, script: string): Promise<void> => {
    if (!script || audioBufferCache.current.has(slideId)) return;
    
    const ctx = initAudioContext();
    
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

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferCache.current.set(slideId, audioBuffer);
      }
    } catch (error) {
      console.error(`Failed to preload audio for slide ${slideId}:`, error);
    }
  }, [voiceId, initAudioContext]);

  // Preload audio for slides on mount - preload first 3 slides in parallel for critical path
  useEffect(() => {
    if (preloadSlides.length === 0 || preloadingRef.current) return;
    
    preloadingRef.current = true;
    
    const preloadAudio = async () => {
      // Initialize audio context early
      initAudioContext();
      
      // Parallel preload of first 3 slides (critical path for immediate playback)
      const criticalSlides = preloadSlides.slice(0, 3);
      
      await Promise.all(
        criticalSlides.map((slide) => preloadAudioBuffer(slide.id, slide.script))
      );
      
      setIsPreloaded(true); // Ready signal - first 3 slides loaded
      
      // Background preload remaining slides with fire-and-forget (no await blocks UI)
      const remainingSlides = preloadSlides.slice(3);
      remainingSlides.forEach((slide) => {
        preloadAudioBuffer(slide.id, slide.script); // Fire and forget
      });
    };
    
    preloadAudio();
  }, [preloadSlides, preloadAudioBuffer, initAudioContext]);

  const stopAudio = useCallback(() => {
    // Clear playback lock when stopping
    isPlayingSlideRef.current = null;
    
    if (activeSource.current) {
      try {
        activeSource.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      activeSource.current = null;
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
    
    // CRITICAL: Check if already playing this slide (prevents double-trigger from React Strict Mode)
    if (isPlayingSlideRef.current === slideId) {
      console.log("Already playing slide:", slideId, "- skipping duplicate call");
      return;
    }
    
    // Stop any currently playing audio first
    stopAudio();
    
    // Lock this slide to prevent duplicate plays
    isPlayingSlideRef.current = slideId;
    setCurrentSlideId(slideId);
    onAudioEndRef.current = onEnd || null;

    const ctx = initAudioContext();

    // Check buffer cache first
    let audioBuffer = audioBufferCache.current.get(slideId);
    
    if (!audioBuffer) {
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

        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferCache.current.set(slideId, audioBuffer);
      } catch (error) {
        console.error("Failed to generate audio:", error);
        setIsLoading(false);
        onEnd?.();
        return;
      }
      
      setIsLoading(false);
    }

    // Create buffer source for instant playback
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    
    if (gainNode.current) {
      source.connect(gainNode.current);
    } else {
      source.connect(ctx.destination);
    }
    
    // Handle audio end
    source.onended = () => {
      // Clear the playback lock when audio ends
      isPlayingSlideRef.current = null;
      setIsPlaying(false);
      activeSource.current = null;
      onAudioEndRef.current?.();
    };
    
    activeSource.current = source;
    setIsPlaying(true);
    
    // Start playback immediately - no delay!
    source.start(0);
  }, [isMuted, voiceId, stopAudio, initAudioContext]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      if (!prev) {
        // Muting - stop current audio
        stopAudio();
      }
      return !prev;
    });
  }, [stopAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
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
    isPreloaded,
    initAudioContext // Expose for user interaction initialization
  };
}
