
# Fix Mobile Owner Portal Navigation

## Problem Analysis

The owner portal opens on desktop but only shows a toast message on mobile without actually navigating. After investigating:

1. **Code flow issue**: After `window.location.href = portalUrl`, the code continues executing (`toast.success()` and `setOpeningPortal(null)`)
2. **User sees toast**: This means the redirect is NOT happening - if it worked, the page would navigate away before the toast displays
3. **Mobile browser behavior**: In-app browsers (like the Lovable preview iframe) may handle `window.location.href` differently
4. **The `finally` block**: Calls `setOpeningPortal(null)` which triggers a re-render, potentially interrupting the navigation

## Solution

### Strategy 1: Use `window.location.assign()` and return early for mobile

For mobile devices, we need to:
- NOT show a toast (if navigation works, it won't be seen)
- Use `window.location.assign()` which is more reliable
- Return immediately after setting location (don't run finally block code)
- Add a fallback timeout that uses an anchor click simulation

### Strategy 2: Create a programmatic anchor click (most reliable)

The most reliable cross-browser solution is to simulate clicking an anchor tag:

```typescript
// Create a temporary anchor element and click it
const link = document.createElement('a');
link.href = portalUrl;
link.target = '_self';  // Open in same window
link.rel = 'noopener';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
```

This approach works reliably across all mobile browsers including in-app browsers.

## Implementation

### File 1: src/pages/PropertyOwners.tsx

Update `handleOpenPortal` function:

```typescript
const handleOpenPortal = async (owner: PropertyOwner) => {
  // ... token creation code stays the same ...
  
  const portalUrl = `/owner?token=${token}`;
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobileDevice) {
    // For mobile: use anchor click simulation (most reliable method)
    // Don't show toast - page will navigate away
    setOpeningPortal(null);  // Clear loading state before navigation
    
    const link = document.createElement('a');
    link.href = portalUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;  // Exit immediately
  } else {
    // Desktop: open in new tab
    window.open(portalUrl, "_blank");
    toast.success(`Opening portal for ${property.name}`);
  }
};
```

### File 2: src/components/admin/OwnerPortalAdmin.tsx

Apply the same fix to both `openPortalAsOwner` and `openDemoPortal` functions:

```typescript
const openPortalAsOwner = async (owner: OwnerWithProperties, property: OwnerProperty) => {
  // ... token creation code stays the same ...
  
  const portalUrl = `/owner?token=${token}`;
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobileDevice) {
    // For mobile: use anchor click simulation
    const link = document.createElement('a');
    link.href = portalUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;  // Exit immediately, no toast
  } else {
    window.open(portalUrl, "_blank");
    toast.success(`Opening portal for ${property.name}`);
  }
};

const openDemoPortal = () => {
  const portalUrl = '/owner?token=demo-portal-token-3069-rita-way';
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobileDevice) {
    const link = document.createElement('a');
    link.href = portalUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  } else {
    window.open(portalUrl, '_blank');
    toast.success('Opening Sara Thompson demo portal');
  }
};
```

## Why This Works

1. **Anchor click simulation** is the most reliable method for programmatic navigation across all browsers
2. **No code runs after the click** - we return immediately
3. **No toast on mobile** - if the navigation works, a toast would never be seen anyway
4. **Loading state cleared before navigation** - prevents any React re-render interference

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/PropertyOwners.tsx` | Update `handleOpenPortal` with anchor click method |
| `src/components/admin/OwnerPortalAdmin.tsx` | Update `openPortalAsOwner` and `openDemoPortal` |
