
# Fix Agreement → Property Creation Flow with Correct Service Type

## Problem Summary

Timberlake, Neely, and Hazy Way properties all show "cohosting" even though they signed "PROPERTY MANAGEMENT AGREEMENT" (full_service template). This is because:

1. **contract_type is not copied** from template to booking_documents when contract is sent
2. **submit-signature defaults to "cohosting"** when it can't find the contract_type
3. **Property is NOT created when agreement is signed** - it only gets created later when the owner fills the onboarding form
4. **Property address should come from the LEAD**, not from signature form fields - it's already part of the agreement when sent

---

## Current vs. Corrected Flow

```text
CURRENT (BROKEN):
Lead → Send Contract → booking_documents.contract_type = NULL → Owner Signs
→ Owner created with service_type = "cohosting" (wrong!)
→ NO property created yet
→ Onboarding form → Creates new property/owner (may duplicate)

CORRECTED:
Lead (has property_address) → Send Contract → booking_documents.contract_type = template.contract_type
→ Owner Signs → All parties sign
→ Owner created with service_type from TEMPLATE (correct!)
→ Property created from LEAD.property_address
→ Onboarding project created
→ Onboarding form → UPDATES existing property/project
```

---

## Implementation Steps

### Step 1: Fix create-document-for-signing

Store the template's `contract_type` when creating the booking_document, and also store the lead's property address for later use.

**Key Change:**
- Add `contract_type: template.contract_type` to the booking_documents insert
- Store `lead_id` and `lead_property_address` in booking_documents or field_configuration for later retrieval

### Step 2: Fix submit-signature to Get Service Type from Template

When all signers complete, look up the template's contract_type directly rather than relying on the booking_document's potentially NULL field.

**Key Change:**
```javascript
// Get service type from the TEMPLATE, not booking_document
const { data: template } = await supabase
  .from("document_templates")
  .select("contract_type")
  .eq("id", bookingDoc.template_id)
  .single();

let serviceType = "cohosting"; // default
if (template?.contract_type === "full_service") {
  serviceType = "full_service";
} else if (template?.contract_type === "co_hosting") {
  serviceType = "cohosting";
}
```

### Step 3: Create Property When Agreement is Fully Signed

When the document is completed (all parties signed), create:
1. Property record using `lead.property_address` (NOT from form fields)
2. Onboarding project linked to property
3. Link property to lead

**Key Change:**
```javascript
// After owner record is created, create property from LEAD data
if (lead && lead.property_address) {
  const { data: newProperty } = await supabase
    .from("properties")
    .insert({
      name: lead.property_address.split(',')[0],
      address: lead.property_address,
      property_type: 'Client-Managed',
      owner_id: ownerId,
    })
    .select()
    .single();
  
  if (newProperty) {
    // Link property to lead
    await supabase.from("leads").update({ property_id: newProperty.id }).eq("id", lead.id);
    
    // Create onboarding project
    await supabase.from("onboarding_projects").insert({
      property_id: newProperty.id,
      owner_name: finalOwnerName,
      property_address: lead.property_address,
      status: 'pending', // Waiting for onboarding form
    });
  }
}
```

### Step 4: Fix process-owner-onboarding to Update Existing Records

When the owner submits the onboarding form:
1. Find existing property by owner email or address
2. UPDATE existing property, owner, and project instead of creating duplicates

**Key Changes:**
- Before creating owner: Check if owner exists by email
- Before creating property: Check if property exists for this owner or with matching address
- Before creating project: Check if project exists for this property
- If found, UPDATE with new data; if not, CREATE

---

## Files to Modify

| File | Purpose |
|------|---------|
| `supabase/functions/create-document-for-signing/index.ts` | Store contract_type and lead_id on booking_documents |
| `supabase/functions/submit-signature/index.ts` | Get service_type from template; Create property from lead.property_address |
| `supabase/functions/process-owner-onboarding/index.ts` | Find and update existing property/owner instead of creating duplicates |
| `src/components/leads/SendContractButton.tsx` | Pass leadId to edge function (already done) |

---

## Data Verification: Current State

The query shows these properties signed "PROPERTY MANAGEMENT AGREEMENT" (template contract_type = `full_service`) but have `service_type = "cohosting"`:

| Property | Lead's Property Address | Signed Template | Expected Service Type | Current Service Type |
|----------|-------------------------|-----------------|----------------------|---------------------|
| Timberlake | 3384 Timber Lake Road Northwest, Kennesaw, GA | PROPERTY MANAGEMENT AGREEMENT | full_service | cohosting ❌ |
| Neely Ave | 2008 Neely Avenue, East Point, GA | PROPERTY MANAGEMENT AGREEMENT | full_service | cohosting ❌ |
| 1429 Hazy Way | 1429 Hazy Way SE, Atlanta, GA 30315 | PROPERTY MANAGEMENT AGREEMENT | full_service | cohosting ❌ |

**After fix**: New agreements will correctly set service_type from template.

**For existing properties**: Use the ServiceTypeToggle you requested to manually switch them to full_service.

---

## Technical Notes

### Why NOT from signature form fields?
The owner should NOT enter property address during signing. The address is already:
1. On the lead record (entered when lead was created)
2. Pre-filled in the agreement PDF (from template/lead)
3. Part of the document name (e.g., "PROPERTY MANAGEMENT AGREEMENT - Chloe Greene and Eldren Keys")

### What triggers property creation?
- **Current**: Onboarding form submission only
- **After fix**: Agreement fully signed (all parties complete) → property created immediately

### What does the onboarding form do after fix?
- Finds the existing property created at agreement signing
- Updates the property with additional details (WiFi, codes, utilities, etc.)
- Populates onboarding tasks with form values
