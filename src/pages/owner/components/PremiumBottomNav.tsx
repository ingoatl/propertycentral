import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, 
  MessageCircle, 
  Users, 
  Home, 
  MoreHorizontal,
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TabConfig {
  value: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_TABS: TabConfig[] = [
  { value: "overview", label: "Overview", icon: BarChart3 },
  { value: "messages", label: "Messages", icon: MessageCircle },
  { value: "bookings", label: "Bookings", icon: Users },
  { value: "property", label: "Property", icon: Home },
];

interface PremiumBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMoreClick: () => void;
  isSecondaryTabActive: boolean;
  activeSecondaryLabel?: string;
  ActiveSecondaryIcon?: LucideIcon;
}

export function PremiumBottomNav({
  activeTab,
  onTabChange,
  onMoreClick,
  isSecondaryTabActive,
  activeSecondaryLabel,
  ActiveSecondaryIcon,
}: PremiumBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* Glass morphism background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
      
      {/* Active indicator glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      <div className="relative flex h-20 px-2">
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 relative",
                "transition-all duration-200 touch-manipulation",
                "active:scale-95"
              )}
            >
              {/* Active background pill */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute inset-x-2 top-1 bottom-3 rounded-2xl bg-primary/10"
                  />
                )}
              </AnimatePresence>
              
              {/* Active indicator dot */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </AnimatePresence>
              
              <motion.div
                animate={{ 
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -1 : 0
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <tab.icon 
                  className={cn(
                    "h-6 w-6 transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} 
                />
              </motion.div>
              
              <span 
                className={cn(
                  "text-[11px] font-medium transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
        
        {/* More button */}
        <button
          onClick={onMoreClick}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-1 relative",
            "transition-all duration-200 touch-manipulation",
            "active:scale-95"
          )}
        >
          {/* Active background for More when secondary tab is active */}
          <AnimatePresence>
            {isSecondaryTabActive && (
              <motion.div
                layoutId="activeTabBg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute inset-x-2 top-1 bottom-3 rounded-2xl bg-primary/10"
              />
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {isSecondaryTabActive && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-primary"
              />
            )}
          </AnimatePresence>
          
          <motion.div
            animate={{ 
              scale: isSecondaryTabActive ? 1.1 : 1,
              y: isSecondaryTabActive ? -1 : 0
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {isSecondaryTabActive && ActiveSecondaryIcon ? (
              <ActiveSecondaryIcon className="h-6 w-6 text-primary" />
            ) : (
              <MoreHorizontal 
                className={cn(
                  "h-6 w-6 transition-colors duration-200",
                  isSecondaryTabActive ? "text-primary" : "text-muted-foreground"
                )} 
              />
            )}
          </motion.div>
          
          <span 
            className={cn(
              "text-[11px] font-medium transition-colors duration-200",
              isSecondaryTabActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            {isSecondaryTabActive && activeSecondaryLabel ? activeSecondaryLabel : "More"}
          </span>
        </button>
      </div>
    </nav>
  );
}
