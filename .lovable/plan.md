
# Onboarding & Owner Portal Presentation Complete Optimization Plan

## Issues Identified Through Research

### 1. Double Narration Playback (Critical Bug)
**Root Cause Analysis:**
- In React Strict Mode (development), `useEffect` runs twice on mount, which triggers audio playback twice
- The current `audioEndedRef` guard is being reset on each render cycle before the protection kicks in
- When `isPlaying` changes, the effect runs again and may trigger playback before the previous instance cleanly exits

**Research Finding:**
From StackOverflow and React documentation: The standard fix is to use a ref-based flag that persists across the double-mount, and to implement proper cleanup that stops any existing audio before starting new playback.

### 2. Slow Audio Loading Times
**Root Cause Analysis:**
- Using `eleven_multilingual_v2` model which is highest quality but slower
- Using `mp3_44100_128` format (128kbps, 44.1kHz) - large file sizes
- Not using the faster `eleven_turbo_v2_5` model available for real-time use
- Audio preloading fetches sequentially for slides 6-18 after parallel load of first 5

**Research Finding:**
From ElevenLabs documentation:
- `eleven_turbo_v2_5` has **70% lower latency** than `eleven_multilingual_v2`
- `mp3_22050_32` format is 4x smaller than `mp3_44100_128` (adequate for speech)
- Streaming endpoint provides faster time-to-first-audio

### 3. Mobile Navigation Issues (User Screenshot)
**Analysis from Screenshot:**
- The bottom navigation bar is visible but appears cut off on the right
- Navigation dots (slide indicators) are hidden on mobile which is correct
- The `ChevronRight` button may be getting truncated or hard to tap
- Buttons appear correctly positioned but the bar could benefit from better touch targets

### 4. Error on Slides Ending
**Likely Cause:**
- When the presentation reaches the last slide and `isPlaying` is still true, the `advanceSlide` function is called which sets `isPlaying(false)`
- If there are pending timers or audio cleanup issues, this can cause race conditions
- The fallback timer may fire after the presentation has ended

---

## Technical Implementation Plan

### Phase 1: Fix Double-Play Bug with Proper Guards

**Strategy:** Implement a strict mutex-style lock that prevents any audio playback if one is already in progress or has been triggered for the current slide.

```typescript
// usePresentationAudio.ts changes
// Add a playback lock ref that tracks if we've started playback for a slide
const isPlayingSlideRef = useRef<string | null>(null);

const playAudioForSlide = useCallback(async (
  slideId: string, 
  script: string,
  onEnd?: () => void
): Promise<void> => {
  // CRITICAL: Check if already playing this slide (prevents double-trigger)
  if (isPlayingSlideRef.current === slideId) {
    console.log("Already playing slide:", slideId);
    return;
  }
  
  // Lock this slide
  isPlayingSlideRef.current = slideId;
  
  // ... rest of playback logic
  
  // On end/cleanup, clear the lock
  source.onended = () => {
    isPlayingSlideRef.current = null;
    // ...
  };
}, [...]);

// Add to stopAudio
const stopAudio = useCallback(() => {
  isPlayingSlideRef.current = null; // Clear lock
  // ... existing code
}, []);
```

**OnboardingPresentation.tsx changes:**
```typescript
// Add slide-specific guard in the useEffect
const hasPlayedForSlideRef = useRef<string | null>(null);

useEffect(() => {
  if (!isPlaying) {
    // ... cleanup
    return;
  }

  const slide = SLIDES[currentSlide];
  
  // Prevent double-play for this specific slide
  if (hasPlayedForSlideRef.current === slide.id) {
    return;
  }
  hasPlayedForSlideRef.current = slide.id;
  
  // ... playback logic
  
  return () => {
    hasPlayedForSlideRef.current = null; // Reset on cleanup
    // ... cleanup
  };
}, [currentSlide, isPlaying, ...]);
```

### Phase 2: Optimize TTS for Speed & File Size

**Edge Function Changes (elevenlabs-tts/index.ts):**

| Setting | Current | Optimized | Improvement |
|---------|---------|-----------|-------------|
| Model | `eleven_multilingual_v2` | `eleven_turbo_v2_5` | ~70% faster generation |
| Format | `mp3_44100_128` | `mp3_22050_32` | ~75% smaller files |
| Cache | None | Add CDN-friendly headers | Browser caching |

```typescript
// Updated elevenlabs-tts/index.ts
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_22050_32`,
  {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5", // FAST model
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
        // Remove style for turbo model (not supported as fully)
      },
    }),
  }
);

