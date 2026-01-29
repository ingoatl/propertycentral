
# Admin Signing Email Fix: Route to Anja & Ingo

## Problem Identified

1. **Wrong email recipient for admin signatures**: The `create-signing-session` edge function sets manager emails to `info@peachhausgroup.com` instead of `anja@peachhausgroup.com` and `ingo@peachhausgroup.com`

2. **Login redirect issue**: When Anja clicks the signing link, she's redirected to the Lovable login page - this appears to be a browser/cache issue, NOT a code issue. The `/sign/:token` route is correctly outside the auth-protected Layout, and no auth checks exist in the signing flow.

---

## Root Cause

In `supabase/functions/create-signing-session/index.ts` (lines 174, 177):

```typescript
// Current - sends to info@ instead of Anja/Ingo
signers.push({ 
  name: "PeachHaus Group", 
  email: "info@peachhausgroup.com",  // WRONG
  type: "manager", 
  order: 3 
});
```

When the owner signs, `submit-signature` sends the next-signer email to whatever email is stored in `signing_tokens` - which is `info@peachhausgroup.com`.

---

## Solution

### 1. Update `create-signing-session/index.ts`

Change the manager signer to send to both Anja and Ingo:
- Create TWO manager tokens: one for `anja@peachhausgroup.com`, one for `ingo@peachhausgroup.com`
- Each gets their own signing link
- When the owner signs, BOTH receive the "your turn to sign" email

### 2. Update `submit-signature/index.ts`

When sending the "next signer" email:
- If next signer(s) are managers, send to BOTH Anja and Ingo
- This ensures both admins are notified regardless of who countersigns

---

## Technical Changes

### File: `supabase/functions/create-signing-session/index.ts`

**Changes:**
1. Replace single manager signer with two entries:
```typescript
// Send to BOTH Anja and Ingo
signers.push({ 
  name: "Anja Haeder", 
  email: "anja@peachhausgroup.com", 
  type: "manager", 
  order: nextOrder 
});
signers.push({ 
  name: "Ingo Haeder", 
  email: "ingo@peachhausgroup.com", 
  type: "manager", 
  order: nextOrder  // Same order - either can sign
});
```

### File: `supabase/functions/submit-signature/index.ts`

**Changes:**
1. When notifying next signers, if the signer type is "manager", send emails to ALL manager tokens (both Anja and Ingo), not just one
2. Both admins receive the signing link so either can complete the countersignature

---

## Implementation Notes

- The signing order for both managers is the SAME (e.g., both order 2 or 3)
- When either Anja OR Ingo signs, the document is complete
- Both receive the notification email with the signing link
- First one to sign completes the document

---

## Why Login Redirect Happens

The `/sign/:token` route is correctly PUBLIC (line 141 in App.tsx, before the Layout catch-all at 155). There's no auth check in:
- `SignDocument.tsx` - validates token via edge function, no auth required
- `validate-signing-token/index.ts` - uses service role key, no user auth needed
- `submit-signature/index.ts` - uses service role key, no user auth needed

**Likely cause**: Anja is clicking a link from an OLD email that was generated before the APP_URL was fixed (when it was still pointing to the preview URL). The preview URL requires Lovable login.

**Verification**: New documents created AFTER the fix should work correctly with the production URL `https://propertycentral.lovable.app/sign/...`

---

## Summary

| Change | Location |
|--------|----------|
| Replace `info@peachhausgroup.com` with Anja + Ingo | `create-signing-session/index.ts` |
| Send notification to ALL manager tokens | `submit-signature/index.ts` |
| Deploy edge functions | Automatic |
