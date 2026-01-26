import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  MessageCircle, 
  Users, 
  Home, 
  Sparkles,
  FileText,
  Receipt,
  Wrench,
  Calendar,
  Shield,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TabConfig {
  value: string;
  label: string;
  icon: LucideIcon;
}

const ALL_TABS: TabConfig[] = [
  { value: "overview", label: "Overview", icon: BarChart3 },
  { value: "messages", label: "Messages", icon: MessageCircle },
  { value: "bookings", label: "Bookings", icon: Users },
  { value: "property", label: "Property", icon: Home },
  { value: "insights", label: "Insights", icon: Sparkles },
  { value: "statements", label: "Statements", icon: FileText },
  { value: "receipts", label: "Expenses", icon: Receipt },
  { value: "maintenance", label: "Repairs", icon: Wrench },
  { value: "scheduled", label: "Scheduled", icon: Calendar },
  { value: "screenings", label: "Screenings", icon: Shield },
  { value: "marketing", label: "Marketing", icon: Megaphone },
];

interface MobileTopNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileTopNav({ activeTab, onTabChange }: MobileTopNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll to active tab on mount and when tab changes
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const activeButton = activeTabRef.current;
      
      const containerWidth = container.offsetWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;
      
      // Center the active tab
      const scrollPosition = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, [activeTab]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftFade(scrollLeft > 20);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  const scrollToDirection = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
      {/* Top gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      <div className="relative">
        {/* Left fade & scroll button */}
        <div 
          className={cn(
            "absolute left-0 top-0 bottom-0 w-12 z-10 flex items-center justify-start pl-1",
            "bg-gradient-to-r from-background via-background/80 to-transparent",
            "transition-opacity duration-200",
            showLeftFade ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <button
            onClick={() => scrollToDirection('left')}
            className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Right fade & scroll button */}
        <div 
          className={cn(
            "absolute right-0 top-0 bottom-0 w-12 z-10 flex items-center justify-end pr-1",
            "bg-gradient-to-l from-background via-background/80 to-transparent",
            "transition-opacity duration-200",
            showRightFade ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <button
            onClick={() => scrollToDirection('right')}
            className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable tabs */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto scrollbar-hide py-2 px-3 gap-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {ALL_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                ref={isActive ? activeTabRef : null}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 rounded-full whitespace-nowrap",
                  "transition-all duration-200 touch-manipulation shrink-0",
                  "active:scale-95 text-sm font-medium",
                  isActive 
                    ? "text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {/* Active background */}
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-0 bg-primary rounded-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                
                <tab.icon className={cn("h-4 w-4 relative z-10", isActive && "text-primary-foreground")} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
