
# Follow-Up Automation Enhancement Plan

## Current Situation Analysis

### What Sharri Byron Will Receive (Call Attended Stage)

When you move Sharri to `call_attended`, she receives the following automated sequence:

| Timing | Channel | Content |
|--------|---------|---------|
| Immediate | SMS | "Great speaking with you! As discussed, I'm preparing a management proposal for [property]. You'll receive it shortly." |
| +2 hours | Email | Full branded email with **Onboarding Presentation** and **Owner Portal Presentation** links embedded as CTA buttons |
| +2 days | SMS | Check-in: "Did you get a chance to watch the Owner Portal preview?" |
| +5 days | Email | Final follow-up with Owner Portal presentation link again |

**Yes, the presentations ARE included** - they get inserted via `[PRESENTATION_LINK:onboarding]` and `[PRESENTATION_LINK:owner_portal]` placeholders.

---

## The Gap: New Lead Stage Follow-Ups

Your current `new_lead` stage messaging is **generic and not optimized** for leads who:
- Requested an income report (already engaged, warm prospect)
- Showed specific interest in their property's earning potential
- Are pre-qualified by their action

### Current New Lead Messages
- SMS: Basic "thanks for scheduling" message
- Email: Generic welcome (no value-add, no differentiation)

---

## Proposed New Lead Follow-Up Sequence

Based on Fortune 500 sales psychology (Cialdini principles, SPIN methodology) and your existing high-performing patterns:

### Sequence: "Income Report Lead Nurture"

| Step | Timing | Channel | Psychology Principle | Content Strategy |
|------|--------|---------|---------------------|------------------|
| 1 | Immediate | Email | **Reciprocity + Authority** | Value-first email with personalized income insights and Onboarding Presentation |
| 2 | +4 hours | SMS | **Social Proof** | Quick text mentioning 1,400+ five-star reviews and Designer Presentation link |
| 3 | +24 hours | Email | **Commitment + Consistency** | Case study email with real revenue examples (Southvale $25K, Justice $23K) |
| 4 | +48 hours | SMS | **Scarcity** | Limited onboarding spots message with calendar link |
| 5 | +5 days | Email | **Loss Aversion** | "Properties like yours are earning" comparative analysis |

### Step-by-Step Message Templates

**Step 1: Immediate Welcome Email**
- Subject: "Your Income Analysis for [Property Address] is Ready"
- Content: Acknowledge they requested an income report, share key insight from the report, embed Onboarding Presentation button
- Principle: Give value immediately (Reciprocity)

**Step 2: +4 Hour SMS**
- "Hi [First Name]! Saw your income report request. Properties like yours in [area] are performing really well right now. Quick 5-min video on how we help owners: [Designer Presentation Link] - Anja"
- Principle: Social proof + visual credibility

**Step 3: +24 Hour Email**
- Subject: "How [Similar Property] Went from Empty to $25K/yr"
- Content: Southvale or Justice case study with before/after, embedded Owner Portal Presentation
- Principle: Show commitment path (if they read, they're invested)

**Step 4: +48 Hour SMS**
- "Hey [First Name], we have 2 onboarding spots left this month. Want me to hold one while we chat? Book here: [Calendar Link] - Anja"
- Principle: Scarcity creates urgency

**Step 5: +5 Day Email**
- Subject: "Properties like [Address] are earning X/month"
- Content: Market comparison, what they could be missing, final CTA for discovery call
- Principle: Loss aversion (what they're missing out on)

---

## Technical Implementation

### 1. Create New Follow-Up Sequence
Insert into `lead_follow_up_sequences`:
- Name: "Income Report Lead Nurture"
- Trigger Stage: `new_lead`
- Stop on Response: `true`

### 2. Create Follow-Up Steps
Insert 5 steps into `lead_follow_up_steps` with:
- Presentation link placeholders (`[PRESENTATION_LINK:onboarding]`, `[PRESENTATION_LINK:designer]`, `[PRESENTATION_LINK:owner_portal]`)
- Call type placeholders for contextual messaging
- AI personalization enabled

### 3. Update Edge Function
Modify `process-scheduled-follow-ups` to:
- Detect if lead came from income report request (via `opportunity_source` or notes)
- Include income report context in AI personalization
- Add Designer Presentation to the rotation

### 4. Deactivate Old Sequence
Set `is_active = false` on the existing generic "New Lead Welcome" sequence

---

## Watchdog Implementation

The system already has response detection via `stop_on_response: true` on sequences. When a lead responds:
1. `last_response_at` is updated on the lead
2. All pending follow-ups are skipped automatically in `process-scheduled-follow-ups`

---

## Summary

| Component | Change |
|-----------|--------|
| `lead_follow_up_sequences` | New "Income Report Lead Nurture" sequence |
| `lead_follow_up_steps` | 5 new steps with presentations + psychology-driven copy |
| `process-scheduled-follow-ups` | Add income report context detection |
| Existing sequence | Deactivate generic "New Lead Welcome" |

This transforms the new lead experience from a generic "thanks for your interest" to a value-driven nurture that leverages their existing engagement (income report request) and systematically builds toward a discovery call.
