
# Direct Conversation Routing from Ninja Panel

## Overview

This plan implements intelligent routing that opens the specific conversation thread when clicking on a Ninja panel card, rather than just navigating to the communications inbox. It also confirms the Google Review SMS automation status.

## Google Review SMS Verification

### Status Summary
- **25 SMS sent** since January 25th with review-related content
- **All messages showing `status: sent`** with `delivery_status: queued` (normal - Twilio updates this asynchronously)
- **No failed deliveries detected** in the recent batch
- **New review requests created**: 5 new entries on Jan 26 (workflow_status: pending)
- **Follow-up cron active**: Running every 15 minutes, last execution at 18:15:03

### Recent Recipients
Nudge messages sent to: Stacey, debbie, Alison, Yvonne, Harry
Permission requests sent to: Jonathan H, John, Brenda, Vanesha, Simone, Amber

The automation is working correctly. The `queued` delivery status is expected - Twilio updates this to `delivered` or `failed` via the status callback webhook (`twilio-status-callback`).

## Technical Implementation

### Step 1: Add Query Parameter Support to Communications Page

Update `src/pages/Communications.tsx` to extract and pass query parameters:

```typescript
// Add useSearchParams hook
const [searchParams] = useSearchParams();
const targetPhone = searchParams.get('phone');
const targetLeadId = searchParams.get('leadId');
const targetOwnerId = searchParams.get('ownerId');
const targetContactName = searchParams.get('name');

// Pass to InboxView
<InboxView 
  initialTargetPhone={targetPhone}
  initialTargetLeadId={targetLeadId}
  initialTargetOwnerId={targetOwnerId}
  initialTargetName={targetContactName}
/>
```

### Step 2: Update InboxView to Accept Initial Target Props

Modify `src/components/communications/InboxView.tsx`:

```typescript
interface InboxViewProps {
  initialTargetPhone?: string | null;
  initialTargetLeadId?: string | null;
  initialTargetOwnerId?: string | null;
  initialTargetName?: string | null;
}

export function InboxView({ 
  initialTargetPhone,
  initialTargetLeadId,
  initialTargetOwnerId,
  initialTargetName
}: InboxViewProps) {
  // Add effect to auto-select conversation on mount
  useEffect(() => {
    if (!initialTargetPhone && !initialTargetLeadId && !initialTargetOwnerId) return;
    
    // Find matching conversation in communications list
    const findAndSelectConversation = () => {
      const normalizedTarget = initialTargetPhone ? normalizePhone(initialTargetPhone) : null;
      
      const match = allCommunications.find(comm => {
        // Match by lead ID
        if (initialTargetLeadId && comm.contact_type === 'lead' && comm.contact_id === initialTargetLeadId) {
          return true;
        }
        // Match by owner ID
        if (initialTargetOwnerId && comm.owner_id === initialTargetOwnerId) {
          return true;
        }
        // Match by phone number
        if (normalizedTarget && comm.contact_phone && normalizePhone(comm.contact_phone) === normalizedTarget) {
          return true;
        }
        return false;
      });
      
      if (match) {
        setSelectedMessage(match);
        setActiveFilter('all'); // Show all to ensure match is visible
        // Toast notification
        toast.success(`Opened conversation with ${match.contact_name}`);
      } else if (initialTargetName) {
        // If no match found, search by name
        setSearch(initialTargetName);
        toast.info(`Searching for ${initialTargetName}`);
      }
    };
    
    // Wait for communications to load
    if (allCommunications.length > 0) {
      findAndSelectConversation();
    }
  }, [initialTargetPhone, initialTargetLeadId, initialTargetOwnerId, initialTargetName, allCommunications]);
```

### Step 3: Update NinjaFocusPanel Navigation

Modify the `handleActionClick` function in `src/components/dashboard/NinjaFocusPanel.tsx`:

```typescript
// When navigating to communications, include contact identifiers as query params
if (item.source === 'email' || item.source === 'lead' || item.source === 'owner') {
  const params = new URLSearchParams();
  
  if (item.contactPhone) {
    params.set('phone', item.contactPhone);
  }
  if (item.contactId) {
    if (item.contactType === 'lead') {
      params.set('leadId', item.contactId);
    } else if (item.contactType === 'owner') {
      params.set('ownerId', item.contactId);
    }
  }
  if (item.contactName) {
    params.set('name', item.contactName);
  }
  
  const queryString = params.toString();
  navigate(`/communications${queryString ? `?${queryString}` : ''}`);
  return;
}
```

### Step 4: Handle External/Unknown Contacts

For contacts not in leads or owners tables, the system will:

1. First try to match by phone number across all communication sources
2. If no match, use the contact name to search
3. Display appropriate feedback to the user

```typescript
// Fallback for unmatched contacts
if (!match && initialTargetPhone) {
  // Create a temporary external contact view
  setSelectedMessage({
    id: 'external-' + normalizePhone(initialTargetPhone),
    type: 'sms',
    direction: 'outbound',
    body: '',
    created_at: new Date().toISOString(),
    contact_name: initialTargetName || 'Unknown Contact',
    contact_phone: initialTargetPhone,
    contact_type: 'external',
    contact_id: '',
  });
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Communications.tsx` | Add `useSearchParams`, pass props to InboxView |
| `src/components/communications/InboxView.tsx` | Add props interface, auto-select logic, fallback handling |
| `src/components/dashboard/NinjaFocusPanel.tsx` | Update navigation to include query params |

## User Experience Flow

1. User clicks Ninja card with contact info (e.g., "Follow up with Sonia Brar")
2. System navigates to `/communications?phone=4123390382&leadId=xxx&name=Sonia%20Brar`
3. InboxView loads, parses query params
4. Auto-selects matching conversation thread
5. Conversation detail panel opens showing full thread history
6. User can immediately reply via SMS/email/call

## Error Handling

- **No match found**: Falls back to search by name, shows info toast
- **Invalid phone format**: Normalizes phone before matching
- **Missing contact data**: Gracefully degrades to standard inbox view
- **Multiple matches**: Selects most recent conversation

## Intelligent Routing Logic

The routing considers contact type and available identifiers:

```text
Contact Type     Priority Order
------------     ---------------
Lead             leadId > phone > name
Owner            ownerId > phone > name  
Vendor           phone > name
Guest/External   phone > name
```