// Return with cache headers
return new Response(audioBuffer, {
  headers: {
    ...corsHeaders,
    "Content-Type": "audio/mpeg",
    "Cache-Control": "public, max-age=86400", // 24 hour cache
  },
});
```

### Phase 3: Improve Mobile Navigation

**Target Changes:**
1. Make navigation buttons larger on mobile (min-touch-target 44px)
2. Simplify the mobile navigation bar to only essential controls
3. Add swipe gesture support for slide navigation

```typescript
// OnboardingPresentation.tsx - Mobile optimized nav
<div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 z-50 bg-black/80 backdrop-blur-lg border border-white/10 rounded-full px-3 md:px-4 py-2">
  {/* Mobile-first button sizing */}
  <Button
    variant="ghost"
    size="icon"
    className="h-10 w-10 md:h-8 md:w-8 shrink-0 text-white/70 hover:text-white" // Larger on mobile
    onClick={prevSlide}
    disabled={currentSlide === 0}
  >
    <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
  </Button>
  
  {/* Play button - already good size */}
  <Button className="h-12 w-12 md:h-10 md:w-10 ...">
    {/* ... */}
  </Button>
  
  <Button
    variant="ghost"
    size="icon"
    className="h-10 w-10 md:h-8 md:w-8 shrink-0 text-white/70 hover:text-white"
    onClick={nextSlide}
    disabled={currentSlide === SLIDES.length - 1}
  >
    <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
  </Button>
  
  {/* Hide less essential controls on mobile */}
  <div className="hidden md:flex items-center gap-2">
    {/* Slide dots, restart, fullscreen */}
  </div>
</div>
```

**Add Touch Swipe Support:**
```typescript
// Add swipe handler using touch events
const touchStartX = useRef(0);
const touchEndX = useRef(0);

const handleTouchStart = (e: React.TouchEvent) => {
  touchStartX.current = e.touches[0].clientX;
};

const handleTouchEnd = (e: React.TouchEvent) => {
  touchEndX.current = e.changedTouches[0].clientX;
  const diff = touchStartX.current - touchEndX.current;
  
  if (Math.abs(diff) > 50) { // Minimum swipe distance
    if (diff > 0) {
      nextSlide(); // Swipe left = next
    } else {
      prevSlide(); // Swipe right = prev
    }
  }
};

// Add to container
<div 
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  className="..."
>
```

### Phase 4: Fix End-of-Presentation Error

**Strategy:** Add robust state guards when presentation ends

```typescript
const advanceSlide = useCallback(() => {
  // Guard: prevent advancing past the end
  if (currentSlide >= SLIDES.length - 1) {
    // Clean stop
    setIsPlaying(false);
    stopAudio();
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    audioEndedRef.current = true; // Prevent any pending callbacks
    return;
  }
  
  // Normal advance
  setCurrentSlide(currentSlide + 1);
}, [currentSlide, stopAudio]);
```

### Phase 5: Aggressive Audio Preloading

**Strategy:** Start preloading immediately and show loading state until first 3 slides are ready

```typescript
// usePresentationAudio.ts - Improved preloading
useEffect(() => {
  if (preloadSlides.length === 0 || preloadingRef.current) return;
  
  preloadingRef.current = true;
  
  const preloadAudio = async () => {
    initAudioContext();
    
    // Parallel preload of first 3 slides (critical path)
    const criticalSlides = preloadSlides.slice(0, 3);
    await Promise.all(
      criticalSlides.map((slide) => preloadAudioBuffer(slide.id, slide.script))
    );
    
    setIsPreloaded(true); // Ready signal
    
    // Background preload remaining slides with no await
    const remaining = preloadSlides.slice(3);
    remaining.forEach((slide) => {
      preloadAudioBuffer(slide.id, slide.script); // Fire and forget
    });
  };
  
  preloadAudio();
}, [...]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePresentationAudio.ts` | Add playback lock ref, prevent duplicate calls, optimize preloading |
| `src/pages/OnboardingPresentation.tsx` | Add slide-specific playback guard, fix end-of-presentation error, improve mobile nav, add swipe gestures |
| `src/pages/OwnerPortalPresentation.tsx` | Same mobile and playback improvements |
| `supabase/functions/elevenlabs-tts/index.ts` | Switch to turbo model, reduce file size, add cache headers |

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TTS Generation Time | ~2-3 seconds | ~0.5-1 second | ~70% faster |
| Audio File Size | ~400-600 KB | ~100-150 KB | ~75% smaller |
| First Slide Audio Ready | 3-5 seconds | 1-2 seconds | ~60% faster |
| Mobile Touch Targets | 32px | 40-48px | Better accessibility |
| Double Play Bug | Occurring | Fixed | Resolved |
| End-of-presentation Error | Occurring | Fixed | Resolved |

---

## Summary

This comprehensive optimization addresses all reported issues:

1. **Double narration** - Fixed with slide-specific playback locks and proper ref guards
2. **Slow loading** - Switched to turbo TTS model, smaller audio format, aggressive preloading
3. **Mobile navigation** - Larger touch targets, swipe support, simplified mobile UI
4. **End-of-presentation error** - Robust state guards and cleanup
5. **Overall performance** - Cache headers, parallel loading, reduced asset sizes
