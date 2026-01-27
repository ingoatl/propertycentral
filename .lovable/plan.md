
# Owner Portal Presentation Restructure Plan

## Overview
Completely rebuild the Owner Portal Presentation to Fortune 500 standards with auto-scrolling slides, AI-generated audio narration via ElevenLabs, and polished professional design.

---

## Issues Identified

### 1. Broken Slides
- Missing images for some slides (no Marketing screenshot uploaded)
- Inconsistent screenshot naming (`06-messages.png` vs `07-messages-detail.png` vs `08-repairs.png`)
- Some slides reference images that don't exist in the `public/images/owner-portal/` directory

### 2. Auto-Scroll Not Working Properly
- Current implementation uses `scrollIntoView` which conflicts with the slide-based navigation
- Timer-based auto-advance exists but doesn't provide smooth cinematic scrolling
- No visual indication of progress per slide

### 3. Missing Audio Narration
- Only the Overview slide has audio capability (monthly recap sample)
- No AI-generated narration explaining each feature

### 4. Presentation Links Too Large
- Current buttons in OwnerPortalManagement.tsx are full-sized with large margins
- Need compact inline links

---

## Fortune 500 Design Principles Applied

Based on research from PitchWorx and Apple keynote analysis:

| Principle | Implementation |
|-----------|----------------|
| **Strategic Narrative** | Frame each slide around owner pain points, not just features |
| **One Idea Per Slide** | Each slide focuses on a single tab with clear value proposition |
| **Engineered Minimalism** | Clean layouts, generous white space, single focal screenshot |
| **Brand Cohesion** | Consistent PeachHaus gold (#fae052) accent, dark gradient background |
| **Data-Driven Headlines** | Use assertion-based titles ("47% Reduction in Damage Claims" vs "Guest Screening") |
| **Smooth Transitions** | Fade/scale animations, no jarring cuts |

---

## Technical Architecture

### Phase 1: Fix Asset Structure

Rename and verify all images in `public/images/owner-portal/`:
```text
public/images/owner-portal/
  ├── 01-overview.png     ✓ exists
  ├── 02-insights.png     ✓ exists
  ├── 03-bookings.png     ✓ exists
  ├── 04-statements.png   ✓ exists
  ├── 05-expenses.png     ✓ exists
  ├── 06-messages.png     ✓ exists
  ├── 07-messages-detail.png  ✓ exists (use in Messages slide)
  ├── 08-repairs.png      ✓ exists
  ├── 09-screenings.png   ✓ exists
  └── 10-marketing.png    (need to add or use placeholder)
```

### Phase 2: Create Audio Narration Edge Function

Create `supabase/functions/generate-presentation-audio/index.ts`:
- Accept slide ID and script text
- Generate professional narration using ElevenLabs
- Use Sarah voice (female, professional) for presentation: `EXAVITQu4vr4xnSDxMaL`
- Cache audio to Supabase Storage for reuse

**Narration Scripts** (one per slide):
```text
Slide 1 - Intro (5s):
"Welcome to PeachHaus. Your property. Complete visibility."

Slide 2 - Overview (12s):
"See your complete property performance at a glance. Total revenue, occupancy rates, and guest ratings updated in real-time. Every month, you'll receive an AI-generated audio recap delivered directly to your phone."

Slide 3 - Insights (10s):
"Know exactly how your property stacks up against the competition. Our market intelligence shows revenue opportunities, upcoming events that drive demand, and dynamic pricing powered by PriceLabs."

Slide 4 - Bookings (8s):
"Always know who's staying at your property. Our visual calendar shows every reservation with guest details and revenue forecasts for upcoming stays."

Slide 5 - Statements (7s):
"Transparent financials you can access anytime. Download your monthly statements with gross and net earnings clearly shown."

Slide 6 - Expenses (10s):
"No hidden fees. Every dollar is documented. See itemized expenses with vendor names and receipt attachments. Filter by category to understand exactly where your money goes."

Slide 7 - Messages (10s):
"Every conversation in one place. SMS, emails, voicemails, and video updates. Listen to recordings from your property manager and never miss an important update."

Slide 8 - Repairs (10s):
"Stay in control of maintenance. See work order status, approve or decline repairs directly, and view scheduled maintenance. All costs are visible upfront before any work begins."

Slide 9 - Screenings (8s):
"Know who's staying in your home. Every guest is ID verified with background checks and watchlist screening. Our verification process reduces property damage claims by 47 percent."

Slide 10 - Marketing (8s):
"See exactly how we're promoting your investment. View social media posts, platform distribution across Airbnb, VRBO, and corporate housing, and track our marketing activities in real-time."

Slide 11 - Closing (6s):
"Ready to experience true transparency? Explore our demo portal or schedule a call with our team today."
```

### Phase 3: Restructure Presentation Page

**File: `src/pages/OwnerPortalPresentation.tsx`**

Key changes:
1. Replace scroll-based navigation with true slide transitions (AnimatePresence)
2. Add auto-play with smooth progress bar per slide
3. Integrate audio narration that plays automatically per slide
4. Add audio toggle (mute/unmute)
5. Improve visual transitions with fade + scale

```typescript
// New structure
interface Slide {
  id: string;
  label: string;
  duration: number; // milliseconds
  component: React.ComponentType<{ isActive: boolean }>;
  audioScript?: string; // For generating narration
}

// Auto-advance with audio sync
useEffect(() => {
  if (isPlaying && !isMuted) {
    // Play audio for current slide
    playAudioForSlide(currentSlide);
  }
  
  // Auto-advance after slide duration
  const timer = setTimeout(() => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  }, slides[currentSlide].duration);
  
  return () => clearTimeout(timer);
}, [currentSlide, isPlaying]);
```

### Phase 4: Update Individual Slides

Each slide component will be enhanced:

1. **Add `isActive` prop** to control animations and audio
2. **Use AnimatePresence** for smooth enter/exit
3. **Apply Fortune 500 minimalism** - larger screenshots, cleaner text
4. **Add assertion-based headlines** with metrics where applicable

Example enhanced slide:
```tsx
export function ScreeningsSlide({ isActive }: { isActive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="min-h-screen flex flex-col items-center justify-center"
    >
      {/* Assertion-based headline */}
      <h2 className="text-5xl font-bold">
        <span className="text-[#fae052]">47%</span> Reduction in Damage Claims
      </h2>
      <p className="text-xl text-white/70 mt-4">
        Every guest verified before arrival with ID, background check, and watchlist screening
      </p>
      {/* Large screenshot */}
      <div className="mt-12 max-w-6xl w-full">
        <img src="/images/owner-portal/09-screenings.png" />
      </div>
    </motion.div>
  );
}
```

### Phase 5: Create Audio Hook

**File: `src/hooks/usePresentationAudio.ts`**

```typescript
export function usePresentationAudio() {
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const playAudioForSlide = async (slideId: string, script: string) => {
    if (isMuted) return;
    
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setIsLoading(true);
    
    // Fetch TTS audio from edge function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: script, 
          voiceId: 'EXAVITQu4vr4xnSDxMaL' // Sarah voice
        })
      }
    );
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    audioRef.current = new Audio(audioUrl);
    await audioRef.current.play();
    
    setIsLoading(false);
  };
  
  return { playAudioForSlide, isMuted, setIsMuted, isLoading };
}
```

### Phase 6: Update Presentation Links (Smaller)

**File: `src/pages/OwnerPortalManagement.tsx`**

Change from large card with buttons to compact inline links:

```tsx
{/* Compact Presentation Links */}
<div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
  <span className="text-muted-foreground">Quick Links:</span>
  <Link to="/owner-portal-presentation" className="text-amber-600 hover:underline flex items-center gap-1">
    <ExternalLink className="h-3 w-3" />Owner Portal
  </Link>
  <span className="text-muted-foreground">•</span>
  <Link to="/onboarding-presentation" className="text-amber-600 hover:underline flex items-center gap-1">
    <ExternalLink className="h-3 w-3" />Onboarding
  </Link>
  <span className="text-muted-foreground">•</span>
  <Link to="/designer-presentation" className="text-amber-600 hover:underline flex items-center gap-1">
    <ExternalLink className="h-3 w-3" />Design Services
  </Link>
</div>
```

---

## Implementation Checklist

### Files to Create:
- `supabase/functions/generate-presentation-audio/index.ts` - TTS caching function
- `src/hooks/usePresentationAudio.ts` - Audio playback hook

### Files to Update:
- `src/pages/OwnerPortalPresentation.tsx` - Complete restructure
- `src/components/presentation/owner-portal-slides/OwnerPortalIntroSlide.tsx`
- `src/components/presentation/owner-portal-slides/OverviewSlide.tsx`
- `src/components/presentation/owner-portal-slides/InsightsSlide.tsx`
- `src/components/presentation/owner-portal-slides/BookingsSlide.tsx`
- `src/components/presentation/owner-portal-slides/StatementsSlide.tsx`
- `src/components/presentation/owner-portal-slides/ExpensesSlide.tsx`
- `src/components/presentation/owner-portal-slides/MessagesSlide.tsx`
- `src/components/presentation/owner-portal-slides/RepairsSlide.tsx`
- `src/components/presentation/owner-portal-slides/ScreeningsSlide.tsx`
- `src/components/presentation/owner-portal-slides/MarketingSlide.tsx`
- `src/components/presentation/owner-portal-slides/OwnerPortalClosingSlide.tsx`
- `src/pages/OwnerPortalManagement.tsx` - Smaller presentation links

---

## Audio Generation Strategy

Since generating 11 audio files at runtime would be slow and expensive, we'll use a hybrid approach:

1. **Pre-generate** audio files for each slide using a one-time admin action
2. **Store** in Supabase Storage bucket: `presentation-audio/`
3. **Reference** via public URLs in the slide components
4. **Fallback** to live generation if cached audio missing

Pre-generated audio paths:
```text
presentation-audio/owner-portal/
  ├── 01-intro.mp3
  ├── 02-overview.mp3
  ├── 03-insights.mp3
  ├── 04-bookings.mp3
  ├── 05-statements.mp3
  ├── 06-expenses.mp3
  ├── 07-messages.mp3
  ├── 08-repairs.mp3
  ├── 09-screenings.mp3
  ├── 10-marketing.mp3
  └── 11-closing.mp3
```

---

## Expected Outcome

After implementation:
- Professional auto-scrolling presentation with smooth slide transitions
- AI-narrated audio playing automatically (with mute option)
- Fortune 500-level design with assertion-based headlines
- Compact presentation links in the admin dashboard
- Total presentation runtime: ~90 seconds
- Works on desktop and mobile with touch/swipe support
