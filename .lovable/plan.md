

# Fix Dialer Search: Correct PostgREST Query Syntax

## Problem Identified

The search fails because the `.or()` filter syntax uses `%` wildcards incorrectly. PostgREST inline filter syntax requires `*` (asterisk) for wildcards, not `%`.

**Current broken code:**
```typescript
.or(`name.ilike.${searchPattern}`) // searchPattern = "%query%"
```

**Working approach:**
```typescript
.or(`name.ilike.*${query}*`) // Use * instead of %
```

## Data Verification

| Owner | Table | Phone | SQL Works? |
|-------|-------|-------|------------|
| Dakun Sun | `partner_properties` | 2146755844 | Yes |
| Sonia Brar | `property_owners` | 412-339-0382 | Yes |
| Boatright Partners | `property_owners` | 404-697-7719 | Yes |

The database contains all records correctly. Only the JavaScript client query syntax is broken.

## Solution

Fix the query syntax in `DialerPropertySearch.tsx`:

### Change 1: Fix Property Owners Search (Line 123)
**Before:**
```typescript
.or(`name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`)
```
**After:**
```typescript
.or(`name.ilike.*${query}*,phone.ilike.*${query}*,email.ilike.*${query}*`)
```

### Change 2: Fix Partner Properties Search (Line 155)
**Before:**
```typescript
.or(`address.ilike.${searchPattern},contact_name.ilike.${searchPattern},...`)
```
**After:**
```typescript
.or(`address.ilike.*${query}*,contact_name.ilike.*${query}*,contact_phone.ilike.*${query}*,property_title.ilike.*${query}*,city.ilike.*${query}*`)
```

### Change 3: Also Search Owners by Address
Currently property owners are only searched by name/phone/email. Add address matching through their linked properties.

## Expected Results After Fix

**Searching "kennesaw":**
- Scandi Chic → dfg (owner)
- 6030 Sand Wedge → Sonia Brar
- Timberlake → Boatright Partners

**Searching "dakun" or "sun":**
- Charming Home in Alpharetta → Dakun Sun (from partner_properties)

**Searching "plantation" or "johns creek":**
- Charming Home in Alpharetta → Dakun Sun

## File Changes

| File | Changes |
|------|---------|
| `src/components/communications/DialerPropertySearch.tsx` | Replace `%` with `*` in all `.or()` filter patterns for `ilike` operators |

## Technical Note

The Supabase JS client `.ilike('column', '%value%')` method correctly URL-encodes the `%` character. However, when using the `.or()` string syntax, PostgREST expects `*` as the wildcard character in inline filters, which it then translates to `%` for the SQL query.

