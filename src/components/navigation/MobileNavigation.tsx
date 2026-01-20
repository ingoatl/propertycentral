import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { navigationConfig, NavDropdown, NavLink } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface MobileNavigationProps {
  isAdmin: boolean;
  onNavigate?: () => void;
}

export function MobileNavigation({ isAdmin, onNavigate }: MobileNavigationProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const location = useLocation();

  const toggleGroup = (label: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedGroups(prev =>
      prev.includes(label)
        ? prev.filter(g => g !== label)
        : [...prev, label]
    );
  };

  const handleLinkClick = () => {
    onNavigate?.();
  };

  const visibleNavItems = navigationConfig.filter(
    item => !item.adminOnly || isAdmin
  );

  return (
    <nav className="py-3 px-2">
      <div className="space-y-1">
        {visibleNavItems.map((navItem) => {
          if (navItem.type === "link") {
            const linkItem = navItem as NavLink;
            const isActive = location.pathname === linkItem.path;
            const Icon = linkItem.icon;

            return (
              <Link
                key={linkItem.path}
                to={linkItem.path}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
                  "active:scale-[0.98] touch-manipulation",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{linkItem.label}</span>
              </Link>
            );
          }

          const dropdownItem = navItem as NavDropdown;
          const isExpanded = expandedGroups.includes(dropdownItem.label);
          const hasActiveChild = dropdownItem.items.some(
            item => location.pathname === item.path || location.pathname.startsWith(item.path.split('?')[0])
          );
          const Icon = dropdownItem.icon;
          const visibleItems = dropdownItem.items.filter(
            item => !item.adminOnly || isAdmin
          );

          return (
            <div key={dropdownItem.label} className="space-y-1">
              {/* Dropdown Header */}
              <button
                type="button"
                onClick={(e) => toggleGroup(dropdownItem.label, e)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
                  "active:scale-[0.98] touch-manipulation",
                  hasActiveChild 
                    ? "bg-secondary text-foreground" 
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 text-left">{dropdownItem.label}</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>
              
              {/* Submenu Items - Always rendered, visibility controlled by CSS */}
              <div 
                className={cn(
                  "ml-4 pl-4 border-l-2 border-border/50 space-y-1 overflow-hidden transition-all duration-200",
                  isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path || 
                    (item.path.includes('?') && location.pathname + location.search === item.path);
                  const ItemIcon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleLinkClick}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                        "active:scale-[0.98] touch-manipulation",
                        isActive 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                    >
                      <ItemIcon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}