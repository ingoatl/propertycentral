
# Owner Portal Presentation Fixes Plan

## Issues to Address

### 1. Auto-Scrolling Not Working
The `AutoScrollImage` component exists but the scrolling animation is not functioning properly because:
- The component uses `scrollAmount` based on overflow calculation, but the animation only runs if `scrollAmount > 0`
- The image needs to be fully loaded and the container dimensions must be calculated correctly
- Current implementation may have timing issues where the image loads but dimensions aren't ready

### 2. Control Bar Overlap (Screenshot #2)
The green "Pain Point Solved" callout boxes at the bottom of slides overlap with the fixed navigation bar. The navigation bar is positioned at `bottom-6` (1.5rem = 24px), but the slide content uses `min-h-screen` which causes the bottom content to be hidden behind the controls.

### 3. Voice Assignment
- **Owner Portal Presentation**: Should use Sarah (female voice) - `EXAVITQu4vr4xnSDxMaL` - **already set correctly**
- **Onboarding Presentation**: Should use Brian (male voice) - `nPczCjzI2devNBz1zQrb` - **needs to be changed**

---

## Technical Solution

### Phase 1: Fix Voice Assignment for Each Presentation

**File: `src/pages/OnboardingPresentation.tsx`**
- Pass Brian's voiceId to the `usePresentationAudio` hook:
```typescript
const { playAudioForSlide, stopAudio, isMuted, toggleMute, isLoading } = 
  usePresentationAudio({ voiceId: "nPczCjzI2devNBz1zQrb" }); // Brian voice
```

**File: `src/pages/OwnerPortalPresentation.tsx`**
- Keep Sarah's voice (already default in the hook)

### Phase 2: Fix Slide Layout to Prevent Control Bar Overlap

All slide components currently use:
```tsx
<div className="min-h-screen ... py-8 px-4 md:px-8">
```

Update all 11 slide components to add bottom padding that clears the navigation bar:

```tsx
<div className="min-h-screen ... py-8 pb-24 px-4 md:px-8">
```

**Files to update:**
- `BookingsSlide.tsx`
- `ExpensesSlide.tsx`
- `InsightsSlide.tsx`
- `MarketingSlide.tsx`
- `MessagesSlide.tsx`
- `OverviewSlide.tsx`
- `OwnerPortalClosingSlide.tsx`
- `OwnerPortalIntroSlide.tsx`
- `RepairsSlide.tsx`
- `ScreeningsSlide.tsx`
- `StatementsSlide.tsx`

### Phase 3: Fix AutoScrollImage Component

The current implementation has issues with timing and calculation. Improvements needed:

1. **Add more reliable dimension detection** using ResizeObserver
2. **Force recalculation on visibility** when the slide becomes active
3. **Add better image load handling** with explicit dimension measurement
4. **Add key prop** to force re-mount when image source changes

```typescript
// Enhanced AutoScrollImage.tsx
export function AutoScrollImage({ 
  src, 
  alt, 
  className = "",
  scrollDuration = 8,
  isActive = true // New prop to control animation
}: AutoScrollImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);
  const [imageKey, setImageKey] = useState(0); // Force re-render

  // Use ResizeObserver for more reliable dimension tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.min(entry.contentRect.height, window.innerHeight * 0.55);
        setContainerHeight(height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate scroll amount when image loads
  useEffect(() => {
    if (!isLoaded || !imageRef.current || containerHeight === 0) return;

    const img = imageRef.current;
    const naturalHeight = img.naturalHeight;
    const naturalWidth = img.naturalWidth;
    const containerWidth = containerRef.current?.clientWidth || 0;
    
    // Calculate how tall the image will be when rendered
    const aspectRatio = naturalWidth / naturalHeight;
    const renderedHeight = containerWidth / aspectRatio;
    
    // Calculate overflow
    const overflow = Math.max(0, renderedHeight - containerHeight);
    setScrollAmount(overflow);
  }, [isLoaded, containerHeight]);

  const handleImageLoad = () => {
    setIsLoaded(true);
    // Force recalculation after a small delay
    setTimeout(() => setImageKey(prev => prev + 1), 100);
  };

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 relative"
      style={{ height: `${containerHeight}px`, maxHeight: "55vh" }}
    >
      <motion.img 
        key={`${src}-${imageKey}`}
        ref={imageRef}
        src={src}
        alt={alt}
        className={`w-full h-auto ${className}`}
        onLoad={handleImageLoad}
        initial={{ y: 0 }}
        animate={scrollAmount > 0 && isActive ? { 
          y: [0, -scrollAmount, 0] 
        } : { y: 0 }}
        transition={scrollAmount > 0 ? { 
          duration: scrollDuration, 
          ease: "easeInOut", 
          repeat: Infinity, 
          repeatDelay: 1.5
        } : undefined}
      />
    </div>
  );
}
```

### Phase 4: Reduce Container Height for Better Layout

Change `maxHeight` from `60vh` to `55vh` in all slides to ensure:
- More space at the bottom for the "Pain Point Solved" callout
- Clear separation from the navigation bar
- Better overall composition

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/presentation/AutoScrollImage.tsx` | Add ResizeObserver, improve dimension calculation, add `isActive` prop |
| `src/pages/OnboardingPresentation.tsx` | Pass Brian's voiceId to `usePresentationAudio` |
| `src/components/presentation/owner-portal-slides/BookingsSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/ExpensesSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/InsightsSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/MarketingSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/MessagesSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/OverviewSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/OwnerPortalClosingSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/OwnerPortalIntroSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/RepairsSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/ScreeningsSlide.tsx` | Add `pb-24` padding |
| `src/components/presentation/owner-portal-slides/StatementsSlide.tsx` | Add `pb-24` padding |

---

## Expected Outcome

After implementation:
- **Auto-scrolling works**: Tall images smoothly scroll up and down within their containers
- **No overlap**: Bottom callouts are visible above the navigation bar
- **Correct voices**: 
  - Owner Portal Presentation = Sarah (female)
  - Onboarding Presentation = Brian (male)
- **Better timing**: Animation pauses appropriately between scroll cycles
