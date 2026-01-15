import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Inbox,
  Clock,
  CheckCheck,
  AlertCircle,
  Users,
  Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabType = "all" | "chats" | "calls" | "emails";
export type FilterType = "all" | "open" | "unread" | "snoozed" | "done" | "urgent" | "owners" | "awaiting";

interface InboxFiltersProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts?: {
    all?: number;
    open?: number;
    unread?: number;
    snoozed?: number;
    done?: number;
    urgent?: number;
    owners?: number;
    awaiting?: number;
  };
}

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Inbox },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "emails", label: "Emails", icon: Mail },
];

const filters: { id: FilterType; label: string; icon: React.ElementType; color?: string }[] = [
  { id: "all", label: "All", icon: Inbox },
  { id: "open", label: "Open", icon: MessageSquare },
  { id: "awaiting", label: "Awaiting", icon: Hourglass, color: "text-blue-600" },
  { id: "urgent", label: "Priority", icon: AlertCircle, color: "text-red-600" },
  { id: "owners", label: "Owners", icon: Users, color: "text-purple-600" },
  { id: "snoozed", label: "Snoozed", icon: Clock, color: "text-amber-600" },
  { id: "done", label: "Done", icon: CheckCheck, color: "text-green-600" },
];

export function InboxFilters({
  activeTab,
  onTabChange,
  activeFilter,
  onFilterChange,
  counts = {},
}: InboxFiltersProps) {
  return (
    <div className="border-b">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "gap-1.5 h-8",
                isActive && "bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.id;
          const count = counts[filter.id];
          
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                filter.color && !isActive && filter.color
              )}
            >
              <Icon className="h-3 w-3" />
              {filter.label}
              {count !== undefined && count > 0 && (
                <Badge 
                  variant={isActive ? "secondary" : "outline"} 
                  className="h-4 px-1 text-[10px] font-normal"
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
