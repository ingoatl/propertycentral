import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { navigationConfig, NavDropdown, NavLink } from "@/config/navigation";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
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
          const visibleItems = dropdownItem.items.filter(
            item => !item.adminOnly || isAdmin
          );

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
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-2 p-4 bg-popover">
                  {visibleItems.map((item) => {
                    const isItemActive = location.pathname === item.path;
                    const ItemIcon = item.icon;
                    
                    return (
                      <li key={item.path}>
                        <NavigationMenuLink asChild>
                          <Link
                            to={item.path}
                            className={cn(
                              "flex items-center gap-4 p-3 rounded-lg transition-all duration-150",
                              "hover:bg-accent group select-none outline-none",
                              isItemActive && "bg-accent"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                              "bg-primary/10 group-hover:bg-primary/20",
                              isItemActive && "bg-primary/20"
                            )}>
                              <ItemIcon className={cn(
                                "w-5 h-5 text-primary transition-colors"
                              )} />
                            </div>
                            <div className="flex flex-col">
                              <span className={cn(
                                "text-sm font-medium text-foreground",
                                isItemActive && "text-primary"
                              )}>
                                {item.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.description}
                              </span>
                            </div>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
