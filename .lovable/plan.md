# Smart Follow-Up System - Call Type Aware

## ✅ Completed Implementation

### Overview
A psychology-informed follow-up system that sends pre-call and post-call messages with:
- **Call-Type Awareness**: Differentiates between VIDEO and PHONE calls
- **Video Calls**: Shares the Google Meet link in follow-ups
- **Phone Calls**: Confirms the phone number we'll call them on
- **Presentation Embedding**: Includes Onboarding and Owner Portal presentation links

---

## Follow-Up Sequences

### Call Scheduled (Pre-Call) Sequence
| Step | Timing | Channel | Content |
|------|--------|---------|---------|
| 1 | 48h before call | Email | Onboarding Presentation + call type details |
| 2 | 24h before call | SMS | Owner Portal teaser + call type brief |
| 3 | 2h before call | SMS | Final reminder with call type reminder |

### Call Attended (Post-Call) Sequence
| Step | Timing | Channel | Content |
|------|--------|---------|---------|
| 1 | 2h after call | Email | Owner Portal + Onboarding presentations |
| 2 | 48h after call | SMS | Check-in about presentations |
| 3 | 5 days after call | Email | Final value reinforcement |

---

## Call-Type Dynamic Content

### Video Calls
- `[CALL_TYPE_DETAILS]` → "📹 Video Call: [Google Meet Link]"
- `[CALL_TYPE_BRIEF]` → "Join here: [Google Meet Link]"
- `[CALL_TYPE_REMINDER]` → "Join the video call here: [Link]"

### Phone Calls
- `[CALL_TYPE_DETAILS]` → "📞 Phone Call: We'll call you at (XXX) XXX-XXXX"
- `[CALL_TYPE_BRIEF]` → "We'll call you at (XXX) XXX-XXXX"
- `[CALL_TYPE_REMINDER]` → "We'll be calling you at (XXX) XXX-XXXX."

---

## Technical Implementation

### Files Modified
1. **`supabase/functions/schedule-lead-follow-ups/index.ts`**
   - Fetches discovery call data for call_scheduled stage
   - Calculates relative timing (48h, 24h, 2h before call)
   - Skips steps if scheduled time already passed

2. **`supabase/functions/process-scheduled-follow-ups/index.ts`**
   - Added call-type detection from discovery_calls table
   - Added `processCallTypePlaceholders()` function
   - Added `processPresentationLinks()` function
   - Fortune 500 styled email templates with CTA buttons

### Database Updates
- Replaced old follow-up steps with new call-aware steps
- 3 steps for call_scheduled (pre-call)
- 3 steps for call_attended (post-call)

---

## Verification
- Tested with lead `f05f7e68-9b37-48f3-bb26-bbd8deb17f73`
- Correctly detected video call with meet link
- Scheduled Step 2 (24h before) and Step 3 (2h before)
- Step 1 (48h before) skipped as time already passed
