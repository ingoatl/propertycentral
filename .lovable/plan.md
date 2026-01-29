
# Smart Payment Setup Follow-up Emails with Service Type Differentiation

## Overview

This plan implements intelligent, daily follow-up emails for the payment setup stage that:
1. Differentiate between **Co-Hosting** clients (we charge them) and **Full-Service** clients (we pay them)
2. Use the Fortune 500 email template with psychological best practices
3. Send daily reminders with urgency increasing as the 1st of the month approaches
4. Correct the current inaccurate language about depositing "after each guest checkout" (actual: 5th of each month)

---

## Current State Analysis

### Existing Infrastructure
- `payment_setup_requests` table tracks reminder state per owner (reminder_1, reminder_2, final_reminder)
- `send-payment-setup-reminders` edge function runs via cron and sends reminders at days 3, 7, 14
- Follow-up sequences in `lead_follow_up_steps` for "ACH Form Reminders" (3 steps over 7 days)

### Problems to Fix
1. **Current interval (3, 7, 14 days) is too slow** - Need daily reminders as 1st approaches
2. **Generic messaging** - No differentiation between cohosting vs full-service
3. **Inaccurate language** - Says "deposit after each guest checkout" (wrong: we deposit on 5th of month)
4. **Missing Fortune 500 template** - Current reminder emails are basic
5. **Missing "1st of month" deadline framing** - No urgency anchored to billing cycle

---

## Updated Messaging Strategy

### Co-Hosting Clients (We CHARGE Them)
**Key Psychology**: Reduce friction, emphasize convenience, minimize "cost" framing

| Day | Theme | Psychological Principle |
|-----|-------|------------------------|
| 1 | Initial Request | Reciprocity - "We're ready to serve you" |
| 2 | Friendly Check-in | Social Proof - "Most owners complete in 2 mins" |
| 3 | Convenience Focus | Loss Aversion - "Avoid billing delays" |
| 4 | Benefits Reminder | Commitment - Reference signed agreement |
| 5 | Soft Urgency | Scarcity - "Complete before the 1st" |
| 6 | Final Reminder | Authority - "Required for services to continue" |

**Key Messaging Points**:
- "Payment method on file for management fees and approved expenses"
- "You'll see every charge before it posts"
- "Bank account (1% fee) or card (3% fee)"
- "This ensures smooth monthly reconciliation"

### Full-Service Clients (We PAY Them)
**Key Psychology**: Emphasize receiving money, minimize any "giving" framing

| Day | Theme | Psychological Principle |
|-----|-------|------------------------|
| 1 | Initial Request | Gain Framing - "So we can pay you" |
| 2 | Friendly Check-in | Reciprocity - "Your earnings are waiting" |
| 3 | Money Ready | Loss Aversion - "Don't miss your payout" |
| 4 | Deadline Approach | Urgency - "Complete before the 5th" |
| 5 | Last Chance | Scarcity - "Payouts process on the 5th" |
| 6 | Final Reminder | Authority - "Required for direct deposit" |

**Key Messaging Points**:
- "Set up your bank account to receive your rental earnings"
- "We deposit owner payouts on the 5th of each month"
- "Bank transfer only - no fees to you"
- "Your net earnings after expenses are deposited automatically"

---

## Corrected Language

### Full-Service Payment Email - BEFORE
```
"We'll deposit your rental earnings directly to your bank account after each guest checkout."
```

### Full-Service Payment Email - AFTER
```
"We'll deposit your net rental earnings directly to your bank account on the 5th of each month, following the monthly reconciliation."
```

---

## Technical Implementation

### 1. Update Initial Payment Request Emails

**File**: `supabase/functions/process-lead-stage-change/index.ts`

Update `buildFullServicePaymentEmailHtml()` and `buildCoHostingPaymentEmailHtml()`:
- Fix deposit timing language (5th of month)
- Add Fortune 500 header/footer structure
- Add deadline context ("Complete before [next 1st]")

### 2. Upgrade Reminder Edge Function

**File**: `supabase/functions/send-payment-setup-reminders/index.ts`

Changes:
- Change reminder schedule from (3, 7, 14 days) to daily reminders
- Add service_type lookup for each owner
- Create separate template sets for cohosting vs full_service
- Add "days until 1st" urgency messaging
- Use Fortune 500 email template structure

### 3. Add Database Columns for Daily Tracking

**Migration**: Add columns to `payment_setup_requests`:
```sql
ALTER TABLE payment_setup_requests 
ADD COLUMN last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN reminder_count INTEGER DEFAULT 0,
ADD COLUMN service_type TEXT DEFAULT 'cohosting';
```

### 4. Update Lead Follow-up Steps

**Database Update**: Modify "ACH Form Reminders" sequence to:
- Change to daily cadence
- Add service_type-aware templates
- Add {{days_until_first}} variable

---

## Fortune 500 Email Template Structure

All payment reminder emails will use this structure:

