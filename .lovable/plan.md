
# Owner Portal Presentation Implementation Plan

## Overview
Create a premium, auto-scrolling presentation that showcases the PeachHaus Owner Portal - demonstrating how it solves the key pain points property owners face with traditional management companies. The presentation will feature:
- Auto-scrolling screenshot walkthrough at optimal viewing speed
- Intelligent narration explaining each tab's benefits
- Embedded monthly recap audio sample
- Links accessible from Dashboard and all Communication sections

---

## Owner Pain Points Addressed

Based on industry research, property owners struggle with:

| Pain Point | How Our Portal Solves It |
|------------|-------------------------|
| **Lack of Transparency** | Real-time dashboards, downloadable statements, expense tracking with receipts |
| **Poor Communication** | Multi-channel messaging (SMS, Email, Voice, Video) with full history |
| **Hidden Fees & Expenses** | Every expense itemized with receipt attachments, category filtering |
| **No Visibility into Property Performance** | Live booking calendar, revenue forecasts, market comparisons |
| **Maintenance Black Hole** | Work order tracking with approval workflow, vendor quotes, scheduled maintenance |
| **Guest Quality Concerns** | ID verification, background checks, watchlist screening with 100% verification rate |
| **Not Knowing Marketing Efforts** | Social media gallery, activity timeline, platform distribution visibility |

---

## Technical Architecture

### 1. New Files to Create

```text
src/pages/OwnerPortalPresentation.tsx          - Main presentation page
src/components/presentation/owner-portal-slides/
  ├── OwnerPortalIntroSlide.tsx                - Opening slide with value proposition
  ├── OverviewSlide.tsx                        - Dashboard overview with AI recap
  ├── InsightsSlide.tsx                        - Market research & insights  
  ├── BookingsSlide.tsx                        - Calendar & booking management
  ├── StatementsSlide.tsx                      - Financial statements
  ├── ExpensesSlide.tsx                        - Expense transparency
  ├── MessagesSlide.tsx                        - Multi-channel communication
  ├── RepairsSlide.tsx                         - Maintenance & work orders
  ├── ScreeningsSlide.tsx                      - Guest verification security
  ├── MarketingSlide.tsx                       - Marketing efforts showcase
  └── OwnerPortalClosingSlide.tsx              - CTA and contact
public/audio/monthly-recap-sample.mp3          - Copy of uploaded audio file
public/images/owner-portal/                    - Screenshot images
```

### 2. Route Addition in App.tsx

```typescript
// Add to lazy imports
const OwnerPortalPresentation = lazy(() => import("./pages/OwnerPortalPresentation"));

// Add route (outside Layout, like other presentations)
<Route path="/owner-portal-presentation" element={<OwnerPortalPresentation />} />
```

---

## Slide Content Structure

### Slide 1: Introduction (5 seconds)
**Title**: "Your Property. Complete Visibility."
**Subtitle**: "Experience the most comprehensive owner portal in the industry"
- PeachHaus branding
- Smooth fade-in animation

### Slide 2: Overview Dashboard (8 seconds)
**Screenshot**: `screencapture-...-13_20_38.png`
**Key Points**:
- Total Revenue at a glance ($74,350)
- Occupancy Rate (92%)
- Guest Rating (4.9 stars)
- "Listen to Your Last Month's Recap" - AI-generated audio summary
- **Audio Player**: Embedded monthly recap sample plays here

**Pain Point Solved**: "Never wonder how your property is performing - see it all in real-time"

### Slide 3: Market Insights (8 seconds)  
**Screenshot**: `screencapture-...-13_21_00.png`
**Key Points**:
- Revenue diversification opportunities
- Revenue-driving events (Dragon Con, Music Midtown, SEC Championship)
- Comparable properties in your area
- Dynamic pricing powered by PriceLabs

**Pain Point Solved**: "Know exactly how your property stacks up against the competition"

### Slide 4: Bookings (6 seconds)
**Screenshot**: `screencapture-...-13_21_19.png`
**Key Points**:
- Visual booking calendar
- Short-term vs Mid-term color coding
- Booking history with guest names and revenue
- Upcoming reservations with revenue forecast

**Pain Point Solved**: "Always know who's staying at your property and when"

### Slide 5: Statements (5 seconds)
**Screenshot**: `screencapture-...-13_21_41.png`
**Key Points**:
- Monthly statement history
- Gross Revenue vs Net earnings clearly shown
- One-click PDF download

**Pain Point Solved**: "Transparent financials - download statements anytime"

### Slide 6: Expenses (7 seconds)
**Screenshot**: `screencapture-...-13_21_54.png`
**Key Points**:
- Every expense itemized by category
- Vendor names attached
- Receipt attachments (8/8 with receipts shown)
- Searchable and filterable

**Pain Point Solved**: "No hidden fees - every dollar is accounted for with documentation"

### Slide 7: Messages (8 seconds)
**Screenshot**: `screencapture-...-13_22_27.png`
**Key Points**:
- All communication channels in one place (SMS, Email, Voice, Video)
- Listen to voicemails from your property manager
- Watch video updates
- Full conversation history

**Pain Point Solved**: "Never miss an update - every conversation preserved and accessible"

### Slide 8: Repairs (7 seconds)
**Screenshot**: `screencapture-...-13_22_46.png`
**Key Points**:
- Work order status tracking (Completed, Awaiting Approval, Scheduled)
- Approve or Decline repairs directly from portal
- Vendor information and costs upfront
- Total maintenance costs visible

**Pain Point Solved**: "Stay in control of repairs - approve work before it happens"

