
# Service Type Toggle: Cohosting ↔ Full-Service Management

## Overview

This plan adds a manual toggle button for switching between **Cohosting** and **Full-Service Management** for the four specified properties (Neely, Timberlake, 1427 Hazy Way, 1429 Hazy Way), along with a detailed explanation of how this affects reconciliation, emails, and fund flow.

---

## Current State Analysis

### Properties to Enable Toggle For
| Property | Address | Current Owner | Current Service Type |
|----------|---------|---------------|---------------------|
| Neely Ave | 2008 Neely Ave, East Point, GA 30344 | Chloe Greene and Eldren Keys | cohosting |
| Timberlake | 3384 Timber Lake Rd NW, Kennesaw, GA 30144 | Boatright Partners, LLC | cohosting |
| 1427 Hazy Way | 1427 Hazy Way SE, Atlanta, GA 30315 | Ellen K Hines | cohosting |
| 1429 Hazy Way | 1429 Hazy Way, Atlanta, GA | Sterling Hines | cohosting |

### Where Service Type is Stored
- `property_owners.service_type` column (NOT NULL, text field)
- Values: `'cohosting'` or `'full_service'`

---

## How Service Type Affects the System

### Financial Flow Differences

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        CO-HOSTING MODEL                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Revenue Flow:  OWNER collects rent/booking revenue directly            │
│  Monthly:       Owner PAYS PeachHaus for services rendered              │
│                                                                         │
│  Calculation:                                                           │
│  Due from Owner = Management Fee + Visit Fees + Expenses + Pass-through │
│                                                                         │
│  Stripe Action: CHARGE owner's card/ACH                                 │
│  Edge Function: charge-from-reconciliation                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     FULL-SERVICE MODEL                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Revenue Flow:  PEACHHAUS collects all rent/booking revenue             │
│  Monthly:       PeachHaus PAYS owner net amount after deductions        │
│                                                                         │
│  Calculation:                                                           │
│  Payout to Owner = Revenue - Mgmt Fee - Visit Fees - Expenses           │
│                                                                         │
│  Stripe Action: PAY owner via bank transfer                             │
│  Edge Function: process-owner-payout                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Email Statement Differences

| Element | Co-Hosting | Full-Service |
|---------|------------|--------------|
| **Header Label** | "BALANCE DUE FROM OWNER" | "NET OWNER EARNINGS" |
| **Net Calculation** | Expenses + Fees (owner pays) | Revenue - Expenses (we pay) |
| **Call to Action** | "Amount due: $X" | "Payout: $X" |
| **Payment Direction** | Owner → PeachHaus | PeachHaus → Owner |

### Reconciliation UI Differences

| Element | Co-Hosting | Full-Service |
|---------|------------|--------------|
| **Badge Color** | Blue (CreditCard icon) | Green (Banknote icon) |
| **Settlement Label** | "Due from Owner" | "Payout to Owner" |
| **Action Button** | "Charge Owner" | "Process Payout" |
| **Status After** | "charged" | "charged" (with payout_status) |

---

## Implementation Plan

### 1. Create Service Type Toggle Component

**New File: `src/components/owners/ServiceTypeToggle.tsx`**

A compact toggle switch component that:
- Shows current service type with appropriate icon/color
- Allows switching between cohosting ↔ full_service
- Confirms before changing (shows impact explanation)
- Updates `property_owners.service_type` in database
- Triggers refetch of owner data

### 2. Add Toggle to Property Owners Page

**File: `src/pages/PropertyOwners.tsx`**

Add the ServiceTypeToggle to each owner row/card, visible only for the four specified properties or all properties (admin choice).

### 3. Add Toggle to Reconciliation Review Modal

**File: `src/components/reconciliation/ReconciliationReviewModal.tsx`**

Add a small toggle in the header area so admins can switch service type directly when reviewing a reconciliation, before sending statements.

### 4. Update Reconciliation Card Display

**File: `src/components/reconciliation/ReconciliationList.tsx`**

Ensure the service type badge and settlement amount dynamically reflect the owner's current service_type setting.

---

## Technical Changes Summary

### New Component
| File | Purpose |
|------|---------|
| `src/components/owners/ServiceTypeToggle.tsx` | Reusable toggle with confirmation dialog |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/PropertyOwners.tsx` | Add ServiceTypeToggle to owner cards/rows |
| `src/components/reconciliation/ReconciliationReviewModal.tsx` | Add ServiceTypeToggle in header |
| `src/components/reconciliation/ReconciliationList.tsx` | Ensure dynamic badge/amount display |

---

## UI Design for Toggle

```text
┌────────────────────────────────────────────┐
│  Service Type                              │
│  ┌─────────────────────────────────────┐   │
│  │ [🏠 Co-Hosting]  ←──→  [💼 Full-Service] │
│  └─────────────────────────────────────┘   │
│                                            │
│  Current: Co-Hosting                       │
│  • Owner receives revenue directly         │
│  • Monthly: Owner pays PeachHaus           │
└────────────────────────────────────────────┘
```

### Confirmation Dialog (on switch)

```text
┌──────────────────────────────────────────────────┐
│  ⚠️  Switch to Full-Service Management?          │
├──────────────────────────────────────────────────┤
│  This will change how reconciliation works:      │
│                                                  │
│  ✓ PeachHaus will collect all revenue            │
│  ✓ Monthly payouts will go TO the owner          │
│  ✓ Existing draft reconciliations will update    │
│                                                  │
│  This affects future statements only.            │
│                                                  │
│  [Cancel]                    [Confirm Switch]    │
└──────────────────────────────────────────────────┘
```

---

## Data Flow After Toggle

1. Admin clicks toggle → confirmation dialog
2. On confirm → update `property_owners.service_type`
3. All related reconciliations automatically reflect new type via:
   - `ReconciliationList.tsx` reads `property_owners.service_type`
   - `calculateDueFromOwnerFromLineItems()` accepts serviceType param
   - Email templates check serviceType for labels/calculations
4. When sending statement:
   - Co-hosting: `charge-from-reconciliation` charges owner
   - Full-service: `process-owner-payout` pays owner

---

## No Database Migration Needed

The `property_owners.service_type` column already exists and is NOT NULL with appropriate values. This is purely a UI enhancement to allow manual switching.
