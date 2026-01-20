import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { navigationConfig, NavDropdown, NavLink } from "@/config/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MobileNavigationProps {
  isAdmin: boolean;
}

export function MobileNavigation({ isAdmin }: MobileNavigationProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const location = useLocation();

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    );
  };

  const visibleNavItems = navigationConfig.filter(
    item => !item.adminOnly || isAdmin
  );

  return (
    <nav className="py-2">
      {visibleNavItems.map((navItem) => {
        if (navItem.type === "link") {
          const linkItem = navItem as NavLink;
          const isActive = location.pathname === linkItem.path;
          const Icon = linkItem.icon;

          return (
            <Link
              key={linkItem.path}
              to={linkItem.path}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-3 mx-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
                "active:bg-secondary touch-manipulation",
                isActive 
                  ? "bg-secondary text-foreground" 
                  : "text-foreground/80 hover:bg-secondary/50"
              )}
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1">{linkItem.label}</span>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-foreground" />}
            </Link>
          );
        }

        const dropdownItem = navItem as NavDropdown;
        const isExpanded = expandedGroups.includes(dropdownItem.label);
        const hasActiveChild = dropdownItem.items.some(
          item => location.pathname === item.path
        );
        const Icon = dropdownItem.icon;
        const visibleItems = dropdownItem.items.filter(
          item => !item.adminOnly || isAdmin
        );

        return (
          <Collapsible
            key={dropdownItem.label}
            open={isExpanded || hasActiveChild}
            onOpenChange={() => toggleGroup(dropdownItem.label)}
          >
            <CollapsibleTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(dropdownItem.label);
                }}
                className={cn(
                  "flex items-center gap-3 w-full mx-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
                  "active:bg-secondary touch-manipulation",
                  hasActiveChild 
                    ? "bg-secondary/50 text-foreground" 
                    : "text-foreground/80 hover:bg-secondary/50"
                )}
                style={{ width: 'calc(100% - 24px)' }}
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left">{dropdownItem.label}</span>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    (isExpanded || hasActiveChild) && "rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="ml-6 pl-4 border-l border-border/50 my-1 space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const ItemIcon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                        "active:bg-secondary touch-manipulation",
                        isActive 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ItemIcon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}
