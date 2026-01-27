

# Owner Portal Presentation Complete Optimization Plan

## Issues Identified

### 1. Image Distortion & Display Problems
- **Root cause**: The `AutoScrollImage` component's height calculation is inconsistent. The `max-h-[55vh]` constraint on both container and image causes distortion when natural aspect ratios conflict with viewport-based sizing.
- **Marketing & Overview slides** specifically have tall screenshots that need proper full-length scrolling display.

### 2. Voice Not Playing / Audio Delay
- **Root cause**: Audio preloading fetches 3 slides but does not guarantee the audio is decoded and ready for instant playback. Network delays cause noticeable lag on first play.
- **Solution**: Use Web Audio API with `AudioContext.decodeAudioData()` to preload and decode audio buffers. This ensures instant playback with no delay.

### 3. Green Callout Bar Position
- **Issue**: The green "Pain Point Solved" callout is too far from the screenshot and too close to the bottom navigation.
- **Solution**: Move it directly under the image with `mt-2` and ensure consistent `mb-6` spacing before the bottom spacer.

### 4. Bottom Navigation Bar Not Centered
- **Issue**: On some screen sizes the control bar may not appear perfectly centered.
- **Solution**: Already using `left-0 right-0 flex justify-center` - will verify and ensure max-width constraints work properly.

### 5. Overview Slide Missing Audio Recap CTA
- **Issue**: Need to add text suggesting users click the play button above to hear a personalized audio recap demo.

### 6. Performance & File Size
- **Current state**: Images are loading as full PNG files which are likely 500KB-2MB each.
- **Solution**: Implement progressive image loading with:
  - Loading states with skeleton/blur placeholders
  - Better height constraints to prevent layout shift
  - Consider WebP format recommendation for future optimization

---

## Technical Implementation

### Phase 1: Fix AutoScrollImage Component for Full-Length Display

The key changes:
1. **Fixed container height** instead of flex-1 (which is unpredictable)
2. **Proper overflow detection** - only scroll when image is genuinely taller than container
3. **No distortion** - use `object-contain` for static display, `object-top` alignment
4. **Smoother animation** - use longer scroll duration and proper easing

```typescript
// AutoScrollImage.tsx - Key fixes
export function AutoScrollImage({
  src,
  alt,
  className = "",
  scrollDuration = 12, // Slower scroll for better viewing
  isActive = true
}: AutoScrollImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageHeight, setImageHeight] = useState<number | null>(null);

  // Fixed container height for consistent display
  const CONTAINER_HEIGHT = "calc(100vh - 280px)"; // Account for header, callouts, nav
  const SCROLL_THRESHOLD = 80; // Only scroll if overflow > 80px

  const calculateScroll = useCallback(() => {
    const container = containerRef.current;
    const img = imageRef.current;
    if (!container || !img || !img.complete) return;

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;
    
    // Calculate rendered height based on image aspect ratio and container width
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const renderedHeight = containerWidth / aspectRatio;
    
    setImageHeight(renderedHeight);
    
    // Calculate overflow
    const overflow = renderedHeight - containerHeight;
    
    if (overflow > SCROLL_THRESHOLD) {
      setScrollAmount(overflow);
    } else {
      setScrollAmount(0);
    }
  }, []);

  // ... rest of implementation
  
  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 w-full"
      style={{ height: CONTAINER_HEIGHT, maxHeight: "55vh" }}
    >
      {shouldAnimate ? (
        <motion.img
          animate={{ y: [0, -scrollAmount, 0] }}
          transition={{
            duration: scrollDuration,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 3
          }}
        />
      ) : (
        <img 
          className="w-full h-full object-contain object-top"
        />
      )}
    </div>
  );
}
```

### Phase 2: Implement Web Audio API for Instant Playback

Replace current `HTMLAudioElement` approach with `AudioContext` for zero-delay playback:

