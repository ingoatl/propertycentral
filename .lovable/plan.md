
# Fix Dialer Search: Add Partner Properties + Fix Query Syntax

## The Problem

**Three critical issues identified:**

1. **Missing Data Source**: The `partner_properties` table (containing MidTermNation imports like Dakun Sun) is NOT being searched at all
2. **Query Syntax Bug**: The Supabase JS client `.or()` filter with `%` wildcards requires proper URL encoding or different approach
3. **Kennesaw Properties**: Exist in database but search returns nothing - confirms query syntax is broken

## Data Verification

| Owner | Table | Phone | Address |
|-------|-------|-------|---------|
| Dakun Sun | `partner_properties` | 2146755844 | 10705 Plantation Bridge Dr, Johns Creek |
| Sonia Brar | `property_owners` | 412-339-0382 | 6030 Sand Wedge Circle, Kennesaw |
| Boatright Partners | `property_owners` | 404-697-7719 | 3384 Timber Lake Rd, Kennesaw |

## Solution

### 1. Fix Query Syntax (Critical)

The current code uses:
```typescript
.or(`address.ilike.${searchPattern}`) // Where searchPattern = %query%
```

**Problem**: The `%` character needs proper handling in Supabase PostgREST filters.

**Fix**: Use the correct filter syntax with proper escaping or use `.ilike()` method:
```typescript
.ilike('address', `%${query}%`)
// OR use textSearch approach
.or(`address.ilike.*${query}*`)
```

### 2. Add Partner Properties Search (New Query)

Add a 4th parallel search to query the `partner_properties` table:

```typescript
// Search 4: Partner properties (MidTermNation imports)
supabase
  .from("partner_properties")
  .select(`
    id, 
    property_title, 
    address, 
    city,
    contact_name, 
    contact_phone, 
    contact_email
  `)
  .or(`
    address.ilike.%${query}%,
    contact_name.ilike.%${query}%,
    contact_phone.ilike.%${query}%,
    property_title.ilike.%${query}%
  `)
  .limit(50)
```

### 3. Process Partner Properties Results

Map partner_properties to the same result format:

```typescript
(partnerData || []).forEach((p: any) => {
  if (p.contact_phone) {
    resultMap.set(`partner-${p.id}`, {
      propertyId: p.id,
      propertyName: p.property_title || "Partner Property",
      propertyAddress: p.address || "",
      ownerId: p.id,
      ownerName: p.contact_name || "Unknown",
      ownerPhone: p.contact_phone,
      ownerEmail: p.contact_email,
      source: "partner"
    });
  }
});
```

### 4. Add Partner Badge in UI

Show a visual indicator for partner/imported properties:

```typescript
{result.source === "partner" && (
  <Badge variant="secondary" className="text-xs bg-orange-100">
    Partner
  </Badge>
)}
```

---

## File Changes

| File | Change |
|------|--------|
| `src/components/communications/DialerPropertySearch.tsx` | Add partner_properties query, fix ilike syntax, add partner badge |

---

## Technical Details

### Correct Supabase Filter Syntax

The issue is that `%` in URL parameters can cause issues. Two valid approaches:

**Option A**: Use `.filter()` with explicit operator
```typescript
.filter('address', 'ilike', `%${query}%`)
```

**Option B**: Use `.textSearch()` for full-text (less flexible)

**Option C**: Multiple `.ilike()` chains (cleanest)
```typescript
.or(`address.ilike.%${query}%,name.ilike.%${query}%`)
// Make sure query is URL-safe
```

I'll use Option A with `.filter()` for reliability.

---

## Expected Results After Fix

Searching "kennesaw" will show:
- Scandi Chic → dfg (owner) 
- 6030 Sand Wedge → Sonia Brar
- Timberlake → Boatright Partners

Searching "dakun" or "sun" will show:
- Charming Home in Alpharetta → Dakun Sun (from partner_properties)

Searching "plantation" or "johns creek" will show:
- Charming Home in Alpharetta → Dakun Sun
