
# Payment Setup for Existing Onboarded Owners

## Overview

This plan creates a dedicated payment setup system for **existing owners who have already completed onboarding** but don't have Stripe payment details on file. The messaging will emphasize Stripe's security, streamlined processes, and differentiate between co-hosting (we charge them) and full-service (we pay them) clients.

---

## Current State Analysis

### Existing Infrastructure
- `OwnerPaymentSetup.tsx` - Landing page for owners to complete Stripe setup
- `send-owner-payment-request` edge function - Sends initial email with Stripe link
- `send-payment-setup-reminders` edge function - Runs daily to send follow-ups
- `payment_setup_requests` table - Tracks reminder state per owner

### Issues Found
1. **Bug**: `send-owner-payment-request/index.ts` uses `isFullService` variable but never defines it (line 136)
2. **Outdated messaging** on `OwnerPaymentSetup.tsx`: Shows "Please complete by December 5th" (hardcoded date)
3. **No streamlined batch request option** for existing owners
4. **Current emails don't emphasize "no forms needed"** - just Stripe's secure vault

### Owners Needing Setup
Based on database query, there are 4 owners without Stripe setup:
- Ingo Test (full_service)
- Sarah & Michael Thompson (cohosting - demo)
- Mara Santos (cohosting)
- Ellen K Hines (full_service)

---

## Updated Messaging Strategy

### Key Message: "No Forms - Just Stripe"

**Co-Hosting Clients** (We CHARGE them):
- **Security Focus**: "We're upgrading to Stripe - the same secure platform used by Amazon, Google, and millions of businesses"
- **Streamlined**: "No forms to fill out - just link your bank or card in 2 minutes"
- **Privacy**: "Your payment details are stored in Stripe's secure vault - we never see or store your card numbers"
- **Transparency**: "You'll see every charge before it's processed"

**Full-Service Clients** (We PAY them):
- **Gain Framing**: "Set up your bank account to receive your rental earnings"
- **Security Focus**: "Stripe's bank-level encryption keeps your info safe"
- **Streamlined**: "Quick 2-minute setup - no paperwork required"
- **Automatic**: "Once set up, payouts happen automatically on the 5th"

---

## Implementation

### 1. Fix Critical Bug in `send-owner-payment-request/index.ts`

Add missing variable definition:
```javascript
const isFullService = serviceType === 'full_service';
```

### 2. Update Initial Email Templates (Fortune 500 Style)

**Co-Hosting Initial Email**:
```text
Subject: Upgrading Your Payment Security - 2 Minute Setup

Hi [FirstName],

We're upgrading our payment system to Stripe — the industry-leading platform trusted by Amazon, Google, and millions of businesses worldwide.

WHY THE UPGRADE?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Bank-level encryption
✓ Your card/bank details are never stored on our servers
✓ Complete transparency - see every charge before it posts
✓ Automatic monthly processing - no manual payments needed

NO FORMS REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━
This isn't a form to fill out. You'll securely link your bank account or card directly through Stripe's protected portal. The entire process takes about 2 minutes.

[ Set Up Payment Method → ]

Your payment details will be used for:
• Monthly management fees
• Any approved property expenses
• Visit fees

Questions? Reply to this email or call (404) 800-5932.
```

**Full-Service Initial Email**:
```text
Subject: Set Up Your Payout Account - 2 Minute Setup

Hi [FirstName],

To ensure you receive your rental earnings on time, we need to set up your bank account in Stripe — the industry-leading payment platform trusted by millions.

WHY STRIPE?
━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Bank-level encryption protects your account details
✓ Your information is stored in Stripe's secure vault - not on our servers
✓ Payouts are automatic and reliable

QUICK 2-MINUTE SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━
No forms to fill out. Just link your bank account through Stripe's secure portal.

[ Set Up Payout Account → ]

Once complete, your net rental earnings will be deposited on the 5th of each month.

Questions? Reply to this email or call (404) 800-5932.
```

### 3. Update Reminder Email Templates

**Day 2 - Security Reassurance**:
```text
Subject: Quick Note About Stripe Security

Hi [FirstName],

Just following up on setting up your [payment method / payout account]. 

We wanted to reassure you that Stripe uses the same encryption standards as major banks. Your sensitive information is:

• Never stored on our servers
• Protected by 256-bit SSL encryption  
• Kept in Stripe's PCI-compliant secure vault

The setup takes just 2 minutes and you only need to do it once.

[ Complete Setup → ]
```

