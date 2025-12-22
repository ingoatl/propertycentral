import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { navigationConfig, NavDropdown, NavLink } from "@/config/navigation";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import { MegaMenuDropdown } from "./MegaMenuDropdown";
import { cn } from "@/lib/utils";

interface MainNavigationProps {
  isAdmin: boolean;
}

export function MainNavigation({ isAdmin }: MainNavigationProps) {
  const location = useLocation();

  const isDropdownActive = (dropdown: NavDropdown) => {
    return dropdown.items.some(item => location.pathname === item.path);
  };

  const visibleNavItems = navigationConfig.filter(
    item => !item.adminOnly || isAdmin
  );

  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList className="gap-1">
        {visibleNavItems.map((navItem) => {
          if (navItem.type === "link") {
            const linkItem = navItem as NavLink;
            const isActive = location.pathname === linkItem.path;
            const Icon = linkItem.icon;

            return (
              <NavigationMenuItem key={linkItem.path}>
                <NavigationMenuLink asChild>
                  <Link
                    to={linkItem.path}
                    className={cn(
                      "group inline-flex h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                      isActive && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {linkItem.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          }

          const dropdownItem = navItem as NavDropdown;
          const isActive = isDropdownActive(dropdownItem);
          const Icon = dropdownItem.icon;

          return (
            <NavigationMenuItem key={dropdownItem.label}>
              <NavigationMenuTrigger
                className={cn(
                  "h-10 rounded-lg px-4 py-2 text-sm font-medium",
                  "bg-transparent hover:bg-accent hover:text-accent-foreground",
                  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                  isActive && "bg-accent/50 text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 mr-2" />
                {dropdownItem.label}
              </NavigationMenuTrigger>
              <MegaMenuDropdown items={dropdownItem.items} isAdmin={isAdmin} />
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
