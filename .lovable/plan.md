
# Dashboard Header Redesign: Role-Based Quick Actions

## Overview

This plan restructures the dashboard header to:
1. Remove unused/cluttered buttons (Test Team Digest, Overdue, Export, Sync Data)
2. Create a unified "Quick Links" dropdown for copyable presentation and calendar links
3. Implement role-based action buttons so each team member sees tools relevant to their role

---

## Current State Analysis

The dashboard header currently has 6 buttons visible on desktop:
- Owner Pitch (link to presentation)
- Designer Pitch (link to presentation)
- Test Team Digest (test email function)
- Overdue (send overdue emails)
- Export (CSV export)
- Sync Data (OwnerRez sync)

**Problems:**
- Too many buttons creating visual clutter
- Copy-only links (presentations, calendar) are hidden in communication modals
- No role differentiation - all users see the same buttons

---

## Proposed Solution

### 1. Buttons to Remove
| Button | Reason |
|--------|--------|
| Test Team Digest | Development/testing tool |
| Overdue | Rarely used, move to admin tools |
| Export | Rarely used, move to admin tools |
| Sync Data | Auto-sync is already running |

### 2. New "Quick Links" Dropdown
A single dropdown button containing:
- **Presentations** (copy link only):
  - Owner Pitch
  - Designer Pitch
  - Owner Portal
- **Calendar Links** (copy link only):
  - Discovery Call Booking
  - Owner Call Booking

### 3. Role-Based Action Buttons

| Role | Quick Actions Shown |
|------|---------------------|
| **Leadership** (Ingo) | Quick Links dropdown only (clean view) |
| **Ops Manager / Cleaner Coordinator** (Alex) | Quick Links + "Open Vendors" button |
| **Bookkeeper** (Anja) | Quick Links + "Monthly Charges" button |
| **Marketing VA** (Catherine, Chris) | Quick Links + "Leads Pipeline" button |
| **Sales** | Quick Links + "Leads Pipeline" button |

---

## Implementation Details

### Files to Create

#### 1. `src/hooks/useUserTeamRole.ts`
A reusable hook to fetch the current user's team role(s):
- Query `user_team_roles` joined with `team_roles`
- Cache results with React Query
- Return `roleNames[]`, `primaryRole`, and helper booleans like `isOpsManager`, `isBookkeeper`, etc.

#### 2. `src/components/dashboard/DashboardQuickLinks.tsx`
A dropdown component for copy-only links:
- Similar to `InsertLinksDropdown` but without message insertion
- Only copies URL to clipboard on click
- Contains presentations and calendar booking links
- Compact single-button design with "Links" label

#### 3. `src/components/dashboard/RoleBasedQuickActions.tsx`
Orchestration component that:
- Uses `useUserTeamRole` hook to determine user's role
- Renders `DashboardQuickLinks` for all users
- Conditionally renders role-specific action buttons:
  - Ops Manager: "Open Vendors" (navigates to /vendors)
  - Bookkeeper: "Monthly Charges" (navigates to /monthly-charges)
  - Marketing VA: "Leads Pipeline" (navigates to /leads-pipeline)

### Files to Modify

#### `src/components/dashboard/AdminDashboard.tsx`
- Remove `SendTestTeamDigestButton` import and usage
- Remove the Overdue, Export, Sync Data buttons
- Remove the Owner Pitch / Designer Pitch link buttons
- Replace with `<RoleBasedQuickActions />`

---

## Component Design

### DashboardQuickLinks Dropdown Structure
```text
[Links ▼] button
├─ Presentations (section header)
│   ├─ Owner Pitch → Copy URL
│   ├─ Designer Pitch → Copy URL
│   └─ Owner Portal → Copy URL
├─ Calendar Links (section header)
│   ├─ Book Discovery Call → Copy URL
│   └─ Book Owner Call → Copy URL
```

### Role-Based Buttons Layout
```text
Header: "PeachHaus Dashboard"           [Links ▼] [Role-Specific Button]

Alex (Ops):     [Links ▼] [Open Vendors]
Anja (Bookkeeper): [Links ▼] [Monthly Charges]
Catherine (Marketing): [Links ▼] [Leads Pipeline]
Ingo (Leadership): [Links ▼] (clean, no extra button)
```

---

## Technical Approach

### useUserTeamRole Hook Logic
```typescript
// Pseudocode
1. Get current user from supabase.auth.getUser()
2. Query user_team_roles joined with team_roles
3. Extract role names array
4. Determine primary role using priority order:
   Leadership > Bookkeeper > Ops Manager > Marketing VA > Sales
5. Return { roleNames, primaryRole, isOpsManager, isBookkeeper, isMarketingVA, isLeadership }
```

### Role Detection for Quick Actions
```typescript
// Pseudocode for RoleBasedQuickActions
const { primaryRole, isOpsManager, isBookkeeper, isMarketingVA } = useUserTeamRole();

return (
  <div className="flex items-center gap-2">
    <DashboardQuickLinks />
    
    {isOpsManager && (
      <Link to="/vendors">
        <Button>Open Vendors</Button>
      </Link>
    )}
    
    {isBookkeeper && (
      <Link to="/monthly-charges">
        <Button>Monthly Charges</Button>
      </Link>
    )}
    
    {isMarketingVA && (
      <Link to="/leads-pipeline">
        <Button>Leads Pipeline</Button>
      </Link>
    )}
  </div>
);
```

---

## URL References

| Link Type | URL |
|-----------|-----|
| Owner Pitch | `https://propertycentral.lovable.app/p/onboarding` |
| Designer Pitch | `https://propertycentral.lovable.app/p/designer` |
| Owner Portal | `https://propertycentral.lovable.app/p/owner-portal` |
| Discovery Call | `https://propertycentral.lovable.app/book-discovery-call` |
| Owner Call | `https://propertycentral.lovable.app/book-owner-call` |

---

## Summary of Changes

| Action | Component/File |
|--------|----------------|
| Create | `src/hooks/useUserTeamRole.ts` |
| Create | `src/components/dashboard/DashboardQuickLinks.tsx` |
| Create | `src/components/dashboard/RoleBasedQuickActions.tsx` |
| Modify | `src/components/dashboard/AdminDashboard.tsx` |
| Cleanup | Remove `SendTestTeamDigestButton` import |

---

## Expected Outcome

After implementation:
- Dashboard header will be cleaner with fewer buttons
- All team members can quickly copy presentation/calendar links from one dropdown
- Each team member sees a role-appropriate action button for their primary workflow
- The header uses space more efficiently and guides users to their key tools
