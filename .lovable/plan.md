
# Call Attended Stage & Onboarding Presentation Fix Plan

## Issues to Address

### 1. Language Change for Call Attended Stage
**Current Problem**: The immediate SMS says "I'm preparing a management proposal" - but you don't provide management proposals.

**Files to Update**:
- `supabase/functions/process-lead-stage-change/index.ts` (line 1246)
- Database: `lead_follow_up_steps` table (step 1 content with "management proposal" reference)

**New Language**: Replace "management proposal" with language about sending the management agreement when ready.

### 2. Remove Designer Presentation from Call Attended Follow-ups
**Current Status**: The follow-up steps already only use `[PRESENTATION_LINK:owner_portal]` and `[PRESENTATION_LINK:onboarding]` - no designer presentation is included. This is already correct.

**Verification**: Database query confirmed the 3 follow-up steps only reference:
- Step 1: `[PRESENTATION_LINK:owner_portal]` and `[PRESENTATION_LINK:onboarding]`
- Step 2: SMS about Owner Portal
- Step 3: `[PRESENTATION_LINK:owner_portal]`

### 3. Onboarding Presentation Auto-Continue Bug
**Root Cause**: The presentation uses pre-stored audio files from Supabase storage at path `presentation-audio/onboarding/{slideId}.mp3`. The presentation stops after the "founders" slide because subsequent audio files (promise, numbers, problem, etc.) may be missing or failing to load silently.

**Current Behavior**: 
- Audio hook (`useStoredPresentationAudio.ts`) fetches audio from storage
- If audio fails to load, `onerror` handler calls `onEnd()` which should trigger slide advance
- However, if the error occurs during loading, the fallback timer should kick in after `slide.duration + 5000ms`

**Possible Issues**:
1. Audio files don't exist in storage for slides beyond "founders"
2. The error handler isn't being triggered properly
3. The `hasPlayedForSlideRef` lock isn't being released correctly

---

## Implementation Plan

### Step 1: Update Call Attended SMS Language
Update the stage-change template to remove "management proposal":

**Before**:
```
Great speaking with you, {{name}}! As discussed, I'm preparing a management proposal for {{property_address}}. You'll receive it shortly.
```

**After**:
```
Great speaking with you, {{name}}! I've sent over some resources about {{property_address}} to help with your decision. Take your time reviewing – I'm here when you're ready!
```

### Step 2: Update Call Attended Email "Next Steps"
Update the email HTML to remove "management proposal" language:

**Before** (line 1124):
```
<strong>2.</strong> I'll send the management agreement shortly
```

**After**:
```
<strong>2.</strong> When you're ready, I'll send the management agreement
```

### Step 3: Update Database Follow-up Step Content
Update `lead_follow_up_steps` for sequence `c5bd3e19-dbf1-422c-8d79-64b48d1aec9b` step 1:

**Before**:
```
Next Steps:
1. Review the presentations above (5 min each)
2. Let me know if you have any questions
3. I'll prepare your custom management proposal
```

**After**:
```
Next Steps:
1. Review the presentations above (5 min each)
2. Let me know if you have any questions
3. When you're ready, I'll send over the management agreement
```

### Step 4: Fix Onboarding Presentation Auto-Continue
The issue is that the audio hook uses `oncanplaythrough` which only fires if the audio successfully loads. If the file doesn't exist (404), the `onerror` handler should fire, but there may be a timing issue.

**Fix**: Add more robust error handling and ensure the fallback timer always advances:

1. Add a timeout fallback during the loading phase (not just after play starts)
2. Ensure `onerror` properly clears the slide lock and calls `onEnd()`
3. Add logging to diagnose which slides are failing

**Changes to `useStoredPresentationAudio.ts`**:
- Add a loading timeout (5 seconds) that triggers `onEnd()` if audio doesn't start loading
- Ensure the mutex lock is cleared on ALL error paths
- Add better console logging for debugging

**Changes to `OnboardingPresentation.tsx`**:
- Reduce fallback timer from `duration + 5000` to `duration + 3000` for faster recovery
- Add a secondary safety net: if slide hasn't advanced in 30 seconds, force advance

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/process-lead-stage-change/index.ts` | Update SMS template (line 1246) and email HTML (line 1124) |
| `src/hooks/useStoredPresentationAudio.ts` | Add loading timeout and improve error handling |
| `src/pages/OnboardingPresentation.tsx` | Reduce fallback timer, add safety net |
| Database: `lead_follow_up_steps` | Update step 1 content via SQL |

### Database Update
```sql
UPDATE lead_follow_up_steps 
SET template_content = 'It was wonderful speaking with you today about {{property_address}}!

As promised, here are the resources we discussed:

[PRESENTATION_LINK:owner_portal]

This shows exactly how you''ll track your property''s performance, view upcoming bookings, and access financial reports – all in one place.

[PRESENTATION_LINK:onboarding]

Next Steps:
1. Review the presentations above (5 min each)
2. Let me know if you have any questions
3. When you''re ready, I''ll send over the management agreement

I''ll follow up in a couple of days. In the meantime, feel free to reach out anytime!'
WHERE id = '7ab15edf-c300-4f93-a90b-75aa933eb9cd';
```

### Audio File Verification
The audio files should exist at:
- `message-attachments/presentation-audio/onboarding/title.mp3`
- `message-attachments/presentation-audio/onboarding/founders.mp3`
- `message-attachments/presentation-audio/onboarding/promise.mp3` (likely missing!)
- ... and so on for all 18 slides

If audio files are missing, they need to be generated via the ElevenLabs TTS edge function and uploaded to storage.

---

## Summary

| Issue | Solution |
|-------|----------|
| "Management proposal" language | Replace with "management agreement when ready" |
| Designer presentation in call_attended | Already not included - no change needed |
| Presentation stops after founders slide | Add loading timeout + better error recovery |
