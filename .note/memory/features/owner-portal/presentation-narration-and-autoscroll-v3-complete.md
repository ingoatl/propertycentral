# Memory: features/owner-portal/presentation-narration-and-autoscroll-v3-complete
Updated: now

The Owner Portal Presentation uses an intelligent auto-scrolling system that only animates tall images with >100px overflow; shorter images display centered without animation using object-contain. AI narration uses Sarah's voice (EXAVITQu4vr4xnSDxMaL) with enhanced voice settings (stability: 0.65, style: 0.35) for a warm, professional tone. Slides advance only after narration completes (3-second pause before next slide). The Intro slide features warmer language ("Welcome to Worry-Free Ownership") instead of cold corporate messaging. All 12 slide components include proper bottom padding (pb-24) to prevent overlap with the fixed navigation bar. AutoScrollImage component uses ResizeObserver for reliable dimension calculation and only triggers animation when meaningful overflow exists, preventing image distortion.

## Communication Slide (NEW)
A new "CommunicationSlide" highlights industry-leading owner access: voicemail, text, scheduled calls, and direct phone. The narration emphasizes that this level of access is rare in property management.

## Repairs Slide Updates
- Narration now mentions the $500 approval threshold: "Any repair over five hundred dollars requires your approval before work begins"
- Also mentions predictive maintenance tasks are visible in this tab
- Feature pills updated to show "Approve repairs over $500" and "Predictive tasks"

## Overview Slide Updates
- Includes audio demo player with "Click play to hear a demo recap" instruction

## Slide Order (12 total)
1. Intro → 2. Overview → 3. Insights → 4. Bookings → 5. Statements → 6. Expenses → 7. Messages → 8. Repairs → 9. Screenings → 10. Marketing → 11. Communication (NEW) → 12. Closing CTA
