import { useRef, useState, useEffect, useCallback, memo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Mail, CheckCircle, Clock, Home, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { decodeHtmlEntities } from "@/lib/html-utils";
import { ConversationQuickActions } from "../ConversationQuickActions";
import { EmailCategoryBadge } from "../EmailCategoryBadge";
import { EmailClassificationBadge } from "./EmailClassificationBadge";
import { 
  type EmailClassification, 
  getClassificationColor,
  classifyEmail 
} from "@/hooks/useEmailClassification";

interface GmailEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  targetInbox?: string;
  date: string;
  body: string;
  bodyHtml?: string;
  snippet: string;
  labelIds: string[];
}

interface EmailInsight {
  gmail_message_id: string | null;
  category: string;
  sentiment: string | null;
  priority: string | null;
  action_required: boolean | null;
  property_id: string | null;
  owner_id: string | null;
}

interface VirtualizedEmailListProps {
  emails: GmailEmail[];
  emailInsightsMap: Map<string, EmailInsight>;
  selectedEmail: GmailEmail | null;
  onSelectEmail: (email: GmailEmail) => void;
  readGmailIds: Set<string>;
  doneGmailIds: Set<string>;
  snoozedGmailEmails: Map<string, string>;
  onMarkDone: (emailId: string) => void;
  onSnooze: (emailId: string, hours: number) => void;
  onReopen: (emailId: string) => void;
  isUpdating: boolean;
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToOwner?: () => void;
  hidePromotions?: boolean;
  priorityFilter?: "all" | "priority" | "promotions";
  search?: string;
}

const ITEM_HEIGHT = 88; // Height of each email item in pixels
const BUFFER_SIZE = 5; // Number of items to render above/below viewport
const INITIAL_LOAD = 20; // Initial number of items to load

// Memoized email item component for better performance
const EmailItem = memo(function EmailItem({
  email,
  insight,
  classification,
  isSelected,
  isUnread,
  isDone,
  isSnoozed,
  colors,
  onSelect,
  onMarkDone,
  onSnooze,
  onReopen,
  isUpdating,
  onNavigateToProperty,
  onNavigateToOwner,
}: {
  email: GmailEmail;
  insight: EmailInsight | undefined;
  classification: EmailClassification;
  isSelected: boolean;
  isUnread: boolean;
  isDone: boolean;
  isSnoozed: boolean;
  colors: ReturnType<typeof getClassificationColor>;
  onSelect: () => void;
  onMarkDone: () => void;
  onSnooze: (hours: number) => void;
  onReopen: () => void;
  isUpdating: boolean;
  onNavigateToProperty?: (propertyId: string) => void;
  onNavigateToOwner?: () => void;
}) {
  const shouldFade = isDone || isSnoozed || classification === "promotional";
  
  // Get simpler initials - first letter only for faster rendering
  const initial = email.fromName.charAt(0).toUpperCase() || "?";
  
  return (
    <div
      onClick={onSelect}
      style={{ height: ITEM_HEIGHT }}
      className={cn(
        "group relative flex items-start gap-3 px-3 py-3 cursor-pointer border-b border-border/30",
        // Smooth transitions for interactions
        "transition-all duration-200 ease-out",
        // Selection state
        isSelected ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/30",
        // Classification-based styling
        `border-l-4 ${colors.borderColor}`,
        colors.bgColor,
        // Fade promotional and done/snoozed
        shouldFade && colors.opacity,
        // Done status override
        isDone && "border-l-green-500 bg-green-50/30 dark:bg-green-950/10",
        // Snoozed status override  
        isSnoozed && "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10"
      )}
    >
      {/* Simple avatar - optimized with single initial */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center",
          shouldFade ? "bg-gray-300 dark:bg-gray-700" : colors.avatarBg
        )}>
          <span className="text-sm font-semibold text-white">{initial}</span>
        </div>
        {isDone && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
            <CheckCircle className="h-2 w-2 text-white" />
          </div>
        )}
        {isSnoozed && !isDone && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center">
            <Clock className="h-2 w-2 text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={cn(
              "text-sm truncate",
              isUnread && !isDone && !isSnoozed ? "font-semibold" : "font-medium",
              shouldFade && "text-muted-foreground"
            )}>
              {email.fromName}
            </span>
            
            {/* Classification badge */}
            <EmailClassificationBadge classification={classification} compact />
            
            {/* Status badges */}
            {isDone && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-medium">
                ✓ Done
              </span>
            )}
            {isSnoozed && !isDone && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-medium">
                ⏰ Snoozed
              </span>
            )}
            
            {/* AI Category Badge */}
            {insight && (
              <EmailCategoryBadge 
                category={insight.category}
                sentiment={insight.sentiment || undefined}
                priority={insight.priority || undefined}
                compact
              />
            )}
            
            {/* Property/Owner indicators */}
            {insight?.property_id && onNavigateToProperty && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToProperty(insight.property_id!);
                }}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                title="View associated property"
              >
                <Home className="h-3 w-3 text-amber-600" />
              </button>
            )}
            {insight?.owner_id && !insight?.property_id && onNavigateToOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToOwner();
                }}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                title="View associated owner"
              >
                <User className="h-3 w-3 text-purple-600" />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Quick actions on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center gap-1">
              <ConversationQuickActions
                status={isDone ? "done" : isSnoozed ? "snoozed" : "open"}
                onMarkDone={onMarkDone}
                onSnooze={onSnooze}
                onReopen={onReopen}
                isUpdating={isUpdating}
                compact
              />
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {isToday(new Date(email.date))
                ? format(new Date(email.date), "h:mm a")
                : isYesterday(new Date(email.date))
                ? "Yesterday"
                : format(new Date(email.date), "MMM d")
              }
            </span>
          </div>
        </div>
        
        {/* Subject */}
        <p className={cn(
          "text-[13px] leading-snug truncate",
          isUnread && !shouldFade ? "font-medium" : shouldFade ? "text-muted-foreground" : "text-foreground/70"
        )}>
          {decodeHtmlEntities(email.subject)}
        </p>
        
        {/* Snippet preview */}
        <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
          {decodeHtmlEntities(email.snippet)}
        </p>
      </div>
      
      {/* Unread indicator */}
      {isUnread && !isDone && !isSnoozed && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-3" />
      )}
    </div>
  );
});

