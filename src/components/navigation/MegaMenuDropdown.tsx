import { Link, useLocation } from "react-router-dom";
import { NavItem } from "@/config/navigation";
import {
  NavigationMenuContent,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

interface MegaMenuDropdownProps {
  items: NavItem[];
  isAdmin: boolean;
}

export function MegaMenuDropdown({ items, isAdmin }: MegaMenuDropdownProps) {
  const location = useLocation();
  
  const visibleItems = items.filter(item => !item.adminOnly || isAdmin);

  return (
    <NavigationMenuContent className="absolute left-0 top-full">
      <div className="w-[420px] p-4 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl shadow-black/10">
        <div className="grid grid-cols-1 gap-2">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg transition-all duration-150",
                  "hover:bg-accent group",
                  isActive && "bg-accent"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  "bg-primary/10 group-hover:bg-primary/20",
                  isActive && "bg-primary/20"
                )}>
                  <Icon className={cn(
                    "w-5 h-5 text-primary transition-colors",
                    isActive && "text-primary"
                  )} />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-sm font-medium text-foreground",
                    isActive && "text-primary"
                  )}>
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </NavigationMenuContent>
  );
}
