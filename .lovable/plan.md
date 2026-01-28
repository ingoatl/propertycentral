
# Enhanced Task Management System: Monday.com-Style Implementation

## Overview
This plan transforms the existing task management into a comprehensive, intelligent system inspired by Monday.com and Linear. It addresses three core areas:
1. **My Tasks Section** - Enhanced with date grouping and smart categorization
2. **Overdue Onboarding Tasks Integration** - Broken down by day for less overwhelm
3. **Meeting Transcript Import** - To capture and generate tasks from meetings
4. **AI Intelligence Layer** - Smart prioritization and suggestions

---

## Part 1: Enhanced My Tasks Panel (Monday.com-Style)

### Current State
- Basic `UserTasksPanel` exists with urgent/today/upcoming groupings
- 8 tasks from Eric Ha meeting already imported
- Simple list view with checkboxes

### Monday.com-Inspired Improvements

**Visual Design Changes:**
```text
+----------------------------------------------------------+
|  📋 My Tasks                        [+ Add] [📊 Board View] |
+----------------------------------------------------------+
|  📌 PINNED (2)                                            |
|  ┌────────────────────────────────────────────────────┐  |
|  │ 🔴 Change Wi-Fi to "Grady the best"   Today • Eric │  |
|  │ 🟠 Send co-hosting amendment          Today • Eric │  |
|  └────────────────────────────────────────────────────┘  |
|                                                           |
|  📅 TODAY - Jan 28 (4 tasks)                             |
|  ┌────────────────────────────────────────────────────┐  |
|  │ ○ Remove recurring call from Google Calendar       │  |
|  │ ○ Assign Airbnb photos to rooms                   │  |
|  └────────────────────────────────────────────────────┘  |
|                                                           |
|  📅 TOMORROW - Jan 29 (0 tasks)                          |
|                                                           |
|  📅 THU, JAN 30 (1 task)                                 |
|  ┌────────────────────────────────────────────────────┐  |
|  │ ○ Implement maid cabinet security solution         │  |
|  └────────────────────────────────────────────────────┘  |
|                                                           |
|  📅 NEXT WEEK (3 tasks)                                  |
|  └── Click to expand...                                  |
|                                                           |
|  ⚠️ FROM ONBOARDING - 93 overdue tasks                   |
|  └── View by property →                                  |
+----------------------------------------------------------+
```

**Key Features:**
1. **Date-based grouping**: Today, Tomorrow, This Week, Next Week, Later
2. **Smart pinning**: Urgent tasks auto-pinned to top
3. **Source attribution badges**: Meeting, Call, Email, Onboarding
4. **Inline task editing**: Click to edit title, due date
5. **Drag-to-reschedule**: Move tasks between date groups
6. **Progress indicators**: Per-day completion rate

---

## Part 2: Overdue Onboarding Tasks Integration

### Current Analysis
- 93+ overdue onboarding tasks found (from October 2025)
- Most have NO `assigned_to_uuid` set
- Existing `OverdueTasksCard` shows them grouped by property
- Tasks span multiple properties: Canadian Way, Woodland Lane, Muirfield, Timberlake, etc.

### Day-by-Day Breakdown Strategy

Instead of showing all 93 tasks at once, split into manageable chunks:

**New Component: `OverdueOnboardingSection`**
```text
+----------------------------------------------------------+
|  ⚠️ Overdue Onboarding Tasks                              |
|     93 tasks need attention across 8 properties           |
+----------------------------------------------------------+
|                                                           |
|  🎯 FOCUS TODAY: 10 quick wins                           |
|  AI has selected tasks you can complete in under 2 hours |
|                                                           |
|  ┌────────────────────────────────────────────────────┐  |
|  │ ○ WiFi Details - Muirfield           [5 min]      │  |
|  │ ○ Smart lock master PIN - Timberlake [5 min]      │  |
|  │ ○ Owner Phone - Woodland Lane        [5 min]      │  |
|  │ ○ Gate code - Muirfield              [2 min]      │  |
|  │ ... +6 more quick wins                            │  |
|  └────────────────────────────────────────────────────┘  |
|                                                           |
|  📊 BY PROPERTY                                          |
|  ├── Canadian Way (12 tasks) ▼                           |
|  ├── Woodland Lane (15 tasks)                            |
|  ├── Muirfield (18 tasks)                                |
|  └── Villa Ct SE (8 tasks)                               |
|                                                           |
|  📅 BY URGENCY                                           |
|  ├── Critical (Owner info missing) - 8 tasks             |
|  ├── High (Insurance/Legal) - 12 tasks                   |
|  └── Standard (Setup items) - 73 tasks                   |
+----------------------------------------------------------+
```

**Intelligence Layer:**
1. AI identifies "quick wins" (text/checkbox fields that can be filled in < 5 min)
2. Prioritizes tasks that unblock other workflows
3. Groups related tasks (e.g., all WiFi tasks across properties)
4. Estimates completion time per task

---

## Part 3: Meeting Transcript Import

### Implementation: Manual Transcript Import

Since the Eric Ha meeting has already ended, we need a way to manually import transcripts.

