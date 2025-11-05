# Data Synchronization: Visits Tab ↔ Owner Statement Email

## Overview
This document describes the data synchronization feature between the **Visits Tab** and **Owner Statement Email** in the property management system. The feature ensures data consistency, validates data structure, and provides reconciliation tracking.

## Architecture

### Data Flow
```
Visits Tab (User Input)
    ↓
Validation Layer (visitDataValidation.ts)
    ↓
Visits Table (Database)
    ↓
Expenses Table (Auto-created)
    ↓
Reconciliation Line Items (When reconciling)
    ↓
Owner Statement Email (Generated from line items)
```

## Components

### 1. Data Validation (`src/lib/visitDataValidation.ts`)

#### Purpose
Validates visit data structure and ensures compatibility with reconciliation system.

#### Validation Rules

**Required Fields:**
- `id`: UUID format
- `propertyId`: UUID format
- `date`: YYYY-MM-DD format
- `time`: HH:MM format (24-hour)
- `amount`: Positive numeric value
- `visitedBy`: String (1-100 characters)

**Optional Fields:**
- `description`: String (max 2000 characters)
- `hours`: Number (0-24)

#### Functions

**`validateVisitForReconciliation(visit)`**
- Validates a single visit
- Returns: `{ isValid: boolean, errors: string[], data?: ValidatedVisitData }`

**`validateVisitsBatch(visits[])`**
- Validates multiple visits at once
- Returns: `{ valid: ValidatedVisitData[], invalid: Array<{ visit, errors }> }`

**`checkVisitReconciliationSync(visit, lineItem)`**
- Checks if visit data matches reconciliation line item
- Returns: `{ isSynced: boolean, mismatches: string[] }`

### 2. Reconciliation Status Component (`src/components/visits/VisitReconciliationStatus.tsx`)

#### Purpose
Displays validation status and reconciliation tracking for visits.

#### Features
- **Summary Statistics**: Total, Valid, Reconciled, and Needs Sync counts
- **Validation Alerts**: Shows visits with validation errors
- **Sync Issues**: Highlights data mismatches between visits and line items
- **Visit Details**: Lists recent visits with reconciliation status

#### Props
```typescript
interface VisitReconciliationStatusProps {
  visitId?: string;      // Show specific visit
  propertyId?: string;   // Filter by property
  showAll?: boolean;     // Show all visits or limit to 50
}
```

### 3. Enhanced Visits Page (`src/pages/Visits.tsx`)

#### New Features

**Form Validation:**
- Date format validation (YYYY-MM-DD)
- Amount validation (numeric, positive)
- Enhanced error messages

**Real-time Validation:**
- Validates existing visits on page load
- Shows validation errors in alert banner

**Reconciliation Status Toggle:**
- Button to show/hide reconciliation status
- Integrated VisitReconciliationStatus component

## Data Structure

### Visits Table Schema
```sql
TABLE visits (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  price NUMERIC NOT NULL,
  hours NUMERIC DEFAULT 1,
  visited_by TEXT,
  notes TEXT,
  user_id UUID,
  billed BOOLEAN DEFAULT false,
  reconciliation_id UUID,
  created_at TIMESTAMP
)
```

### Reconciliation Line Items Schema
```sql
TABLE reconciliation_line_items (
  id UUID PRIMARY KEY,
  reconciliation_id UUID NOT NULL,
  item_type TEXT NOT NULL,  -- 'visit' | 'expense' | 'booking'
  item_id UUID NOT NULL,     -- References visits.id
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  verified BOOLEAN DEFAULT false,
  excluded BOOLEAN DEFAULT false,
  category TEXT
)
```

## Validation Error Handling

### Client-Side Validation
1. **Form submission**: Validates before saving to database
2. **Page load**: Validates existing visits and displays errors
3. **Real-time**: Validates as user types (date/time/amount fields)

### Server-Side Validation
- Database constraints ensure data integrity
- RLS policies protect data access

### Error Display
- **Toast notifications**: Immediate feedback on form submission
- **Alert banner**: Shows validation errors for existing data
- **Status component**: Detailed validation report with errors

## Reconciliation Process

### Step 1: Visit Creation
```typescript
// User logs visit in Visits tab
const visit = {
  propertyId: "uuid",
  date: "2025-11-05",
  time: "14:30",
  price: 190.00,
  visitedBy: "Anja Schaer",
  hours: 2
};

// System creates:
// 1. Visit record in visits table
// 2. Expense records in expenses table
//    - Visit fee expense
//    - Hourly charges expense (if hours > 0)
```

