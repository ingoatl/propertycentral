
# Revamped Task Management + Enhanced Dialer Search

## Overview

This plan addresses three critical issues:
1. Task section is confusing - transcript tasks buried among AI suggestions
2. Dialer search cannot find owners by name
3. No intelligent prioritization to keep you focused

---

## Part 1: Intelligent Task Structure

### Current Problem
The `MondayStyleTasksPanel` mixes 3 data sources with no clear hierarchy:
- Personal tasks (including transcript imports)
- AI-generated Ninja priorities
- Onboarding quick wins

This creates cognitive overload - you can't quickly see YOUR tasks.

### New Structure: Clear Hierarchy with Smart Sections

```text
+------------------------------------------------------------------+
|  YOUR TASKS                                    [+ Add] [Import]  |
+------------------------------------------------------------------+
|                                                                  |
|  CRITICAL - Needs Attention Now (2)                              |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ 🔴 Change Wi-Fi to "Grady the best"    📝 Meeting • Today │    |
|  │ 🟠 Send co-hosting amendment            📝 Meeting • Today │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  TODAY - Jan 28 (3)                                              |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ ○ Assign Airbnb photos to rooms         📝 Meeting        │    |
|  │ ○ Remove recurring calendar call        📝 Meeting        │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  THIS WEEK (2)                                                   |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ ○ Implement maid cabinet security       📝 Meeting • Thu  │    |
|  │ ○ Confirm AC tune-up pricing            📝 Meeting • Tue  │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  LATER (2)                                                       |
|  └── Collapsed - click to expand                                 |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  AI SUGGESTIONS - From your Ninja Plan                           |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │ 💡 Follow up with Michael Witter          [📧 Email]      │    |
|  │ 💡 Call Ellen Hines about documents       [📞 Call]       │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
+------------------------------------------------------------------+
```

### Key Changes

| Current | New |
|---------|-----|
| Everything mixed together | Clear "YOUR TASKS" section at top |
| Small source badges | Large, prominent source icons |
| AI suggestions inline with tasks | Separate "AI SUGGESTIONS" section below |
| No priority section | "CRITICAL" section always visible at top |
| Onboarding tasks mixed in | Onboarding shown separately only if urgent |

### Intelligence Features

1. **Smart Priority Escalation**
   - Tasks overdue by 1+ day auto-escalate to "Critical"
   - Urgent tasks from transcripts always pinned to top

2. **Source Recognition**
   - Large icons: 📝 Meeting, 📧 Email, 📞 Call, 🤖 AI
   - Color-coded backgrounds for quick scanning

3. **Focus Mode**
   - Option to hide AI suggestions
   - "Just My Tasks" toggle for distraction-free view

---

## Part 2: Enhanced Dialer Property/Owner Search

### Current Problem

The search query only looks at property fields:
```javascript
.or(`address.ilike.%${query}%,name.ilike.%${query}%`)
```

**Owner names are completely ignored.**

### New Search Logic

```text
Search: "sun"  (or "sonia", "brar", "sand wedge", "kennesaw")

Results:
+------------------------------------------------------------------+
|  🏠 6030 Sand Wedge Circle, Kennesaw, GA                         |
|     Owner: Sonia Brar                                            |
|     [📞 412-339-0382] [📧 snbpropertiesatlanta@gmail.com]        |
+------------------------------------------------------------------+
```

### Technical Implementation

```sql
-- New comprehensive search query
SELECT p.*, po.name as owner_name, po.phone, po.email
FROM properties p
LEFT JOIN property_owners po ON p.owner_id = po.id
WHERE 
  -- Property name/address search
  p.address ILIKE '%{query}%' 
  OR p.name ILIKE '%{query}%'
  -- Owner name search (NEW)
  OR po.name ILIKE '%{query}%'
  -- City extraction from address (NEW)
  OR p.address ILIKE '%{query}%'
```

### Search Enhancements

| Feature | Current | New |
|---------|---------|-----|
| Search property name | Yes | Yes |
| Search address | Yes | Yes |
| Search owner name | No | Yes |
| Search city | Partial | Full (extracted from address) |
| Search phone number | No | Yes |
| Fuzzy matching | No | Soundex for names |

---

## Part 3: Data Quality Check

### Missing "Dakun Sun" Owner

**CONFIRMED**: "Dakun Sun" does NOT exist in the `property_owners` table. The dialer search cannot find this owner because they haven't been added to the database.

**Action Required**: Add "Dakun Sun" as a property owner with their phone number and email, then link them to the appropriate property.

### Missing "Mid Term Nation" Properties

No properties exist for "Alpharetta Mid Term" in the database either.

---

## Files to Modify

| File | Changes |
|------|---------|
| `MondayStyleTasksPanel.tsx` | Complete restructure with clear hierarchy |
| `DialerPropertySearch.tsx` | Add owner name, phone, and city search |
| `useUserTasks.ts` | Add priority escalation logic |

## Database Queries

No schema changes needed - only query improvements.

---

## Implementation Summary

1. **Task Panel Restructure**
   - Separate "YOUR TASKS" from "AI SUGGESTIONS"
   - Prominent source badges (Meeting, Call, Email, Manual)
   - Critical section always visible at top
   - Focus mode toggle

2. **Dialer Search Enhancement**
   - Search owner names (fixes "sun" -> "sonia brar")
   - Search city names from addresses
   - Search phone numbers
   - Better no-results messaging

3. **Quality of Life**
   - Import transcript button in header
   - Quick-add task from any view
   - Clear visual feedback for task completion
