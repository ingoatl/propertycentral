
# Voice Call Routing with ElevenLabs AI Agent

## Overview

This plan implements a sophisticated voice routing system where the ElevenLabs AI agent (Ava) acts as the intelligent front door for all inbound calls, with the ability to route callers to specific team members.

## ✅ IMPLEMENTATION COMPLETE

### What Was Built

#### 1. Database Schema
- **`user_presence`** table created for real-time availability tracking
- Added `mobile_number`, `department`, `skills` columns to `team_routing`
- Realtime enabled for presence updates

#### 2. New Edge Function: `twilio-call-transfer`
Handles live call transfers via Twilio REST API:
- Resolves team members by name from `team_routing` table
- Checks user availability from `user_presence`
- Supports browser, phone, and voicemail transfer types
- Updates call with new TwiML dynamically

#### 3. Updated: `twilio-elevenlabs-bridge`
Added client tool handling for:
- **`transfer_to_team_member`** - Initiates transfer to specific team member
- **`check_team_availability`** - Returns who is online/available
- **`leave_voicemail`** - Routes to voicemail for specific team member

#### 4. Updated: `twilio-inbound-voice`
Hybrid routing logic:
- **GHL Number Calls** → Ring team member's browser directly, AI backup if unavailable
- **Main Twilio Number** → All calls go to ElevenLabs AI Agent
- **Forwarded from GHL** → Route to IVR operator (existing behavior)

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        INBOUND CALL FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Caller Dials Number                                              │
│                    │                                                │
│         ┌─────────┴─────────┐                                      │
│         ▼                   ▼                                      │
│   User's GHL Number    Main Number (+17709885286)                  │
│         │                   │                                      │
│         ▼                   ▼                                      │
│   ┌─────────────┐    ┌─────────────────────┐                      │
│   │ Ring Browser │    │ ElevenLabs AI Agent │                      │
│   │ (30s timeout)│    │ - Greets with context│                      │
│   └─────────────┘    │ - Handles queries    │                      │
│         │            │ - Can transfer       │                      │
│         ▼            └─────────────────────┘                      │
│   No Answer?               │                                       │
│         │         ┌────────┼────────┐                              │
│         ▼         ▼        ▼        ▼                              │
│   AI Voicemail  Handle   Transfer   Voicemail                      │
│     Backup      Directly  to Team   Recording                      │
│                            │                                       │
│                   ┌────────┴────────┐                              │
│                   ▼                 ▼                              │
│             Browser Client    Mobile Number                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Manual Configuration Required

### ElevenLabs Dashboard Setup

Add these client tools to your ElevenLabs agent:

**1. `transfer_to_team_member`**
```json
{
  "name": "transfer_to_team_member",
  "description": "Transfer the call to a specific team member",
  "parameters": {
    "type": "object",
    "properties": {
      "team_member_name": {
        "type": "string",
        "description": "Name of the team member (Alex, Anja, or Ingo)"
      }
    },
    "required": ["team_member_name"]
  }
}
```

**2. `check_team_availability`**
```json
{
  "name": "check_team_availability",
  "description": "Check which team members are currently available",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

**3. `leave_voicemail`**
```json
{
  "name": "leave_voicemail",
  "description": "Leave a voicemail for a specific team member",
  "parameters": {
    "type": "object",
    "properties": {
      "team_member_name": {
        "type": "string",
        "description": "Name of the team member"
      },
      "reason": {
        "type": "string",
        "description": "Brief reason for the voicemail"
      }
    },
    "required": ["team_member_name"]
  }
}
```

### Agent Prompt Addition

Add this to your ElevenLabs agent prompt:
```
TRANSFER CAPABILITIES:
When a caller wants to speak with someone specific or has a complex issue:
1. Ask who they'd like to speak with (Alex, Anja, or Ingo)
2. Use transfer_to_team_member tool with their name
3. If transfer fails, offer to take a voicemail

Team Directory:
- Alex: Sales inquiries, new leads, property tours
- Anja: Operations, current owners, maintenance
- Ingo: Leadership, contracts, escalations

Before transferring, always use check_team_availability to see who is online.
```

## Testing

1. **Call main number** → Verify AI answers with personalized greeting
2. **Say "Transfer me to Alex"** → Verify transfer tool triggers
3. **Call user's GHL number** → Verify direct browser ring
4. **No answer on browser** → Verify AI voicemail fallback

## Files Modified/Created

| File | Action |
|------|--------|
| `supabase/functions/twilio-call-transfer/index.ts` | ✅ Created |
| `supabase/functions/twilio-elevenlabs-bridge/index.ts` | ✅ Modified |
| `supabase/functions/twilio-inbound-voice/index.ts` | ✅ Modified |
| `supabase/config.toml` | ✅ Modified |
| Database: `user_presence` table | ✅ Created |
| Database: `team_routing` columns | ✅ Added |

