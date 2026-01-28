

# Dialer Layout Revert & Scroll Fix Plan

## Problem Analysis
Based on the screenshot you provided, you want the dialer to show contacts in a layout where:
1. Each contact has an avatar, name, and phone number stacked vertically
2. Wide "Call" button spanning most of the card width
3. A secondary action button (Text) to the right
4. **All results must be scrollable within the modal**

The current implementation has a different compact layout with Call/Text/Voice buttons in a horizontal row that may be causing overflow issues.

## Solution

### 1. Restore the Old Contact Card Layout
Modify `QuickCommunicationButton.tsx` to use the layout shown in your screenshot:
- Contact info section: Avatar + Name + Phone stacked
- Action buttons: Wide "Call" button + narrower "Text" button side by side
- Simplified design matching the peach/cream color scheme

### 2. Fix Scroll Behavior
- Ensure `ScrollArea` has a fixed height (e.g., `h-[50vh]`) instead of `max-h-[45vh]`
- Add `overflow-auto` to ensure scrolling works correctly
- Set `PopoverContent` to contain the scroll properly

### 3. Browser Verification
After implementation, I will open a browser session to:
- Navigate to the dashboard
- Open the dialer
- Search for "atlanta"
- Verify all contacts scroll correctly within the modal
- Confirm no overflow or clipping issues

---

## Technical Implementation Details

### File: `src/components/communications/QuickCommunicationButton.tsx`

**Changes to PopoverContent (line 346):**
```typescript
<PopoverContent className="w-80 p-0" align="end">
```

**Changes to ScrollArea (line 370):**
```typescript
<ScrollArea className="h-[50vh]">
```

**Changes to Contact Card Layout (lines 381-441):**
```typescript
{contacts.map((contact) => (
  <div
    key={`${contact.type}-${contact.id}`}
    className="p-3 rounded-lg border border-border/30 hover:bg-muted/20"
  >
    {/* Contact Info */}
    <div className="flex items-start gap-3 mb-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-primary">
          {contact.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{contact.name}</p>
        {contact.phone && (
          <p className="text-xs text-muted-foreground">
            {formatPhoneForDisplay(contact.phone)}
          </p>
        )}
      </div>
    </div>
    
    {/* Action Buttons - Old Layout Style */}
    {contact.phone && (
      <div className="flex gap-2">
        <button
          className="flex-[3] h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center gap-2"
          onClick={(e) => { e.stopPropagation(); handleCall(contact); }}
        >
          <Phone className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Call</span>
        </button>
        <button
          className="flex-1 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); handleText(contact); }}
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    )}
  </div>
))}
```

### Verification Steps
1. Open browser to the preview
2. Click the "Dial / Text" button
3. Type "atlanta" in the search field
4. Verify:
   - All contacts display in the old layout format
   - Scroll works within the modal
   - No overflow or clipping issues
   - Can scroll to see all Atlanta-related contacts

