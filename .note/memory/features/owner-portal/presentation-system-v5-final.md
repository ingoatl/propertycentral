# Memory: features/owner-portal/presentation-system-v5-final
Updated: now

The Owner Portal Presentation (/owner-portal-presentation) is a professional, AI-narrated auto-scrolling showcase featuring 12 slides with specific voice assignments: Sarah (female, warm) for Owner Portal and Brian (male, serious) for Onboarding. The AutoScrollImage component uses intelligent overflow detection (100px threshold) to trigger vertical animations only for tall screenshots, while keeping smaller images centered via object-contain to prevent distortion. Audio preloads on mount and plays without delay, synchronized with slide advancement. A 3-second pause occurs after audio completion before advancing. The presentation includes a dedicated "Communication Network" slide (11th slide) showcasing voicemail, SMS, scheduled calls, and direct phone access, framed as "Industry-Leading Communication" with emphasis on ease of manager contact. The $500 maintenance approval threshold and predictive maintenance visibility are explicitly mentioned in the Repairs slide narration. The mobile experience uses adaptive controls with hidden progress dots on small screens, centered play button positioning (fixed bottom-4 md:bottom-6), and 100dvh viewport height. Total runtime is approximately 90 seconds with a Fortune 500 aesthetic emphasizing owner pain-point resolution.

## Technical Implementation (v6)
- **Web Audio API**: usePresentationAudio now uses AudioContext with decodeAudioData for zero-latency playback. Audio buffers are preloaded for first 5 slides on mount, remaining slides load in background.
- **AutoScrollImage**: Fixed height container (`calc(100vh - 280px)` with `max-height: 55vh`) ensures consistent display. Scroll threshold of 80px - only animates if image significantly exceeds container. Loading skeleton placeholder shown during load.
- **Navigation**: Perfectly centered using `left-1/2 -translate-x-1/2`. Green indicator shows when audio is preloaded. Loading spinner on play button during audio fetch.
- **Slide Layout**: All slides use standardized `py-4 px-4` padding, `mb-2` between sections, `mt-2` for green callouts, `h-16 md:h-20` bottom spacer.
- **Mobile**: Uses `100dvh` for proper mobile viewport, progress dots hidden on small screens, responsive text sizing throughout.
- **Overview Slide**: Audio player card with CTA "Click play to hear your personalized audio recap demo"
- **Marketing Slide**: 18-second scroll duration for full-length display of tall screenshot
