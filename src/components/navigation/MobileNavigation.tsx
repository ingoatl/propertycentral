import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, ChevronDown, Building2 } from "lucide-react";
import { navigationConfig, NavDropdown, NavLink } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [open, setOpen] = useState(false);
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

  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-warm">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Property Central</span>
          </SheetTitle>
        </SheetHeader>
        
        <nav className="flex flex-col p-4 gap-2">
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
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    "hover:bg-accent",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {linkItem.label}
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
                      "flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      "hover:bg-accent",
                      hasActiveChild && "bg-accent/50"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      {dropdownItem.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        (isExpanded || hasActiveChild) && "rotate-180"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4 mt-1 space-y-1">
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const ItemIcon = item.icon;

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={handleLinkClick}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors",
                          "hover:bg-accent",
                          isActive && "bg-accent text-accent-foreground font-medium"
                        )}
                      >
                        <ItemIcon className="w-4 h-4" />
                        <div className="flex flex-col">
                          <span>{item.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
