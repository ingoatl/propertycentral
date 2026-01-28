
# Implementation Plan: Meeting Transcription, User Tasks, and Public Presentations

## ✅ COMPLETED (Jan 28, 2026)

## Overview
This plan addresses three core requirements:
1. **Meeting Transcript Capture**: Get and analyze the Google Meet call with Eric Ha
2. **User Task Management System**: Create a dedicated task dashboard for each user  
3. **Public Presentation Access**: Ensure presentations work without authentication

---

## Part 1: Meeting Transcript from Eric Ha Call

### Current State
- Recall.ai integration exists (`recall-send-bot`, `recall-meeting-webhook`)
- The `meeting_recordings` table is currently empty (no meetings have been recorded yet)
- Analysis pipeline exists in `analyze-call-transcript` Edge Function

### Required Actions

**Option A: Record Future Meetings (Recommended)**
The bot must join a meeting while it's in progress. For the Eric Ha meeting that already ended, we cannot retroactively get the transcript via Recall.ai.

**Option B: Manual Transcript Import**
If you have a transcript from Google Meet's built-in transcription or another source:
1. Create a manual upload interface
2. Process through existing analysis pipeline

### Implementation
1. **New Edge Function**: `import-meeting-transcript`
   - Accept manual transcript text + participant info
   - Create `meeting_recordings` entry
   - Trigger `analyze-call-transcript` for task extraction

2. **UI Component**: Meeting transcript upload in Communications or Dashboard
   - Paste transcript text
   - Select participant (lead/owner/contact)
   - Auto-generate tasks from conversation

---

## Part 2: User Task Management System

### Research: High-End Task Management Patterns

Based on tools like **Linear**, **Notion**, **Monday.com**, and **Asana**:

| Feature | Linear | Notion | Asana | Our Implementation |
|---------|--------|--------|-------|-------------------|
| Personal task view | My Issues | My Tasks | My Tasks | **My Tasks section** |
| Priority levels | Urgent/High/Medium/Low | Custom | High/Medium/Low | **4-level priority** |
| Due dates | Yes + cycles | Yes | Yes + milestones | **Yes** |
| Source attribution | Linked issues | Relations | Subtasks | **Source tracking** (call, meeting, manual) |
| Status workflow | Backlog → Done | Custom | Custom | **pending → in_progress → completed** |

### Database Design

**New Table: `user_tasks`**
```sql
CREATE TABLE user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  source_type TEXT, -- 'meeting', 'call', 'email', 'manual', 'ai_suggested'
  source_id UUID, -- Reference to meeting_recordings, lead_communications, etc.
  related_contact_type TEXT, -- 'lead', 'owner', 'vendor'
  related_contact_id UUID,
  property_id UUID REFERENCES properties(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Dashboard Integration

**New Component: `UserTasksPanel`**
Location: Dashboard.tsx (visible to all authenticated users)

```text
+------------------------------------------+
|  My Tasks                    [+ Add Task] |
+------------------------------------------+
|  URGENT (2)                              |
|  ┌─────────────────────────────────────┐ |
|  │ ○ Follow up with Eric Ha            │ |
|  │   From: Meeting • Due: Today        │ |
|  └─────────────────────────────────────┘ |
|                                          |
|  DUE TODAY (3)                           |
|  ┌─────────────────────────────────────┐ |
|  │ ○ Send proposal to new lead         │ |
|  │   From: Call • Property: Woodland   │ |
|  └─────────────────────────────────────┘ |
|                                          |
|  THIS WEEK (5)                           |
|  ...                                     |
+------------------------------------------+
```

### Features
1. **Personal task view**: Each user only sees their own tasks
2. **AI task suggestions**: From `pending_task_confirmations` flow into this with approval
3. **Meeting-generated tasks**: Auto-created when transcript is analyzed
4. **Quick add**: Manual task creation from dashboard
5. **Source context**: Click to see original meeting/call that generated task
6. **Drag-and-drop prioritization**: Reorder tasks within categories

---

## Part 3: Public Presentation Access

### Current Issue Analysis
The presentation routes are correctly placed outside the auth-protected Layout wrapper in `App.tsx`:
```jsx
<Route path="/onboarding-presentation" element={<OnboardingPresentation />} />
<Route path="/owner-portal-presentation" element={<OwnerPortalPresentation />} />
```

However, there may be a caching or deep-linking issue causing redirects.

### Solution
1. **Verify no auth imports**: Confirm presentations don't import `useAuth` or check session
2. **Add explicit public handling**: Prevent any accidental auth redirects
3. **Create short URLs**: `/p/onboarding` and `/p/owner-portal` for easier sharing
4. **Add Open Graph meta tags**: For better link previews when shared

### Implementation
- Add route aliases for cleaner URLs
- Ensure no auth state checks in presentation components
- Test with incognito browser to confirm public access

---

## Implementation Order

### Phase 1: Public Presentations (Quick Win)
- Verify and fix any auth redirect issues
- Add short URL aliases
- Test in incognito mode

### Phase 2: User Tasks Database
- Create `user_tasks` table with RLS policies
- Migrate relevant `pending_task_confirmations` flow

### Phase 3: Dashboard UI
- Build `UserTasksPanel` component
- Integrate with Dashboard.tsx for all users
- Add quick task creation modal

### Phase 4: Meeting Transcript Integration
- Create manual transcript import function
- Connect to task generation pipeline
- Add UI for uploading transcripts

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/xxx_user_tasks.sql` | Create `user_tasks` table |
| `src/components/dashboard/UserTasksPanel.tsx` | New component |
| `src/components/dashboard/AddTaskModal.tsx` | Quick task creation |
| `src/hooks/useUserTasks.ts` | Data fetching hook |
| `src/pages/Dashboard.tsx` | Integrate UserTasksPanel |
| `supabase/functions/import-meeting-transcript/index.ts` | Manual transcript import |
| `src/App.tsx` | Add short URL routes for presentations |

---

## Technical Notes

### RLS Policies for user_tasks
```sql
-- Users can only see their own tasks
CREATE POLICY "Users see own tasks" ON user_tasks
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create tasks for themselves
CREATE POLICY "Users create own tasks" ON user_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tasks
CREATE POLICY "Users update own tasks" ON user_tasks
  FOR UPDATE USING (auth.uid() = user_id);
```

### Task Generation from Meetings
When a transcript is analyzed, the AI will extract action items and create entries in `user_tasks` assigned to the meeting host (the user who initiated the recording).
