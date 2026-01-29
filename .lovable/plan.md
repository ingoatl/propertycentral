
# Comprehensive Plan: Second Owner Signature, Call Attended Follow-ups, and Contact Cleanup

## 1. Second Owner Signature Without Separate Session

### Current Behavior
Currently, when there are two owners, the system creates **separate signing tokens** for each:
- Owner 1 gets their own signing link/token
- Owner 2 gets a separate signing link/token (via `create-signing-session`)

The SignDocument.tsx already tracks Owner 2 signatures separately (`owner2SignatureData` state), but these currently only work when the actual second owner accesses their separate session.

### Proposed Change: "Click-to-Sign" for Owner 2 During Owner 1's Session

When Owner 1 is signing, they can optionally fill in Owner 2's signature field by clicking on it. This should:
1. Prompt for Owner 2's signature drawing
2. Register that signature as Owner 2's signature
3. Mark the Owner 2 signature field as complete
4. Upon submission, save BOTH signatures with appropriate metadata

### Technical Implementation

**File: `src/pages/SignDocument.tsx`**
- Modify the signature field click handler to detect if it's an Owner 2 field being clicked by Owner 1
- Show the signature pad popup for Owner 2 when their field is clicked
- Store Owner 2's signature in `owner2SignatureData` state (already exists)
- On submission, include Owner 2 signature data in the payload with clear labeling

**File: `supabase/functions/submit-signature/index.ts`**
- Accept `secondOwnerSignatureData` in the request payload
- When Owner 1 submits with Owner 2's signature included:
  - Record Owner 2's signature separately
  - Mark the second_owner token as "signed" with metadata indicating "signed_via_primary_session"
  - Log audit entry noting this was a combined signing session
  - Set appropriate timestamp on second_owner's signing token

### UI Changes
- When Owner 1 clicks on an Owner 2 signature field, show a clear prompt: "Draw signature for Second Owner"
- Add a visual indicator that Owner 2's signature was captured during this session
- Show confirmation that both signatures were recorded upon submission

---

## 2. Call Attended Stage Follow-up Flow Analysis

### Current Implementation
The system has a **"Post-Call Follow-up"** sequence for `call_attended` stage with 3 steps:

| Step | Timing | Type | Content |
|------|--------|------|---------|
| 1 | 2 hours after | Email | "Great Speaking With You" - Sends Owner Portal + Onboarding presentation links |
| 2 | 2 days after | SMS | Casual check-in asking about Owner Portal preview |
| 3 | 5 days after | Email | "Quick Question" - Low-pressure follow-up highlighting transparency/portal |

### Psychology Principles Currently Applied
- **Commitment + Consistency** (Cialdini) - Referencing the conversation creates commitment
- **Reciprocity** - Providing valuable presentations before asking for action
- **Social Proof** - Mentioning "what excites our owners most"

### Research: Best Psychological Follow-up Practices

Based on behavioral psychology research for B2B sales follow-ups:

**Optimal Post-Call Sequence (Fortune 500 best practices):**

1. **Immediate (2h)**: Value-first email with promised resources + summary of key points discussed
2. **48h**: Softer touch (SMS) - acknowledges they're busy, offers quick help
3. **5 days**: Email with new insight/value (not just "checking in")
4. **10 days**: Optional "last chance" with scarcity element

**Recommended Improvements:**

| Step | Timing | Type | Psychological Approach |
|------|--------|------|----------------------|
| 1 | 2h | Email | **Reciprocity**: Deliver on promises immediately. Use Fortune 500 email template with AI call summary. Add social proof element. |
| 2 | 48h | SMS | **Consistency**: "Just wanted to make sure you received everything from our call" - subtle commitment reinforcement |
| 3 | 5 days | Email | **Authority + Liking**: Share a relevant insight (market data, case study) that shows expertise. Use Ilana/Design reference per memory. |

### Fortune 500 Email Template Application

The system already has a Fortune 500-style template in `owner-call-notifications/index.ts`. Key elements:

```text
- Clean corporate header with logo
- Badge/status indicator (e.g., "NEXT STEPS")
- Structured call details table
- Signature section with headshot
- Professional footer
```

