
# Fix Call Recording Player Display and Transcript Collapsing

## Problem Analysis

Based on the screenshot and code review, I identified several issues:

1. **Transcript Always Visible**: The `forceMount` prop on `CollapsibleContent` keeps the content in the DOM, and while CSS grid animation should hide it, it's not properly collapsing
2. **Player Inside Message Bubble**: The `CallRecordingPlayer` is rendered inside the colored message bubble, causing awkward layout
3. **Design Not Matching OpenPhone/GHL**: Current design is bulky and doesn't have the clean, compact look of professional communication tools

## Solution Overview

### 1. Fix Collapsible CSS (src/index.css)

Add `visibility: hidden` to closed state to ensure content is truly hidden:

```css
.collapsible-content[data-state="closed"] {
  grid-template-rows: 0fr;
  pointer-events: none;
  visibility: hidden;
}

.collapsible-content[data-state="open"] {
  visibility: visible;
}
```

### 2. Redesign CallRecordingPlayer (src/components/communications/CallRecordingPlayer.tsx)

Create a cleaner, more compact design inspired by OpenPhone:

**Key Design Changes:**
- Compact inline player with waveform-style progress bar
- Transcript toggle as a subtle link/button, not a large section header
- Transcript appears in a clean, contained area when expanded
- Remove redundant borders and reduce padding

**New Layout Structure:**
```text
┌─────────────────────────────────────────┐
│ ▶  ═══════●══════════  0:10 / 14:40  1x │
│                                    📄 ⬇️ │
└─────────────────────────────────────────┘
     ↓ (only when "Show Transcript" clicked)
┌─────────────────────────────────────────┐
│ Transcript text here...                 │
│ (max-height with scroll)                │
└─────────────────────────────────────────┘
```

### 3. Update InboxView Call Display (src/components/communications/InboxView.tsx)

Move the `CallRecordingPlayer` outside the colored message bubble:

```tsx
{/* Call Recording - Render OUTSIDE the bubble for clean layout */}
{msg.type === "call" && msg.call_recording_url && (
  <div className="mt-2 w-full">
    <CallRecordingPlayer
      recordingUrl={msg.call_recording_url}
      duration={msg.call_duration}
      transcript={msg.body}
      isOutbound={isOutbound}
    />
  </div>
)}

{/* Call bubble - only show duration info */}
<div className={`rounded-2xl px-4 py-3 ...`}>
  {msg.type === "call" && (
    <div className="flex items-center gap-2 text-sm">
      <Phone className="h-3.5 w-3.5" />
      <span>{isOutbound ? "Outgoing" : "Incoming"} call</span>
      {msg.call_duration && <span>· {formatDuration}</span>}
    </div>
  )}
</div>
```

## Detailed Implementation

### File 1: src/index.css

Add visibility control to collapsible states to ensure proper hiding.

### File 2: src/components/communications/CallRecordingPlayer.tsx

**Complete Redesign:**
- Single-line player controls: Play button, progress bar, time, speed, download
- Small "Transcript" toggle button in the corner (not a full-width bar)
- Transcript content in a clean card below when expanded
- Remove excessive borders and nested containers
- Use subtle background colors instead of heavy borders
- Max-height of 200px for transcript with scroll

### File 3: src/components/communications/InboxView.tsx

- Move `CallRecordingPlayer` outside the colored message bubble
- Ensure it's rendered in a full-width container below the call indicator
- Keep the call bubble simple with just call direction and duration

## Visual Comparison

| Current | New (OpenPhone-style) |
|---------|----------------------|
| Player inside bubble | Player below bubble |
| Large "Show Transcript" header | Small icon button |
| Transcript always takes space | Transcript truly hidden when collapsed |
| Multiple borders | Clean, minimal borders |
| Heavy padding | Compact, efficient layout |

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | Add visibility control to collapsible CSS |
| `src/components/communications/CallRecordingPlayer.tsx` | Complete redesign with compact player |
| `src/components/communications/InboxView.tsx` | Move player outside message bubble |
