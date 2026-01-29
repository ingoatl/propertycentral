
# Fix Agreement → Property Creation Flow with Correct Service Type

## ✅ COMPLETED

All three fixes have been implemented to ensure the agreement signing flow correctly sets the service type and creates property records.

---

## Problem Summary (RESOLVED)

Timberlake, Neely, and Hazy Way properties showed "cohosting" even though they signed "PROPERTY MANAGEMENT AGREEMENT" (full_service template). This was because:

1. ✅ **FIXED**: `contract_type` is now copied from template to booking_documents when contract is sent
2. ✅ **FIXED**: `submit-signature` now gets service_type from the TEMPLATE, not relying on NULL booking_document fields
3. ✅ **FIXED**: Property IS now created when agreement is fully signed (not waiting for onboarding form)
4. ✅ **FIXED**: Property address comes from the LEAD record, not from signature form fields

---

## Corrected Flow

```text
Lead (has property_address) → Send Contract 
  → booking_documents.contract_type = template.contract_type ✅
  → field_configuration stores lead_id and lead_property_address ✅

Owner Signs → All parties sign
  → submit-signature fetches template.contract_type directly ✅
  → Owner created with service_type from TEMPLATE (correct!) ✅
  → Property created from LEAD.property_address ✅
  → Onboarding project created with status 'pending' ✅
  → Lead updated with property_id and owner_id ✅

Onboarding form submitted
  → process-owner-onboarding FINDS existing property/owner ✅
  → UPDATES existing records instead of creating duplicates ✅
  → Project status changed to 'in-progress' ✅
```

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/create-document-for-signing/index.ts` | Store `contract_type` from template, store `lead_id` and `lead_property_address` in field_configuration |
| `supabase/functions/submit-signature/index.ts` | Get service_type from TEMPLATE; Create property & onboarding project when agreement is fully signed |
| `supabase/functions/process-owner-onboarding/index.ts` | Find existing owner/property/project instead of creating duplicates; Update with new data |

---

## For Existing Properties

The fix only affects NEW agreements going forward. For existing properties (Timberlake, Neely, Hazy Way) that already have incorrect service_type:

**Use the ServiceTypeToggle** on the Property Owners page to manually switch them to `full_service`.

---

## Technical Notes

### Why Property Address from LEAD?
- Property address is entered when the lead is created
- It's pre-filled in the agreement PDF
- Owner should NOT re-enter it during signing
- Lead is linked to document via `signwell_document_id`

### Service Type Detection Priority
1. **Template.contract_type** (source of truth)
2. booking_document.contract_type (fallback)
3. field_values (legacy - removed)

### Property Creation Trigger
- **Before**: Onboarding form submission
- **After**: Agreement fully signed (all parties complete)
