
# Property Central SMB Completion & Team Hub Integration Plan

## Executive Summary

After thorough code review, the "ninja improvements" created excellent infrastructure that is **not yet integrated** into the app. This plan completes the SMB transformation by:
1. Activating the unused improvements
2. Enhancing the Team Hub for seamless team communication
3. Adding the final SMB-critical features

---

## Phase 1: Activate Existing Improvements (Day 1)

### 1.1 Integrate ErrorBoundary into App.tsx

The ErrorBoundary component exists but isn't imported. We need to wrap the app to prevent crashes:

```text
App.tsx changes:
├── Import ErrorBoundary from '@/components/ErrorBoundary'
├── Wrap QueryClientProvider with ErrorBoundary
├── Add section-specific boundaries around Layout
└── Add QueryErrorResetBoundary for React Query errors
```

This prevents the entire app from crashing when a single component fails.

### 1.2 Add ErrorBoundary to Critical Sections

Wrap high-risk areas:
- InboxView (4,448 lines - most likely to have issues)
- Dashboard (complex data fetching)
- TeamHub (real-time features)
- Maintenance (file uploads, vendor portal)

---

## Phase 2: Team Hub SMB Enhancements (Days 2-3)

### 2.1 Deep Integration with Business Entities

Currently Team Hub messages can reference properties/leads/work orders, but the UI doesn't display this well.

**Enhancements:**
```text
Message Context Cards:
├── When message has property_id → Show property card with photo, address
├── When message has lead_id → Show lead card with status, contact info
├── When message has work_order_id → Show work order status, vendor, photos
└── When message has owner_id → Show owner card with properties
```

### 2.2 Quick Actions from Team Hub

Add ability to take action directly from messages:
- "Create task from this message"
- "Forward to owner"
- "Convert to work order"
- "Schedule follow-up"

### 2.3 Channel Templates for SMB Teams

Pre-configured channels for property management:
```text
Default Channels:
├── #general (announcements)
├── #maintenance-alerts (auto-posts from work orders)
├── #owner-updates (owner portal activity)
├── #urgent (high-priority items)
└── #daily-standup (AI-generated daily summary)
```

### 2.4 AI-Powered Team Features

- **Daily Digest Bot**: Posts morning summary of today's tasks, visits, calls
- **Smart @mentions**: "@alex re: Sunset Blvd leak" auto-links to the property
- **Message Summarization**: Catch up on long threads with AI summary

---

## Phase 3: Mobile-First Team Communication (Day 4)

### 3.1 Push Notifications

The `send-team-notification` edge function exists. Enable browser push:
```text
Components needed:
├── Service Worker registration
├── VAPID key generation (one-time admin setup)
├── Permission request UI
└── Background notification handling
```

### 3.2 Quick Reply from Mobile Header

The mobile header already has Team Hub button. Enhance with:
- Quick compose floating action
- Voice-to-text for messages
- Swipe gestures for channel switching

---

## Phase 4: Adopt Shared Utilities (Days 5-6)

### 4.1 Update High-Traffic Edge Functions

Priority functions to update with shared utilities:
```text
High Priority (most used):
├── ghl-send-sms/index.ts
├── send-voicemail/index.ts
├── owner-portal-data/index.ts
├── fetch-gmail-inbox/index.ts
├── ai-assistant/index.ts
└── sync-ownerrez/index.ts
```

Each update:
1. Import from `../_shared/cors.ts`
2. Import from `../_shared/response.ts`
3. Import from `../_shared/auth.ts` (where applicable)
4. Import from `../_shared/logging.ts`
5. Replace inline patterns with helpers

### 4.2 Add Rate Limiting Table

Protect API endpoints from abuse:
```sql
CREATE TABLE rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rate_limits_lookup ON rate_limit_logs(user_id, action, created_at);
```

---

## Phase 5: SMB Multi-Tenant Preparation (Day 7)

### 5.1 Tenant API Credentials Table

Allow different clients to use their own GHL/Twilio:
```sql
CREATE TABLE tenant_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES auth.users(id),
  provider TEXT NOT NULL, -- 'ghl', 'twilio', 'telnyx'
  credentials JSONB NOT NULL, -- encrypted
  phone_numbers JSONB DEFAULT '[]',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Credential Lookup in Edge Functions

Update communication functions to check for tenant credentials:
```text
Logic flow:
1. Get user's tenant_id
2. Check tenant_api_credentials for custom credentials
3. If found → Use their credentials
4. If not → Use platform defaults (with rate limiting)
```

---

## Technical Implementation Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/team-hub/MessageContextCard.tsx` | Display linked entities in messages |
| `src/components/team-hub/QuickActions.tsx` | Action buttons on messages |
| `src/components/team-hub/DailyDigestBot.tsx` | AI summary component |
| `src/hooks/usePushNotifications.ts` | Push notification registration |
| `public/sw.js` | Service worker for background notifications |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add ErrorBoundary wrapping |
| `src/components/Layout.tsx` | Add ErrorBoundary around main content |
| `src/hooks/useTeamHub.ts` | Add context card data fetching |
| `src/pages/TeamHub.tsx` | Add quick actions, enhance mobile UX |
| 6+ edge functions | Adopt shared utilities |

### Database Changes

1. **Add rate_limit_logs table** - API protection
2. **Add tenant_api_credentials table** - Multi-tenant readiness
3. **Add team_channel_templates table** - Pre-configured channels
4. **Add team_daily_digests table** - Store generated summaries

---

## Before vs After Summary

| Aspect | Before (Fragile) | After (SMB-Ready) |
|--------|------------------|-------------------|
| Error Handling | App crashes on JS errors | Graceful recovery with retry |
| Team Communication | Basic Slack-clone | Deeply integrated with business entities |
| Edge Functions | 235 functions with duplicated code | Shared utilities, consistent patterns |
| Mobile Experience | Functional but basic | Push notifications, quick actions |
| Multi-Tenant | Single-tenant hardcoded | Credential isolation ready |
| Query Management | Scattered keys | Centralized factory (partially adopted) |

---

## Recommended Implementation Order

1. **Immediate** (prevents crashes): Integrate ErrorBoundary
2. **Day 1-2**: Team Hub entity integration (property/lead/work order cards)
3. **Day 3**: Push notification infrastructure
4. **Day 4-5**: Adopt shared utilities in top 10 edge functions
5. **Day 6**: Add tenant_api_credentials table
6. **Day 7**: Update communication functions for multi-tenant

---

## Team Hub Decision: Keep Integrated ✅

The Team Hub should remain part of Property Central because:

1. **Shared Context**: Messages can directly reference properties, leads, work orders
2. **Single Auth**: Team members use same login for everything
3. **Unified Notifications**: One bell icon, one notification system
4. **Mobile Simplicity**: One app to bookmark/install
5. **Existing Infrastructure**: Already 13 components built and working

Separating it would require duplicating auth, creating API bridges, and fragmenting the user experience.