### Slide 9: Screenings (7 seconds)
**Screenshot**: `screencapture-...-13_23_32.png`
**Key Points**:
- 100% Verification Rate
- ID Verified, Background Check, Watchlist screening
- Guest risk assessment (Low Risk indicators)
- 47% reduction in property damage claims

**Pain Point Solved**: "Know exactly who is staying in your home - every guest verified"

### Slide 10: Marketing (6 seconds) 
**Key Points**:
- Social media posts for your property
- Platform distribution (Airbnb, VRBO, Furnished Finder, Corporate Housing)
- Marketing activity timeline
- See exactly how we're promoting your investment

**Pain Point Solved**: "Visibility into every marketing effort for your property"

### Slide 11: Closing CTA (5 seconds)
**Title**: "Ready to Experience True Transparency?"
- "View Demo Portal" button
- "Schedule a Call" button
- Contact information

---

## Auto-Scroll & Animation Specifications

### Scroll Behavior
- **Scroll Speed**: 50px per second (smooth, readable pace)
- **Pause Duration**: 3-5 seconds at each key section
- **Total Duration**: Approximately 75 seconds for full presentation
- **Controls**: Play/Pause, manual navigation, progress bar

### Screenshot Display
- Full-width screenshot within a device frame mockup
- Subtle parallax effect as scrolling occurs
- Highlight boxes appear around key features as they're discussed
- Text overlays fade in/out with feature explanations

### Audio Integration
- Monthly recap audio plays during Overview slide
- Audio controls: play/pause, volume, progress
- Graceful fallback if audio blocked by browser

---

## Presentation Links Integration

### 1. Dashboard Link (OwnerPortalManagement.tsx)
Add a prominent card/button linking to the presentation:
```tsx
<Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Presentation className="h-5 w-5 text-amber-600" />
      Owner Portal Presentation
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-4">
      Share our industry-leading owner portal with prospects
    </p>
    <Link to="/owner-portal-presentation">
      <Button className="bg-amber-600 hover:bg-amber-700">
        View Presentation
      </Button>
    </Link>
  </CardContent>
</Card>
```

### 2. SMS Templates (UnifiedComposeDialog.tsx)
Add presentation links to SMS_TEMPLATES array:
```typescript
const SMS_TEMPLATES = [
  // ... existing templates
  {
    label: "Owner Portal",
    content: "Hi {{name}}, here's a look at our Owner Portal - the most transparent property management experience: https://propertycentral.lovable.app/owner-portal-presentation",
  },
  {
    label: "Presentations",
    content: "Hi {{name}}, check out what makes PeachHaus different:\n• Owner Portal: propertycentral.lovable.app/owner-portal-presentation\n• Onboarding: propertycentral.lovable.app/onboarding-presentation\n• Design Services: propertycentral.lovable.app/designer-presentation",
  },
];
```

### 3. Quick Links Component for InboxView
Create a collapsible "Quick Links" section in the compose area with one-click copy for all 3 presentation URLs.

---

## Screenshot Assets Processing

### Asset Handling
1. Copy uploaded screenshots to `public/images/owner-portal/` directory
2. Copy uploaded audio to `public/audio/monthly-recap-sample.mp3`
3. Reference with direct paths: `/images/owner-portal/overview.png`

### Image Naming Convention
```text
public/images/owner-portal/
  ├── 01-overview.png
  ├── 02-insights.png  
  ├── 03-bookings.png
  ├── 04-statements.png
  ├── 05-expenses.png
  ├── 06-messages.png
  ├── 07-repairs.png
  ├── 08-screenings.png
  └── 09-marketing.png
```

---

## Key UI Components

### PresentationViewer Component
```tsx
interface PresentationSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  painPoint: string;
  features: string[];
  audioSrc?: string; // Optional audio for specific slide
}

// Features:
- CSS scroll-snap for smooth slide transitions
- Intersection Observer for slide visibility detection
- Framer Motion for animations
- Audio API for recap playback
- Progress indicator showing current position
```

### Navigation Controls
- Floating navigation bar (bottom center like other presentations)
- Play/Pause auto-scroll toggle
- Slide indicator dots
- Fullscreen toggle
- Home button (return to dashboard)

---

## Implementation Steps

### Phase 1: Asset Setup
1. Copy screenshots to public/images/owner-portal/
2. Copy audio file to public/audio/
3. Create owner-portal-slides directory structure

### Phase 2: Slide Components
1. Create OwnerPortalIntroSlide with PeachHaus branding
2. Build each tab slide with screenshot + overlay text
3. Create OwnerPortalClosingSlide with CTAs

### Phase 3: Presentation Page
1. Create OwnerPortalPresentation.tsx with auto-scroll logic
2. Implement audio player integration
3. Add navigation controls matching existing presentation style

### Phase 4: Integration
1. Add route to App.tsx
2. Add presentation card to OwnerPortalManagement.tsx
3. Add SMS templates for presentation links
4. Add quick copy links in communication compose areas

---

## Memory Update

After implementation, update project memory:
```markdown
# Memory: features/owner-portal/presentation-and-demo-mode-v2

The Owner Portal Presentation (/owner-portal-presentation) is a premium auto-scrolling 
showcase of all portal tabs. It features 10 slides with screenshot walkthroughs, 
pain-point messaging, and an embedded monthly recap audio sample. Presentation links 
are accessible via SMS templates in UnifiedComposeDialog and a card in 
OwnerPortalManagement.tsx. The scroll speed is optimized at 50px/sec with 3-5 second 
pauses per section for a total ~75 second runtime.
```