```typescript
// usePresentationAudio.ts - Key changes
const audioContext = useRef<AudioContext | null>(null);
const audioBufferCache = useRef<Map<string, AudioBuffer>>(new Map());
const activeSource = useRef<AudioBufferSourceNode | null>(null);

// Initialize AudioContext on first user interaction
const initAudioContext = useCallback(() => {
  if (!audioContext.current) {
    audioContext.current = new AudioContext();
  }
  return audioContext.current;
}, []);

// Preload and decode audio
const preloadAudio = async (slideId: string, script: string) => {
  const ctx = initAudioContext();
  if (audioBufferCache.current.has(slideId)) return;
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
    method: "POST",
    headers: { ... },
    body: JSON.stringify({ text: script, voiceId })
  });
  
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  audioBufferCache.current.set(slideId, audioBuffer);
};

// Play with zero delay
const playAudio = (slideId: string) => {
  const buffer = audioBufferCache.current.get(slideId);
  if (!buffer) return;
  
  const ctx = audioContext.current;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = onAudioEndRef.current;
  source.start(0); // Instant playback!
  activeSource.current = source;
};
```

### Phase 3: Update All Slide Components

**Common changes for all slides:**
1. Remove inconsistent `flex-1` - use fixed heights
2. Move green callout closer to image with `mt-2` instead of `mt-3 md:mt-4`
3. Standardize spacing: `py-4 px-4 md:py-6 md:px-6`
4. Ensure proper bottom spacer `h-20 md:h-24`

**OverviewSlide.tsx - Add Audio Recap CTA:**
```tsx
<p className="text-white/60 text-xs truncate">
  Click play above to download your personalized audio recap
</p>
```

**MarketingSlide.tsx - Ensure full scroll:**
```tsx
<AutoScrollImage 
  src="/images/owner-portal/10-marketing.png" 
  alt="Marketing Dashboard"
  scrollDuration={15} // Longer duration for tall content
  isActive={isActive}
/>
```

### Phase 4: Optimize Image Loading

Add loading skeleton and progressive reveal:

```tsx
// New OptimizedImage component
function OptimizedImage({ src, alt, ...props }) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className="relative">
      {/* Skeleton placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 animate-pulse rounded-xl" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        {...props}
      />
    </div>
  );
}
```

### Phase 5: Center Navigation Bar Properly

```tsx
// OwnerPortalPresentation.tsx - Navigation bar
<motion.div
  className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl"
>
  <div className="bg-black/80 backdrop-blur-lg border border-white/10 rounded-full px-3 md:px-4 py-2 flex items-center justify-center gap-1 md:gap-2 shadow-2xl mx-auto w-fit">
    {/* Controls */}
  </div>
</motion.div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/presentation/AutoScrollImage.tsx` | Complete refactor - fixed height, proper scroll detection, no distortion |
| `src/hooks/usePresentationAudio.ts` | Implement Web Audio API for instant playback, better preloading |
| `src/pages/OwnerPortalPresentation.tsx` | Center navigation bar, adjust slide container heights |
| `src/components/presentation/owner-portal-slides/OverviewSlide.tsx` | Add audio recap CTA text, adjust layout |
| `src/components/presentation/owner-portal-slides/MarketingSlide.tsx` | Adjust scroll duration, fix layout |
| `src/components/presentation/owner-portal-slides/InsightsSlide.tsx` | Fix layout, move callout closer |
| All 12 slide components | Standardize layout: consistent heights, callout positioning |

---

## Image Container Height Strategy

The key insight is using a **calculated fixed height** instead of `flex-1` or viewport-relative units:

```
Total viewport height: 100vh
- Top progress bar: 4px
- Top labels (slide counter, name): 48px  
- Headline area: ~100px
- Feature pills: ~50px
- Green callout: ~50px
- Bottom nav: 80px
- Padding: ~60px
------------------------------
Available for image: ~calc(100vh - 400px)
```

This ensures:
- Consistent image display across all slides
- No distortion (object-contain)
- Full scroll when content exceeds container
- Green callout always visible and positioned correctly

---

## Expected Outcomes

After implementation:
1. **No distortion** - Images display at proper aspect ratio with object-contain
2. **Full-length scrolling** - Tall screenshots (Overview, Marketing, Insights) scroll smoothly top to bottom
3. **Instant audio** - Voice plays immediately when slide loads (preloaded via Web Audio API)
4. **Centered navigation** - Control bar perfectly centered on all screen sizes
5. **Proper callout position** - Green "Pain Point Solved" directly under image, not too close to nav
6. **Audio recap CTA** - Overview slide encourages clicking play to hear demo
7. **Mobile optimized** - Uses `100dvh`, responsive spacing, touch-friendly controls

