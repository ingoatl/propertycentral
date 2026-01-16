import { Sparkles, Megaphone, Inbox, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EmailQuickFilterType = "all" | "priority" | "promotions";

interface EmailQuickFiltersProps {
  activeFilter: EmailQuickFilterType;
  onFilterChange: (filter: EmailQuickFilterType) => void;
  counts: {
    total: number;
    important: number;
    promotional: number;
  };
  hidePromotions: boolean;
  onToggleHidePromotions: () => void;
}

export function EmailQuickFilters({
  activeFilter,
  onFilterChange,
  counts,
  hidePromotions,
  onToggleHidePromotions,
}: EmailQuickFiltersProps) {
  const filters = [
    { id: "all" as const, label: "All", icon: Inbox, count: counts.total },
    { id: "priority" as const, label: "Priority", icon: Sparkles, count: counts.important, color: "text-emerald-600" },
    { id: "promotions" as const, label: "Promos", icon: Megaphone, count: counts.promotional, color: "text-gray-500" },
  ];

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/30">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilter === filter.id;
        
        return (
          <Button
            key={filter.id}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "gap-1.5 h-7 text-xs font-medium transition-all",
              isActive && filter.id === "priority" && "bg-emerald-600 hover:bg-emerald-700",
              isActive && filter.id === "promotions" && "bg-gray-500 hover:bg-gray-600",
              !isActive && filter.color
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{filter.label}</span>
            {filter.count > 0 && (
              <Badge 
                variant={isActive ? "secondary" : "outline"} 
                className={cn(
                  "h-4 px-1.5 text-[10px] font-normal ml-0.5",
                  isActive && "bg-white/20 text-white border-0"
                )}
              >
                {filter.count}
              </Badge>
            )}
          </Button>
        );
      })}
      
      {/* Hide promotions toggle */}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleHidePromotions}
          className={cn(
            "h-7 text-xs gap-1.5",
            hidePromotions && "text-amber-600"
          )}
        >
          <Megaphone className="h-3 w-3" />
          {hidePromotions ? "Show promos" : "Hide promos"}
        </Button>
      </div>
    </div>
  );
}