**New Component: `ImportTranscriptDialog`**
```text
+----------------------------------------------------------+
|  📝 Import Meeting Transcript                             |
+----------------------------------------------------------+
|                                                           |
|  Meeting Title: [Eric Ha - Property Setup Discussion   ]  |
|                                                           |
|  Participants:                                            |
|  [x] Eric Ha (Owner)  [ ] Lead  [ ] Other                |
|                                                           |
|  Property: [Eric Ha - Grady ▼]                           |
|                                                           |
|  Transcript:                                              |
|  ┌────────────────────────────────────────────────────┐  |
|  │ [Paste your meeting transcript here...]            │  |
|  │                                                     │  |
|  │ The conversation covered direct bookings,          │  |
|  │ listing photos, marketing outreach...              │  |
|  └────────────────────────────────────────────────────┘  |
|                                                           |
|  [ ] Auto-extract action items using AI                  |
|                                                           |
|  [Cancel]                          [Import & Analyze →]  |
+----------------------------------------------------------+
```

**Edge Function: `import-meeting-transcript`**
- Accepts transcript text + metadata
- Creates `meeting_recordings` entry
- Calls existing `analyze-call-transcript` for AI task extraction
- Creates tasks in `user_tasks` table

---

## Part 4: AI Intelligence Layer

### Smart Task Suggestions

**Integration with Ninja Plan:**
The existing `generate-ninja-plan` function will be enhanced to:

1. **Cross-reference data sources:**
   - User's personal tasks (`user_tasks`)
   - Assigned onboarding tasks (`onboarding_tasks`)
   - Pending confirmations (`pending_task_confirmations`)
   - Upcoming calls/meetings (`discovery_calls`)

2. **Generate daily focus list:**
   - "You have 4 tasks due today from your Eric Ha meeting"
   - "12 onboarding tasks are blocking property go-live"
   - "Insurance document missing for Canadian Way - critical"

3. **Auto-create follow-up tasks:**
   - When a meeting is recorded, AI suggests tasks
   - User confirms/edits before adding to task list

### Database Enhancement: Task Categories

Add `category` column to `user_tasks`:
- `meeting_followup` - From meetings/calls
- `onboarding` - From property onboarding
- `maintenance` - Property maintenance items
- `communication` - Follow-up calls/emails
- `administrative` - Internal admin tasks

---

## Technical Implementation

### New Files to Create

| File | Purpose |
|------|---------|
| `src/components/dashboard/EnhancedUserTasksPanel.tsx` | Monday.com-style task panel |
| `src/components/dashboard/OverdueOnboardingSection.tsx` | Day-by-day overdue breakdown |
| `src/components/dashboard/ImportTranscriptDialog.tsx` | Manual transcript import UI |
| `src/hooks/useOverdueOnboardingTasks.ts` | Fetch and categorize overdue tasks |
| `supabase/functions/import-meeting-transcript/index.ts` | Process manual transcripts |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/UserTasksPanel.tsx` | Replace with enhanced version |
| `src/hooks/useUserTasks.ts` | Add date grouping, category support |
| `src/pages/Dashboard.tsx` | Integrate new components |
| `supabase/functions/generate-ninja-plan/index.ts` | Include user_tasks data |

### Database Migration

```sql
-- Add category and pinned fields to user_tasks
ALTER TABLE user_tasks 
ADD COLUMN category TEXT DEFAULT 'general',
ADD COLUMN is_pinned BOOLEAN DEFAULT false,
ADD COLUMN estimated_minutes INTEGER;

-- Create index for efficient date-based queries
CREATE INDEX idx_user_tasks_due_date ON user_tasks(user_id, due_date, status);
```

---

## Implementation Phases

### Phase 1: Enhanced Task Panel (Immediate)
- Date-based grouping (Today/Tomorrow/This Week/Next Week)
- Visual redesign with Monday.com aesthetics
- Source badges and priority indicators
- Inline quick actions

### Phase 2: Overdue Onboarding Integration
- Create `OverdueOnboardingSection` component
- AI-powered "Focus Today" suggestions
- Property and urgency-based grouping
- Link to onboarding workflow for completion

### Phase 3: Transcript Import
- Build `ImportTranscriptDialog` component
- Create `import-meeting-transcript` Edge Function
- Connect to existing AI analysis pipeline
- Auto-generate tasks from transcripts

### Phase 4: AI Intelligence
- Enhance `generate-ninja-plan` to include all task sources
- Add smart task suggestions based on patterns
- Implement follow-up task auto-generation
- Cross-property task grouping (e.g., "All WiFi setup tasks")

---

## User Experience Flow

1. **Morning Dashboard Load:**
   - See "Today's Focus" with AI-selected priorities
   - View personal tasks grouped by day
   - See "Quick Wins" from overdue onboarding

2. **After a Meeting:**
   - Click "Import Transcript" 
   - Paste meeting notes or transcript
   - AI extracts action items
   - Review and approve tasks

3. **Task Completion:**
   - Check off tasks inline
   - System updates progress
   - Related onboarding tasks auto-complete if applicable

4. **Weekly Review:**
   - See completion rate by category
   - Review rescheduled items
   - Plan upcoming week's focus
