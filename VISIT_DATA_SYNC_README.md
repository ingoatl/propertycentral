# Visit Data Synchronization Feature

## Overview
A comprehensive data synchronization system that ensures visits from the Visits tab are accurately reflected in owner statement emails, with complete validation and reconciliation tracking.

## Key Features

### ✅ Data Validation
- **Date Format**: Ensures YYYY-MM-DD format
- **Amount Validation**: Numeric and positive values only
- **Required Fields**: Validates all mandatory fields (property, visitor, date, time)
- **Real-time Checks**: Validates data as it's entered

### ✅ Reconciliation Tracking
- **Status Badges**: Shows which visits are reconciled, verified, or pending
- **Sync Verification**: Checks data consistency between visits and owner statements
- **Visual Dashboard**: Color-coded status indicators for quick overview

### ✅ Error Handling
- **Clear Messages**: User-friendly error descriptions
- **Error Prevention**: Client-side validation before database submission
- **Auto-Detection**: Identifies orphaned or mismatched data
- **Fix Guidance**: Provides instructions on how to resolve issues

## How to Use

### 1. Logging a Visit

Navigate to the **Visits tab** and fill in the form:

1. **Select Property** (required)
2. **Choose Visit Date** (required, YYYY-MM-DD format)
3. **Select Visitor** (required)
4. **Enter Hours** (optional, for hourly charges)
5. **Add Notes** (optional)
6. Click **Log Visit**

The system will:
- Validate all data
- Create visit record
- Auto-generate expense records
- Display success confirmation

### 2. Viewing Reconciliation Status

On the Visits page:

1. Click **Show Reconciliation Status** button
2. View the dashboard showing:
   - Total visits
   - Valid visits (passed validation)
   - Reconciled visits (included in statements)
   - Visits needing sync

3. Review individual visit status:
   - ✅ **Verified**: Included in approved reconciliation
   - 🔵 **In Reconciliation**: Added but not yet approved
   - ⚪ **Not Reconciled**: Available to add to reconciliation

### 3. Creating Reconciliations

In the **Reconciliation tab**:

1. Create new reconciliation for property/month
2. System automatically detects unbilled visits
3. Check boxes for visits to include
4. **Validation Preview** shows any data issues
5. Review and approve
6. Generate owner statement email

### 4. Understanding Validation Errors

Common errors and fixes:

| Error | Cause | Fix |
|-------|-------|-----|
| "Date must be in YYYY-MM-DD format" | Invalid date format | Use calendar picker or type as YYYY-MM-DD |
| "Amount must be a positive number" | Zero or negative amount | Check property visit price is set |
| "Please select a property" | Missing property | Select property from dropdown |
| "Amount mismatch" | Visit price changed after reconciliation | Update visit or line item to match |

## Data Flow Diagram

```
User Input (Visits Tab)
    ↓
Client Validation (Zod Schema)
    ↓
Database (Visits Table)
    ↓
Auto-Create Expenses
    ↓
Reconciliation Selection
    ↓
Validation Check
    ↓
Create Line Items
    ↓
Owner Statement Email
```

## Technical Details

### Validation Rules

**Visit Data Structure:**
```typescript
{
  id: string (UUID),
  propertyId: string (UUID),
  date: string (YYYY-MM-DD),
  time: string (HH:MM),
  amount: number (positive),
  visitedBy: string (1-100 chars),
  description?: string (max 2000 chars),
  hours: number (0-24)
}
```

### Database Tables

**visits**
- Stores all visit records
- Links to properties table
- Tracks billing status

**expenses**
- Auto-created from visits
- Separates visit fee and hourly charges
- Category: "Visit Charges"

**reconciliation_line_items**
- Connects visits to reconciliations
- Tracks verification status
- Used for email generation

## Troubleshooting

### Q: My visit isn't showing in the reconciliation
**A**: Check that:
- Visit date is within reconciliation month
- Visit is not already billed (`billed = false`)
- Property matches the reconciliation

### Q: Validation errors won't go away
**A**: 
1. Click "Show Reconciliation Status"
2. Review specific errors
3. Edit visit data to fix issues
4. Refresh page to re-validate

### Q: Owner statement shows wrong amount
**A**: 
1. Check if visit price was updated after adding to reconciliation
2. Use sync check to find mismatches
3. Update line item or re-add visit

### Q: Visit shows as verified but not in email
**A**: 
- Check if line item is marked as `excluded = true`
- Verify reconciliation status is "approved"
- Check email generation logs

## Best Practices

1. ✅ **Use Calendar Picker**: Ensures correct date format
2. ✅ **Double-Check Property**: Verify correct property before saving
3. ✅ **Review Status Regularly**: Check reconciliation status weekly
4. ✅ **Fix Errors Promptly**: Address validation errors immediately
5. ✅ **Verify Before Sending**: Preview owner statement before emailing

## Components

- **`/src/pages/Visits.tsx`**: Main visits page with form and list
- **`/src/components/visits/VisitReconciliationStatus.tsx`**: Status dashboard
- **`/src/lib/visitDataValidation.ts`**: Validation logic
- **`/src/components/reconciliation/VisitValidationPreview.tsx`**: Preview in reconciliation modal

## Support

For detailed technical documentation, see: `DATA_SYNC_DOCUMENTATION.md`

For issues or questions:
1. Check validation errors in Reconciliation Status
2. Review troubleshooting section above
3. Check console logs for detailed error messages
4. Contact system administrator