**Day 3-4 - Convenience Focus**:
- Emphasize "set it and forget it"
- Highlight automated monthly processing

**Day 5-6 - Urgency** (Same as current, but with dynamic date):
- Calculate days until 1st (cohosting) or 5th (full-service)
- Add urgency banner

### 4. Update Landing Page (`OwnerPaymentSetup.tsx`)

**Changes**:
1. Remove hardcoded "December 5th" date - use dynamic deadline
2. Add "No Forms - Just Stripe" messaging
3. Add Stripe security badges/trust signals
4. Differentiate messaging based on service type (fetch from API)

**Updated Content**:
```jsx
// For Co-Hosting:
<p className="font-medium text-amber-800">Secure Payment on File</p>
<p className="text-amber-700">
  Your details are stored in Stripe's encrypted vault — we never see or store your card numbers.
</p>

// For Full-Service:
<p className="font-medium text-green-800">Receive Your Rental Earnings</p>
<p className="text-green-700">
  We'll deposit your net earnings on the 5th of each month via secure bank transfer.
</p>
```

### 5. Add Bulk Send Feature (Admin UI)

Add a button in Property Owners page to send payment requests to all owners without Stripe setup:

```jsx
<Button onClick={handleBulkSendPaymentRequests}>
  <Send className="w-4 h-4 mr-2" />
  Send Payment Setup to All Pending
</Button>
```

This will call a new edge function that:
1. Finds all owners without `stripe_customer_id` and `has_payment_method = false`
2. Filters out demo/test accounts
3. Sends payment setup emails in batch
4. Creates/updates `payment_setup_requests` records

---

## Technical Changes

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-owner-payment-request/index.ts` | Fix bug: add `isFullService` variable; Update email templates with "no forms" messaging |
| `supabase/functions/send-payment-setup-reminders/index.ts` | Update reminder templates with security/Stripe focus |
| `src/pages/OwnerPaymentSetup.tsx` | Remove hardcoded date; Add service-type aware messaging; Improve security messaging |
| `supabase/functions/get-owner-for-payment/index.ts` | Add `service_type` to response for landing page |
| `src/pages/PropertyOwners.tsx` | Add bulk send button for admin convenience |

---

## Email Template Visual (Fortune 500 Style)

```text
┌──────────────────────────────────────────────┐
│  [PeachHaus Logo]        [PAYMENT SETUP]     │
│                          Status Badge        │
├──────────────────────────────────────────────┤
│                                              │
│  Hi [FirstName],                             │
│                                              │
│  We're upgrading to Stripe — the secure      │
│  payment platform trusted by millions.       │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  🔒 NO FORMS TO FILL OUT               │  │
│  │                                        │  │
│  │  Just link your bank account or card   │  │
│  │  through Stripe's secure portal.       │  │
│  │  Takes about 2 minutes.                │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  WHY STRIPE?                           │  │
│  │  ✓ Bank-level encryption               │  │
│  │  ✓ Details never stored on our servers │  │
│  │  ✓ Used by Amazon, Google, Shopify     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [ Set Up Payment / Payout Account → ]       │
│                                              │
├──────────────────────────────────────────────┤
│  [Ingo Signature with Headshot]              │
│  (404) 800-5932 · ingo@peachhausgroup.com    │
├──────────────────────────────────────────────┤
│  © PeachHaus Group LLC · Atlanta, GA         │
└──────────────────────────────────────────────┘
```

---

## Reminder Schedule (Daily)

| Day | Type | Theme | Key Message |
|-----|------|-------|-------------|
| 1 | Email | Initial | "Upgrading to Stripe - 2 min setup" |
| 2 | Email + SMS | Security | "Stripe uses bank-level encryption" |
| 3 | Email | Convenience | "Set it and forget it" |
| 4 | Email + SMS | Transparency | "See every charge before it posts" |
| 5 | Email | Soft Urgency | "X days until [deadline]" |
| 6 | Email + SMS | Final | "Required to continue services" |

---

## Summary

1. **Fix critical bug** - Add missing `isFullService` variable in send-owner-payment-request
2. **Update messaging** - Emphasize "no forms, just Stripe" and security
3. **Service-type differentiation** - Different language for charging vs paying
4. **Remove hardcoded date** - Use dynamic deadline calculation
5. **Daily Fortune 500-style reminders** - With security-focused content
6. **Add bulk send option** - For admin convenience
