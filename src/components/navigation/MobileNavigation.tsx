import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
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
    <nav className="flex flex-col p-4 gap-1">
      {visibleNavItems.map((navItem) => {
        if (navItem.type === "link") {
          const linkItem = navItem as NavLink;
          const isActive = location.pathname === linkItem.path;
          const Icon = linkItem.icon;

          return (
            <Link
              key={linkItem.path}
              to={linkItem.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all",
                "active:scale-[0.98] touch-manipulation",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-foreground hover:bg-muted"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                isActive ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span>{linkItem.label}</span>
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
                className={cn(
                  "flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-medium transition-all",
                  "active:scale-[0.98] touch-manipulation",
                  hasActiveChild 
                    ? "bg-primary/10 text-primary" 
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    hasActiveChild ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {dropdownItem.label}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    (isExpanded || hasActiveChild) && "rotate-180"
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 mt-1 space-y-0.5 animate-accordion-down">
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                const ItemIcon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all",
                      "active:scale-[0.98] touch-manipulation",
                      isActive 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <ItemIcon className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.description && (
                        <span className="text-[11px] text-muted-foreground leading-tight">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}