**Changes needed:**
- Apply this same template structure to the `buildCallAttendedEmailHtml()` function in `process-lead-stage-change/index.ts`
- The current template is simpler - needs upgrade to Fortune 500 style

### Updated Follow-up Content (Psychology-Optimized)

**Step 1 (2h email)**: 
- Fortune 500 template styling
- Include AI-generated call summary from `lead.ai_summary`
- Link to both presentations (Owner Portal + Onboarding)
- Optional: Add designer presentation link mentioning Ilana (per memory)

**Step 2 (48h SMS)**:
- Keep casual but add value: "Quick tip: Most owners find the Owner Portal walkthrough answers 80% of their questions. Did you get a chance to check it out?"

**Step 3 (5d email)**:
- Add case study/social proof element
- Reference specific benefit discussed in call (if available from ai_summary)
- Single clear CTA

---

## 3. Remove Sterling Hines Duplicate Contact

### Current State
There are two owner records with "Hines" in the name:

| Owner ID | Name | Email | Has Property | Has Lead |
|----------|------|-------|--------------|----------|
| b3d686b0-6eb2-4f57-ac12-9a389c94f534 | Ellen K Hines | ellenkhines@gmail.com | YES (2 properties: 1427 & 1429 Hazy Way) | No |
| cd300c76-5f0b-491c-bac0-0a79a14417f5 | Sterling Hines | delta57.llc@gmail.com | NO | YES (1 lead) |

### Dependencies Check for Sterling Hines (cd300c76-...)
- **Leads**: 1 record (Sterling Hines lead for 1429 Hazy Way)
- **Properties**: 0 records
- **Monthly Reconciliations**: 0 records
- **Owner Calls**: 0 records
- **Booking Documents**: 0 records

### Safe Deletion Plan

**Step 1**: Reassign the lead from Sterling Hines owner to Ellen K Hines
- The lead is for "1429 Hazy Way" which is already owned by Ellen K Hines
- Update `leads.owner_id` from `cd300c76-...` to `b3d686b0-...`

**Step 2**: Delete the orphan Sterling Hines owner record
- No other references exist
- Safe to delete after lead reassignment

### SQL to Execute (via Cloud View > Run SQL)
```sql
-- Step 1: Reassign lead to Ellen K Hines
UPDATE leads 
SET owner_id = 'b3d686b0-6eb2-4f57-ac12-9a389c94f534'
WHERE owner_id = 'cd300c76-5f0b-491c-bac0-0a79a14417f5';

-- Step 2: Delete orphan owner record
DELETE FROM property_owners 
WHERE id = 'cd300c76-5f0b-491c-bac0-0a79a14417f5';
```

---

## Summary of Changes

| Component | Action |
|-----------|--------|
| `src/pages/SignDocument.tsx` | Allow Owner 1 to capture Owner 2's signature during their session |
| `supabase/functions/submit-signature/index.ts` | Accept and process combined owner signatures |
| `supabase/functions/process-lead-stage-change/index.ts` | Upgrade `buildCallAttendedEmailHtml()` to use Fortune 500 template |
| Database (lead_follow_up_steps) | Update call_attended sequence templates with psychology-optimized content |
| Database (manual SQL) | Reassign lead and delete orphan Sterling Hines record |

---

## Technical Notes

### Second Owner Signature Flow
```text
Owner 1 Session:
├── Fill Owner 1 fields
├── Click Owner 2 signature field → Opens signature pad
├── Capture Owner 2 signature → Stored separately
├── Submit → Both signatures sent to backend
└── Backend:
    ├── Record Owner 1 signature on owner token
    ├── Record Owner 2 signature on second_owner token
    └── Mark both as signed (second_owner has metadata: signed_via_primary_session=true)
```

### Call Attended Follow-up Timing
```text
Call Attended Stage:
├── Immediately: Lead updated, AI summary generated
├── +2h: Fortune 500 email with presentations + summary
├── +48h: SMS check-in with value tip
└── +5d: Email with case study/social proof
```