### Step 2: Reconciliation Creation
```typescript
// Admin creates reconciliation for month
// System fetches:
// - All unbilled visits for property
// - All unbilled expenses for property

// User selects which visits to include
// System creates line items for checked visits
```

### Step 3: Validation & Sync Check
```typescript
// Before email generation:
validateVisitsBatch(visits);
// - Checks date format
// - Checks amount is numeric
// - Validates all required fields

checkVisitReconciliationSync(visit, lineItem);
// - Compares visit.date with lineItem.date
// - Compares visit.price with lineItem.amount
// - Verifies visit.id matches lineItem.item_id
```

### Step 4: Email Generation
```typescript
// Owner statement email uses:
// - reconciliation_line_items (verified & not excluded)
// - Calculates totals from line items
// - Includes only checked visits
```

## Usage Examples

### Example 1: Display Reconciliation Status
```tsx
import { VisitReconciliationStatus } from "@/components/visits/VisitReconciliationStatus";

function MyComponent() {
  return (
    <VisitReconciliationStatus 
      propertyId="property-uuid"
      showAll={false}
    />
  );
}
```

### Example 2: Validate Visit Before Saving
```typescript
import { validateVisitForReconciliation } from "@/lib/visitDataValidation";

const result = validateVisitForReconciliation(visitData);
if (!result.isValid) {
  console.error("Validation errors:", result.errors);
  return;
}
// Proceed with saving
```

### Example 3: Check Sync Status
```typescript
import { checkVisitReconciliationSync } from "@/lib/visitDataValidation";

const syncResult = checkVisitReconciliationSync(visit, lineItem);
if (!syncResult.isSynced) {
  console.warn("Sync issues:", syncResult.mismatches);
  // Display warning to user
}
```

## Technical Requirements

### Frontend
- **React 18.3+**: Component framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **shadcn/ui**: UI component library
- **Zod**: Schema validation
- **TanStack Query**: Data fetching

### Backend
- **Supabase**: Database and authentication
- **PostgreSQL**: Database
- **Edge Functions**: Email generation

## Error Scenarios & Resolution

### Scenario 1: Invalid Date Format
**Error**: "Date must be in YYYY-MM-DD format"
**Resolution**: 
- System automatically formats dates from calendar picker
- Manual entry validated on blur

### Scenario 2: Amount Mismatch
**Error**: "Amount mismatch: Visit ($190.00) vs Line Item ($180.00)"
**Resolution**:
- User updates visit price
- System recalculates line item amount
- Re-sync verification

### Scenario 3: Missing Visit in Reconciliation
**Error**: Visit exists but not in reconciliation
**Resolution**:
- Check visit.billed status
- Verify reconciliation_id is set
- Use "Add Missing Items" button in reconciliation modal

### Scenario 4: Orphaned Line Items
**Error**: Line item references deleted visit
**Resolution**:
- System automatically excludes orphaned items
- Marks with exclusion_reason: "Source expense was deleted"

## Best Practices

1. **Always validate before saving**: Use validation schema
2. **Check sync status regularly**: Run sync checks before email generation
3. **Handle errors gracefully**: Display user-friendly messages
4. **Audit trail**: Log all validation failures
5. **Real-time updates**: Use Supabase realtime for instant sync

## Testing

### Manual Testing Checklist
- [ ] Create visit with valid data
- [ ] Try to create visit with invalid date
- [ ] Try to create visit with negative amount
- [ ] Check reconciliation status shows correctly
- [ ] Verify visit appears in reconciliation
- [ ] Generate owner statement email
- [ ] Verify amounts match between visit and email

### Automated Tests
```typescript
// Test validation
describe("visitDataValidation", () => {
  it("should validate correct visit data", () => {
    const result = validateVisitForReconciliation(validVisit);
    expect(result.isValid).toBe(true);
  });

  it("should reject invalid date format", () => {
    const result = validateVisitForReconciliation({
      ...validVisit,
      date: "11/05/2025"
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Date must be in YYYY-MM-DD format");
  });
});
```

## Troubleshooting

### Issue: Validation errors won't clear
**Solution**: Check if validation errors state is being reset properly

### Issue: Reconciliation status not loading
**Solution**: Check RLS policies on visits and reconciliation_line_items tables

### Issue: Email shows wrong amounts
**Solution**: Verify line items are being calculated from checked items only

## Future Enhancements

1. **Bulk validation**: Validate all visits at once
2. **Auto-fix**: Automatically correct common formatting errors
3. **Export validation report**: Download CSV of validation results
4. **Webhook notifications**: Alert when sync issues detected
5. **Historical tracking**: Track validation changes over time
