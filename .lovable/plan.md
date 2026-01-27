
# Owner Portal Presentation Enhancement Plan

## Issues Identified

### 1. Female Voice Not Playing in Owner Portal Presentation
**Root Cause**: The edge function `elevenlabs-tts/index.ts` has Brian (`nPczCjzI2devNBz1zQrb`) as the default voice on line 26. When the frontend sends `voiceId`, it should override this, but the hook is using Sarah's ID correctly.

**Fix**: 
- Verify the hook passes `voiceId` in the API request body (it does - line 61)
- Update the edge function to use Sarah as default, since Owner Portal is the primary use case
- Alternatively, ensure each presentation explicitly passes the correct voiceId

### 2. Auto-Scrolling Not Working / Image Distortion
**Root Cause**: The `AutoScrollImage` component calculates overflow but:
- Container height calculation uses `entry.contentRect.height` which may not be reliable for `flex-1` containers
- The `min-h-screen` parent with `flex-col` layout causes the flex-1 child to have unpredictable height
- Only scroll when there's ACTUAL overflow (rendered image taller than container)

**Fix**:
- Use a fixed container height approach (e.g., `55vh` or calculate based on available space)
- Add minimum scroll threshold (only scroll if overflow > 50px to avoid micro-scrolls)
- For images that fit, display them centered without animation

### 3. Intro Slide Needs Warmer Language
**Current**: "Your Property. Complete Visibility." with script "Welcome to PeachHaus. Your property. Complete visibility."

**Fix**: 
- Update headline to: "Your Property. **Our Passion.**" or "Welcome to **Worry-Free Ownership.**"
- Update script to be warmer: "Welcome to PeachHaus. We're so glad you're here. Let us show you how we take care of your investment — and keep you informed every step of the way."

### 4. Bottom Callout Positioning (Screenshot 2)
**Issue**: The green "Pain Point Solved" callout appears too close to the navigation bar and may not be centered properly on some screens.

**Fix**:
- Ensure consistent `mx-auto` centering
- Add `mb-6` or `mb-8` to create space before the fixed bottom nav
- Consider making the callout float above the bottom navigation area

### 5. Voice Narration Quality & Consistency
**Research Findings**:
- **Sarah** voice: female, expressive, social, energetic - good for Owner Portal
- **Brian** voice: male, deep, narration, serious - good for Onboarding
- Higher **stability** (0.65) = more consistent professional sound
- Add **style** for warmth (0.35-0.4)
- Use proper punctuation (periods for pauses, ellipses for longer pauses)

**Fix**: Update voice settings in edge function:
```typescript
voice_settings: {
  stability: 0.65,        // Was 0.5 - increase for consistency
  similarity_boost: 0.80, // Was 0.75 - slight increase
  style: 0.35,           // Was 0.3 - slight increase for warmth
  use_speaker_boost: true,
}
```

---

## Technical Implementation

### Phase 1: Fix Voice Assignment

**File: `supabase/functions/elevenlabs-tts/index.ts`**
- Change default voice from Brian to Sarah (Sarah's ID: `EXAVITQu4vr4xnSDxMaL`)
- Update voice settings for more professional, persuasive delivery

```typescript
// Default to Sarah voice for Owner Portal (primary use case)
const voice = voiceId || "EXAVITQu4vr4xnSDxMaL";

voice_settings: {
  stability: 0.65,
  similarity_boost: 0.80,
  style: 0.35,
  use_speaker_boost: true,
  speed: 0.95 // Slightly slower for clarity
}
```

**File: `src/pages/OnboardingPresentation.tsx`**
- Ensure it explicitly passes Brian's voiceId: `nPczCjzI2devNBz1zQrb`

### Phase 2: Fix AutoScrollImage Component

**File: `src/components/presentation/AutoScrollImage.tsx`**

Key changes:
1. Use explicit container height (`55vh`)
2. Calculate if image actually needs scrolling (overflow threshold of 50px)
3. If no scroll needed, show image at `object-contain` without animation
4. Better initial state handling

```typescript
// Only animate if there's meaningful overflow
const shouldAnimate = scrollAmount > 50 && isActive && isLoaded;

// If no scroll needed, center the image
return (
  <div className="..." style={{ height: "55vh" }}>
    {shouldAnimate ? (
      <motion.img 
        animate={{ y: [0, -scrollAmount, 0] }}
        // animation config
      />
    ) : (
      <img 
        className="w-full h-full object-contain"
        // no animation - centered
      />
    )}
  </div>
);
```

### Phase 3: Update Intro Slide

**File: `src/components/presentation/owner-portal-slides/OwnerPortalIntroSlide.tsx`**

Update headline:
```tsx
<motion.h1 className="...">
  Welcome to{" "}
  <span className="text-[#fae052]">Worry-Free Ownership</span>
</motion.h1>

<motion.p className="...">
  Your property, our passion — complete visibility into your investment
</motion.p>
```

**File: `src/pages/OwnerPortalPresentation.tsx`**

Update intro script:
```typescript
script: "Welcome to PeachHaus. We're so glad you're here. Let us show you how we take care of your investment — and keep you completely informed, every step of the way."
```

### Phase 4: Fix Bottom Callout Positioning

Update all slide components to ensure proper callout positioning:

```tsx
{/* Pain Point Solved - positioned with proper margins */}
<motion.div
  className="mt-6 mb-8 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 max-w-2xl text-center mx-auto"
  // ...
>
```

### Phase 5: Update All Slide Scripts for Better Persuasion

Improve scripts with better pacing and emotional punctuation:

| Slide | Current Script | Improved Script |
|-------|---------------|-----------------|
| Intro | "Welcome to PeachHaus. Your property. Complete visibility." | "Welcome to PeachHaus. We're so glad you're here... Let us show you how we take care of your investment — and keep you completely informed, every step of the way." |
| Overview | "See your complete property performance..." | "Here's your dashboard... Everything you need to know about your property — revenue, occupancy, and guest ratings — all in real-time. And every month, you'll receive a personalized audio recap, delivered right to your phone." |
| Screenings | "Know who's staying in your home..." | "Peace of mind, built in. Every single guest is verified before they arrive — ID check, background screening, and watchlist review. This process has reduced property damage claims by forty-seven percent." |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/elevenlabs-tts/index.ts` | Change default voice to Sarah, improve voice settings |
| `src/components/presentation/AutoScrollImage.tsx` | Fix height calculation, add scroll threshold, improve non-scrolling images |
| `src/components/presentation/owner-portal-slides/OwnerPortalIntroSlide.tsx` | Update headline and subtitle to warmer language |
| `src/pages/OwnerPortalPresentation.tsx` | Update all slide scripts for better narration |
| `src/pages/OnboardingPresentation.tsx` | Ensure Brian voice is explicitly passed |
| All slide components (10 files) | Adjust bottom callout margins for better positioning |

---

## Expected Outcomes

After implementation:
1. **Sarah's voice plays** in Owner Portal Presentation (female, warm, professional)
2. **Brian's voice plays** in Onboarding Presentation (male, serious, authoritative)
3. **Auto-scroll only activates** for tall images that need it — short images display centered
4. **Warmer intro** welcomes owners instead of cold "Complete Visibility" headline
5. **Better callout positioning** with proper spacing from navigation bar
6. **More persuasive narration** with improved voice settings and script pacing
