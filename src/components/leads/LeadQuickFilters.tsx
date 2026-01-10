import { LeadStage, STAGE_CONFIG } from "@/types/leads";
import { X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type FilterType = "stage" | "source";

interface LeadQuickFiltersProps {
  activeFilters: { type: FilterType; value: string }[];
  onFilterChange: (filters: { type: FilterType; value: string }[]) => void;
  availableSources: string[];
}

const LeadQuickFilters = ({
  activeFilters,
  onFilterChange,
  availableSources,
}: LeadQuickFiltersProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  
  const stages: LeadStage[] = [
    "new_lead",
    "unreached",
    "call_scheduled",
    "call_attended",
    "send_contract",
    "contract_out",
    "contract_signed",
  ];

  const toggleFilter = (type: FilterType, value: string) => {
    const exists = activeFilters.some(
      (f) => f.type === type && f.value === value
    );
    if (exists) {
      onFilterChange(
        activeFilters.filter((f) => !(f.type === type && f.value === value))
      );
    } else {
      onFilterChange([...activeFilters, { type, value }]);
    }
  };

  const clearFilters = () => {
    onFilterChange([]);
  };

  const isActive = (type: FilterType, value: string) =>
    activeFilters.some((f) => f.type === type && f.value === value);

  // Mobile: Collapsible filter section
  if (isMobile) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                  {activeFilters.length}
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          
          {activeFilters.length > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        
        <CollapsibleContent className="mt-3 space-y-3">
          {/* Stage filters - horizontal scroll */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">Stage</p>
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex items-center gap-1.5 min-w-max pb-1">
                {stages.map((stage) => {
                  const config = STAGE_CONFIG[stage];
                  const active = isActive("stage", stage);
                  return (
                    <button
                      key={stage}
                      onClick={() => toggleFilter("stage", stage)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                        active
                          ? "text-white shadow-sm"
                          : "bg-muted text-muted-foreground"
                      )}
                      style={
                        active
                          ? { backgroundColor: config.accentColor }
                          : undefined
                      }
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Source filters - horizontal scroll */}
          {availableSources.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-2">Source</p>
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="flex items-center gap-1.5 min-w-max pb-1">
                  {availableSources.map((source) => {
                    const active = isActive("source", source);
                    return (
                      <button
                        key={source}
                        onClick={() => toggleFilter("source", source)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {source}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Desktop: horizontal layout
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Stage filters */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">Stage:</span>
        {stages.map((stage) => {
          const config = STAGE_CONFIG[stage];
          const active = isActive("stage", stage);
          return (
            <button
              key={stage}
              onClick={() => toggleFilter("stage", stage)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                active
                  ? "text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              style={
                active
                  ? { backgroundColor: config.accentColor }
                  : undefined
              }
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Source filters */}
      {availableSources.length > 0 && (
        <>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Source:</span>
            {availableSources.slice(0, 5).map((source) => {
              const active = isActive("source", source);
              return (
                <button
                  key={source}
                  onClick={() => toggleFilter("source", source)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {source}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Clear all */}
      {activeFilters.length > 0 && (
        <>
          <div className="h-5 w-px bg-border" />
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear ({activeFilters.length})
          </button>
        </>
      )}
    </div>
  );
};

export default LeadQuickFilters;
