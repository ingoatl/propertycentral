
# Add Property "On Hold" Status and Table List View

## Overview

This plan implements two key features:
1. **Property Hold Status** - Allow placing properties on hold, pausing all syncs and onboarding tasks
2. **Property Table View** - Add an aesthetic table list similar to the leads table view

---

## Part 1: Database Changes

### 1.1 Add "On-Hold" to property_type enum

```sql
ALTER TYPE property_type ADD VALUE 'On-Hold' BEFORE 'Inactive';
```

### 1.2 Add hold tracking columns

```sql
ALTER TABLE properties ADD COLUMN IF NOT EXISTS on_hold_at timestamp with time zone;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS on_hold_reason text;
```

### 1.3 Update sync trigger to exclude On-Hold properties

Modify `trigger_comms_hub_sync()` function to skip properties with `property_type = 'On-Hold'`:

```sql
-- Only sync active properties (not on hold, not offboarded)
IF NEW.property_type IN ('Client-Managed', 'Company-Owned') 
   AND NEW.offboarded_at IS NULL 
THEN ...
```

The "On-Hold" type will automatically be excluded since it's not in the allowed list.

---

## Part 2: TypeScript Types

### Update src/types/index.ts

```typescript
export interface Property {
  id: string;
  // ... existing fields
  propertyType?: "Client-Managed" | "Company-Owned" | "Inactive" | "On-Hold" | "Partner";
  onHoldAt?: string;
  onHoldReason?: string;
}
```

---

## Part 3: Properties Table View Component

### Create src/components/properties/PropertyTableView.tsx

A new table view component matching the aesthetic of `LeadTableView.tsx`:

**Columns:**
| Column | Description |
|--------|-------------|
| Property | Name + image thumbnail + address |
| Type | Badge showing Client-Managed/Company-Owned/On-Hold |
| Rental Type | Hybrid/Mid-term/Long-term badge |
| Owner | Owner name (if linked) |
| Progress | Onboarding progress bar |
| Visit Price | Formatted currency |
| Actions | Quick action buttons |

**Features:**
- Click row to open Property Details modal
- Hover reveals action buttons (Edit, Details, Offboard)
- Status badges with appropriate colors
- Sortable columns
- Search highlighting

---

## Part 4: Hold/Reactivate Dialog

### Create src/components/properties/HoldPropertyDialog.tsx

Similar to `OffboardPropertyDialog.tsx` but for placing properties on hold:

**Fields:**
- Reason for hold (dropdown): "Awaiting owner response", "Contract negotiation", "Seasonal pause", "Pending repairs", "Other"
- Additional notes (optional textarea)

**Behavior:**
- Sets `property_type` to 'On-Hold'
- Records `on_hold_at` timestamp
- Stores `on_hold_reason`

### Reactivate Logic

When reactivating, the system will:
- Restore previous `property_type` (Client-Managed or Company-Owned)
- Clear `on_hold_at` and `on_hold_reason`
- Re-trigger sync to Communications Hub

---

## Part 5: Properties Page Updates

### Modify src/pages/Properties.tsx

#### 5.1 Add View Toggle

```tsx
const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

// In header:
<div className="flex gap-1 bg-muted rounded-lg p-1">
  <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="sm">
    <LayoutGrid className="h-4 w-4" />
  </Button>
  <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm">
    <List className="h-4 w-4" />
  </Button>
</div>
```

#### 5.2 Add "On-Hold" to Filter Dropdown

```tsx
<SelectItem value="On-Hold">On Hold</SelectItem>
```

#### 5.3 Update Property Type Filter

```typescript
const onHoldProperties = filteredProperties.filter(p => p.propertyType === "On-Hold");
```

#### 5.4 Display Order

Properties will display in this order:
1. **Under Management** (Client-Managed)
2. **PeachHaus Portfolio** (Company-Owned)
3. **On Hold** (new section - amber/yellow styling)
4. **Partner Inventory** (MidTermNation)
5. **Offboarded Properties** (at bottom)

#### 5.5 On-Hold Section Styling

```tsx
{onHoldProperties.length > 0 && (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-amber-300/40">
      <PauseCircle className="w-5 h-5 text-amber-500" />
      <h2 className="text-xl font-semibold text-amber-600 dark:text-amber-400">
        ON HOLD
      </h2>
      <span className="text-sm text-muted-foreground">({onHoldProperties.length})</span>
    </div>
    {/* Property cards with amber tint */}
  </div>
)}
```

#### 5.6 Add Hold Button to Property Cards

In the hover overlay, add a "Hold" button (amber color) for active properties:

```tsx
{property.propertyType !== "Inactive" && property.propertyType !== "On-Hold" && (
  <Button
    size="sm"
    className="shadow-lg bg-amber-500 hover:bg-amber-600"
    onClick={() => setHoldingProperty(property)}
  >
    <PauseCircle className="w-4 h-4 mr-1" />
    Hold
  </Button>
)}
```

---

## Part 6: Card Display for On-Hold Properties

### Visual Distinctions

- Slight amber tint overlay on image
- "On Hold" badge in amber color
- Shows hold reason and date
- "Reactivate" button instead of "Hold"

```tsx
{property.propertyType === "On-Hold" && (
  <div className="absolute inset-0 bg-amber-500/10" />
)}
```

---

## Part 7: Sync Protection

### Edge Functions to Update

The following edge functions check for active properties:

1. **sync-properties-to-comms-hub** - Already respects property_type
2. **process-comms-hub-sync** - Uses the sync queue trigger

No changes needed since the DB trigger already filters by property_type.

### Onboarding Tasks Protection

When a property goes on hold, onboarding tasks for that property will remain but:
- The Ninja AI plan generator will skip tasks for on-hold properties
- Tasks won't trigger automation emails

This is handled by updating the NinjaFocusPanel query to filter:
```sql
.not('property.property_type', 'eq', 'On-Hold')
```

---

## File Summary

| File | Action |
|------|--------|
| Database migration | Add enum value + columns + update trigger |
| `src/types/index.ts` | Add On-Hold type + new fields |
| `src/components/properties/PropertyTableView.tsx` | **CREATE** - New table view |
| `src/components/properties/HoldPropertyDialog.tsx` | **CREATE** - Hold confirmation dialog |
| `src/pages/Properties.tsx` | Add view toggle, On-Hold section, hold button |
| `src/components/dashboard/NinjaFocusPanel.tsx` | Filter out on-hold properties |

---

## Visual Reference

### Table View Design

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Property          │ Type    │ Rental   │ Owner    │ Progress │ Actions      │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🏠 The Alpine     │ Managed │ Hybrid   │ J. Smith │ ████░ 78%│ Details Edit │
│    4241 Osburn Ct │         │          │          │          │              │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🏠 Neely Ave      │ On Hold │ Mid-term │ C. Greene│ ██░░░ 42%│ Reactivate   │
│    2008 Neely Ave │  ⏸️     │          │          │          │              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### On-Hold Section (Card View)

```text
═══════════════════════════════════════════════════════════════════
⏸️  ON HOLD (2)
───────────────────────────────────────────────────────────────────
┌─────────────┐  ┌─────────────┐
│ [Image]     │  │ [Image]     │
│  ⏸️ On Hold │  │  ⏸️ On Hold │
│ Neely Ave   │  │ Durham Ridge│
│ Since Jan 15│  │ Since Dec 20│
│ Reason: ... │  │ Reason: ... │
│[Reactivate] │  │[Reactivate] │
└─────────────┘  └─────────────┘
═══════════════════════════════════════════════════════════════════
```
