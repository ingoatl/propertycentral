
# Fix Call Attended Follow-ups + Add "Both Presentations" Button to All Communication Modals

## Status Check: Follow-up Messages ARE Scheduled ✓

Good news! The follow-up messages for Ingo Schaer **are correctly scheduled**:

| Step | Type | Scheduled For | Status |
|------|------|---------------|--------|
| 1 | Email | Jan 29 @ 04:21 UTC (in ~2 hours) | pending |
| 2 | SMS | Feb 2 @ 11:00 UTC | pending |
| 3 | Email | Feb 3 @ 02:21 UTC | pending |

The first email hasn't been sent yet because it's scheduled for 2 hours after the stage change (04:21 UTC), which hasn't arrived yet at the time of the stage change (02:21 UTC).

**The templates already include presentation links** - they reference `[PRESENTATION_LINK:owner_portal]` and `[PRESENTATION_LINK:onboarding]`.

---

## Implementation: Add "Both Presentations" Quick Insert

### Current State
The `InsertLinksDropdown` component lets users insert individual presentation links with contextual AI messages. It's used in:
- SendEmailDialog
- SendSMSDialog  
- QuickSMSDialog

### Changes Required

**1. Update InsertLinksDropdown.tsx**

Add a new "Quick Insert: Both Presentations" option that inserts both the onboarding and owner portal presentations in one click with a combined contextual message:

```
Hi [FirstName], I wanted to share two quick presentations with you:

Our full-service management overview:
https://propertycentral.lovable.app/p/onboarding

And a preview of your Owner Portal where you'll track everything:
https://propertycentral.lovable.app/p/owner-portal

Both are about 5 minutes each and really helpful for seeing how we work!
```

**2. Update AIWritingAssistant.tsx**

Add a "Quick Insert" section for "Both Presentations" alongside the existing "+ Schedule Call" and "+ Income Analysis" options. This allows AI replies to easily include both links.

**3. Ensure unified-ai-compose uses these links**

Add the presentation URLs to the AI's knowledge base so when composing messages, it can reference them appropriately.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/communications/InsertLinksDropdown.tsx` | Add "Both Presentations" quick insert option at the top |
| `src/components/communications/AIWritingAssistant.tsx` | Add "Both Presentations" quick insert button in the Quick Insert section |

---

## UI Preview

### InsertLinksDropdown - New Section
```text
┌──────────────────────────────────────┐
│  ⚡ Quick Insert                      │
├──────────────────────────────────────┤
│  🎁 Both Presentations               │
│     Insert onboarding + portal links │
├──────────────────────────────────────┤
│  📽️ Presentations                    │
│  ├─ Designer Presentation            │
│  ├─ Onboarding Presentation          │
│  └─ Owner Portal Presentation        │
├──────────────────────────────────────┤
│  📅 Calendar Links                   │
│  └─ Discovery Call / Owner Call      │
└──────────────────────────────────────┘
```

### AIWritingAssistant - Quick Insert Section
```text
┌──────────────────────────────────────┐
│  Quick Insert                        │
├──────────────────────────────────────┤
│  📅 + Schedule Call                  │
│     Add calendar link                │
│                                      │
│  📈 + Income Analysis                │
│     Offer free report                │
│                                      │
│  🎁 + Both Presentations   [NEW]     │
│     Onboarding + Owner Portal        │
└──────────────────────────────────────┘
```

---

## The Two Public Presentation Links

These are the canonical URLs that will be used:

1. **Onboarding Presentation**: `https://propertycentral.lovable.app/p/onboarding`
2. **Owner Portal Presentation**: `https://propertycentral.lovable.app/p/owner-portal`

Both are already configured in the system and working.

---

## Summary

1. **Follow-ups are working** - The first email will send at 04:21 UTC (about 2 hours after the stage change)
2. **Add "Both Presentations" button** to InsertLinksDropdown and AIWritingAssistant for one-click insertion of both presentation links with a contextual message
3. **The AI already has access** to these links via the follow-up templates - this change just makes it easier for manual composition