```text
┌──────────────────────────────────────────────┐
│  [PeachHaus Logo]          [PAYMENT SETUP]   │
│                            Status Badge      │
├──────────────────────────────────────────────┤
│  Property: [Address]                         │
│  Deadline: [Next 1st of Month]               │
├──────────────────────────────────────────────┤
│                                              │
│  Dear [FirstName],                           │
│                                              │
│  [Personalized message based on day/type]    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  This Will Be Used For                 │  │
│  │  [COHOSTING: Expenses & Mgmt Fees]     │  │
│  │  [FULL-SERVICE: Monthly Payouts]       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Payment Method Options Table]              │
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

## Reminder Email Templates by Day

### Co-Hosting Templates

**Day 1 (Initial)**: Already handled by `buildCoHostingPaymentEmailHtml`

**Day 2 - Friendly Check-in**:
> Hi [Name], just a quick follow-up on setting up your payment method. Most owners complete this in under 2 minutes. Once done, your monthly statements process automatically - no manual steps needed.

**Day 3 - Convenience Focus**:
> Hi [Name], having your payment method on file means no delays with your monthly reconciliation. You'll see every charge clearly before it processes - complete transparency, zero surprises.

**Day 4 - Commitment**:
> Hi [Name], now that your management agreement is signed, the final step is setting up payment. This ensures we can process your monthly fees and any approved property expenses seamlessly.

**Day 5 - Soft Urgency**:
> Hi [Name], just [X] days until the 1st. Complete your payment setup now to ensure your first billing cycle goes smoothly. Takes just 2 minutes.

**Day 6 - Final Reminder**:
> Hi [Name], this is a final reminder. Your payment method is required to continue property management services. Please complete setup today to avoid any service delays.

### Full-Service Templates

**Day 1 (Initial)**: Already handled by `buildFullServicePaymentEmailHtml`

**Day 2 - Friendly Check-in**:
> Hi [Name], just following up on setting up your payout account. Once complete, your rental earnings will be deposited directly to your bank on the 5th of each month - completely automatic.

**Day 3 - Money Ready**:
> Hi [Name], we want to make sure you receive your rental income on time. Owner payouts are processed on the 5th of each month. Set up your bank account now so you don't miss your first deposit.

**Day 4 - Deadline Approach**:
> Hi [Name], the 5th is approaching. To receive your payout this month, please complete your bank account setup. This is how we'll deposit your net rental earnings after the monthly reconciliation.

**Day 5 - Last Chance**:
> Hi [Name], payouts process on the 5th. If your bank account isn't set up by then, your payout will be delayed until next month. Please complete this 2-minute setup today.

**Day 6 - Final Reminder**:
> Hi [Name], final reminder: we can't deposit your rental earnings without your bank account on file. This is required for all full-service management clients. Please complete today to avoid payout delays.

---

## SMS Templates

### Co-Hosting
- Day 2: `Hi {{name}}, quick reminder to set up your payment method for monthly billing. Takes 2 min: {{link}} - PeachHaus`
- Day 4: `{{name}}, your payment setup is still pending. Complete before the 1st for smooth billing: {{link}} - PeachHaus`
- Day 6: `Final reminder {{name}} - payment method needed for continued service. Please complete today: {{link}} - PeachHaus`

### Full-Service
- Day 2: `Hi {{name}}, set up your bank account so we can deposit your rental earnings! Takes 2 min: {{link}} - PeachHaus`
- Day 4: `{{name}}, payouts go out on the 5th. Complete your bank setup to receive your earnings: {{link}} - PeachHaus`
- Day 6: `Final reminder {{name}} - bank account needed for your payout. Please complete today: {{link}} - PeachHaus`

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/process-lead-stage-change/index.ts` | Fix `buildFullServicePaymentEmailHtml` - change "after each checkout" to "on the 5th of each month" |
| `supabase/functions/send-payment-setup-reminders/index.ts` | Complete rewrite: daily reminders, service_type differentiation, Fortune 500 templates, 1st-of-month urgency |
| `supabase/functions/send-owner-payment-request/index.ts` | Add service_type lookup, use correct template |
| Database migration | Add columns: `last_reminder_sent_at`, `reminder_count`, `service_type` to `payment_setup_requests` |

---

## Technical Notes

### Daily Reminder Logic
```javascript
const daysSinceInitial = Math.floor((now - initialSentAt) / (1000 * 60 * 60 * 24));
const daysUntilFirst = getDaysUntilNextFirst();

// Send reminder if: not sent today AND < 6 total reminders
if (lastReminderDate !== today && reminderCount < 6) {
  const template = getTemplateForDay(reminderCount + 1, serviceType, daysUntilFirst);
  await sendReminder(owner, template);
  await updateReminderCount(request.id, reminderCount + 1);
}
```

### Days Until 1st Calculator
```javascript
function getDaysUntilNextFirst() {
  const now = new Date();
  let nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (now.getDate() === 1) nextFirst = now;
  return Math.ceil((nextFirst - now) / (1000 * 60 * 60 * 24));
}
```

---

## Summary

This implementation provides:

1. **Daily follow-ups** (6 total) instead of infrequent reminders
2. **Service-type differentiation** - different messaging for charging vs paying
3. **Corrected deposit timing** - 5th of month, not after each checkout
4. **Fortune 500 template** - professional, corporate styling
5. **Urgency framing** - tied to 1st of month billing cycle
6. **Psychological optimization** - reciprocity, loss aversion, commitment