export function VirtualizedEmailList({
  emails,
  emailInsightsMap,
  selectedEmail,
  onSelectEmail,
  readGmailIds,
  doneGmailIds,
  snoozedGmailEmails,
  onMarkDone,
  onSnooze,
  onReopen,
  isUpdating,
  onNavigateToProperty,
  onNavigateToOwner,
  hidePromotions = false,
  priorityFilter = "all",
  search = "",
}: VirtualizedEmailListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Classify and filter emails
  const processedEmails = useCallback(() => {
    let result = emails.map(email => ({
      email,
      classification: classifyEmail(email),
    }));
    
    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      result = result.filter(({ email }) => 
        email.subject.toLowerCase().includes(searchLower) ||
        email.fromName.toLowerCase().includes(searchLower) ||
        email.snippet.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply priority filter
    if (priorityFilter === "priority") {
      result = result.filter(({ classification }) => classification === "important");
    } else if (priorityFilter === "promotions") {
      result = result.filter(({ classification }) => classification === "promotional");
    }
    
    // Hide promotions if toggle is on
    if (hidePromotions && priorityFilter !== "promotions") {
      result = result.filter(({ classification }) => classification !== "promotional");
    }
    
    // Sort: important first, then by date
    result.sort((a, b) => {
      // Status overrides (done/snoozed at bottom)
      const aDone = doneGmailIds.has(a.email.id);
      const bDone = doneGmailIds.has(b.email.id);
      const aSnoozed = snoozedGmailEmails.has(a.email.id);
      const bSnoozed = snoozedGmailEmails.has(b.email.id);
      
      if ((aDone || aSnoozed) && !(bDone || bSnoozed)) return 1;
      if (!(aDone || aSnoozed) && (bDone || bSnoozed)) return -1;
      
      // Classification priority
      const order = { important: 0, normal: 1, promotional: 2 };
      if (order[a.classification] !== order[b.classification]) {
        return order[a.classification] - order[b.classification];
      }
      
      // Date (newest first)
      return new Date(b.email.date).getTime() - new Date(a.email.date).getTime();
    });
    
    return result;
  }, [emails, search, priorityFilter, hidePromotions, doneGmailIds, snoozedGmailEmails]);
  
  const sortedEmails = processedEmails();
  
  // Lazy loading: show only visible emails
  const displayedEmails = sortedEmails.slice(0, visibleCount);
  
  // Calculate virtual window
  const containerHeight = containerRef.current?.clientHeight || 600;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(
    displayedEmails.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
  );
  
  const totalHeight = displayedEmails.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;
  
  // Handle scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
      
      // Load more when near bottom
      const { scrollTop: st, scrollHeight, clientHeight } = containerRef.current;
      if (scrollHeight - st - clientHeight < 200 && !isLoadingMore) {
        if (visibleCount < sortedEmails.length) {
          setIsLoadingMore(true);
          // Simulate async loading for smoother UX
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + 20, sortedEmails.length));
            setIsLoadingMore(false);
          }, 100);
        }
      }
    }
  }, [isLoadingMore, visibleCount, sortedEmails.length]);
  
  // Debounced scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let ticking = false;
    const scrollHandler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    
    container.addEventListener("scroll", scrollHandler, { passive: true });
    return () => container.removeEventListener("scroll", scrollHandler);
  }, [handleScroll]);
  
  // Update container height on resize
  useEffect(() => {
    const handleResize = () => handleScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleScroll]);
  
  // Visible items to render
  const visibleItems = displayedEmails.slice(startIndex, endIndex);
  
  if (sortedEmails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Mail className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">
          {search ? "No emails match your search" : 
           priorityFilter === "priority" ? "No priority emails" :
           priorityFilter === "promotions" ? "No promotional emails" :
           "No emails"}
        </p>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-y-auto scrollbar-custom"
      style={{ minHeight: 0 }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}>
          {visibleItems.map(({ email, classification }) => {
            const insight = emailInsightsMap.get(email.id);
            const isUnread = !readGmailIds.has(email.id);
            const isDone = doneGmailIds.has(email.id);
            const isSnoozed = snoozedGmailEmails.has(email.id) && !isDone;
            const colors = getClassificationColor(classification);
            
            return (
              <EmailItem
                key={email.id}
                email={email}
                insight={insight}
                classification={classification}
                isSelected={selectedEmail?.id === email.id}
                isUnread={isUnread}
                isDone={isDone}
                isSnoozed={isSnoozed}
                colors={colors}
                onSelect={() => onSelectEmail(email)}
                onMarkDone={() => onMarkDone(email.id)}
                onSnooze={(hours) => onSnooze(email.id, hours)}
                onReopen={() => onReopen(email.id)}
                isUpdating={isUpdating}
                onNavigateToProperty={onNavigateToProperty}
                onNavigateToOwner={onNavigateToOwner}
              />
            );
          })}
        </div>
      </div>
      
      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
        </div>
      )}
      
      {/* Remaining count */}
      {visibleCount < sortedEmails.length && !isLoadingMore && (
        <div className="text-center py-3 text-xs text-muted-foreground">
          Scroll for {sortedEmails.length - visibleCount} more emails
        </div>
      )}
    </div>
  );
}
