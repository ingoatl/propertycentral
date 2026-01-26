
# Voice Call Routing with ElevenLabs AI Agent

## Overview

This plan implements a sophisticated voice routing system where the ElevenLabs AI agent (Ava) acts as the intelligent front door for all inbound calls, with the ability to route callers to specific team members.

## Recommended Architecture: AI-First with Smart Routing

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        INBOUND CALL FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Caller Dials Main Number (+17709885286)                          │
│                    │                                                │
│                    ▼                                                │
│   ┌────────────────────────────────┐                               │
│   │   twilio-inbound-voice         │                               │
│   │   (Initial Routing Decision)    │                               │
│   └────────────────────────────────┘                               │
│                    │                                                │
│         ┌─────────┴─────────┐                                      │
│         ▼                   ▼                                      │
│   Known Lead/Owner?    Unknown Caller                              │
│         │                   │                                      │
│         └─────────┬─────────┘                                      │
│                   ▼                                                │
│   ┌────────────────────────────────┐                               │
│   │   ElevenLabs AI Agent (Ava)    │                               │
│   │   - Context-aware greeting     │                               │
│   │   - Answer questions           │                               │
│   │   - Qualify needs              │                               │
│   └────────────────────────────────┘                               │
│                   │                                                │
│         ┌─────────┼─────────┐                                      │
│         ▼         ▼         ▼                                      │
│   Handle Call   Transfer   Voicemail                               │
│   Directly      to Team    Recording                               │
│                   │                                                │
│         ┌─────────┴─────────┐                                      │
│         ▼                   ▼                                      │
│   Browser Client      Mobile/GHL Number                            │
│   (Real-time)         (Fallback)                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Configure ElevenLabs Agent with Transfer Tools

Update the ElevenLabs agent in the ElevenLabs dashboard to include client tools:

**Tools to Configure:**
- `transfer_to_team_member` - Parameters: `team_member_name` (string)
- `check_team_availability` - Returns who is online/available
- `leave_voicemail` - Parameters: `team_member_name` (string), `reason` (string)

**Agent Prompt Enhancement:**
```
When a caller wants to speak with someone specific or has a complex issue:
1. Ask who they'd like to speak with (Alex, Anja, or Ingo)
2. Use transfer_to_team_member tool with their name
3. If transfer fails, offer to take a voicemail

Team Directory:
- Alex: Sales inquiries, new leads, property tours
- Anja: Operations, current owners, maintenance
- Ingo: Leadership, contracts, escalations
```

### Step 2: Update twilio-elevenlabs-bridge with Transfer Logic

**File: `supabase/functions/twilio-elevenlabs-bridge/index.ts`**

Add a new function to handle call transfers when the AI agent triggers the tool:

```typescript
// Handle transfer_to_team_member tool call
if (toolCall?.tool_name === 'transfer_to_team_member') {
  const teamMemberName = toolCall.parameters?.team_member_name?.toLowerCase();
  
  // Look up team member from team_routing table
  const { data: teamMember } = await supabase
    .from('team_routing')
    .select('*')
    .ilike('display_name', `%${teamMemberName}%`)
    .eq('is_active', true)
    .maybeSingle();
  
  if (teamMember) {
    // Send transfer TwiML back to Twilio
    // This requires a different approach - use Twilio REST API to modify the call
  }
}
```

### Step 3: Create Call Transfer Edge Function

**File: `supabase/functions/twilio-call-transfer/index.ts`**

New function to handle live call transfers:

```typescript
// Receives: callSid, targetNumber, targetUserId
// Uses Twilio REST API to:
// 1. Update the call with new TwiML (Dial to team member)
// 2. Or use <Conference> for warm transfer
```

### Step 4: Update twilio-inbound-voice for GHL Number Handling

**Decision for GHL Numbers:**

| Scenario | Routing |
|----------|---------|
| Call to Main Twilio → AI Agent first, then transfer if needed |
| Call to User's GHL Number → Ring browser directly, AI as voicemail backup |
| Call forwarded FROM GHL → IVR operator (existing behavior) |

**Updates needed:**
- Add check for `toNumber` matching user's GHL number
- Route GHL number calls to user's browser client directly
- Fallback to AI voicemail if no answer after 30 seconds

### Step 5: Implement Team Availability Checking

Create a real-time presence system:

**Database table**: `user_presence` (already may exist or needs creation)
- `user_id`, `is_available`, `last_seen`, `status` (online/away/dnd)

**Browser integration**: Update TwilioProvider to report presence

### Step 6: Update Voicemail Handling

When AI takes a voicemail for a specific team member:
- Tag the recording with the intended recipient
- Send notification to that team member
- Add to their inbox specifically

## GHL Number Strategy Recommendation

**Option A: AI Gateway (Recommended)**
- All GHL numbers forward to main Twilio number
- AI handles all initial calls, transfers as needed
- Pro: Consistent experience, AI qualification
- Con: Extra step for known contacts

**Option B: Direct Ring with AI Backup**
- GHL numbers ring user's browser directly
- If no answer in 30 seconds → AI takes over
- Pro: Faster for direct contacts
- Con: Requires GHL forwarding configuration

**Option C: Hybrid (Best of Both)**
- Known contacts (leads/owners in DB) → Ring team member directly
- Unknown callers → AI agent first
- Pro: Personalized for known contacts, qualification for new

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/twilio-elevenlabs-bridge/index.ts` | Modify | Add transfer tool handling |
| `supabase/functions/twilio-call-transfer/index.ts` | Create | Handle live call transfers via Twilio API |
| `supabase/functions/twilio-inbound-voice/index.ts` | Modify | Add GHL direct routing option |
| Database migration | Create | Add `user_presence` table if needed |
| ElevenLabs Dashboard | Configure | Add client tools for transfer/availability |

## Technical Requirements

1. **Twilio Configuration**: Ensure `TWILIO_API_KEY` and `TWILIO_API_SECRET` are set (already exist)
2. **ElevenLabs Agent**: Configure tools in ElevenLabs web UI (manual step)
3. **GHL Setup**: Configure call forwarding rules in GoHighLevel dashboard

## Testing Plan

1. Call main number → Verify AI answers with context
2. Say "I want to speak with Alex" → Verify transfer initiates
3. Call user's GHL number → Verify direct browser ring
4. No answer on browser → Verify AI voicemail fallback
5. Unknown caller → Verify AI qualification flow

## Questions for Configuration

Before implementation, please confirm:
1. Should all GHL numbers forward to main Twilio, or should they ring directly?
2. For transfer failures, should we: (a) leave voicemail, (b) try mobile number, (c) both?
3. Should the AI announce "transferring you now" or silently transfer?
