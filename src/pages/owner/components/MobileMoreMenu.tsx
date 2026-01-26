import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Sparkles,
  FileText,
  Receipt,
  Wrench,
  Calendar,
  Shield,
  Megaphone,
  Phone,
  RefreshCw,
  LogOut,
  LucideIcon,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TabConfig {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const SECONDARY_TABS: TabConfig[] = [
  { value: "insights", label: "Market Insights", description: "AI-powered market analysis", icon: Sparkles },
  { value: "statements", label: "Statements", description: "Monthly financial reports", icon: FileText },
  { value: "receipts", label: "Expenses", description: "Receipts & purchases", icon: Receipt },
  { value: "maintenance", label: "Repairs", description: "Maintenance requests", icon: Wrench },
  { value: "scheduled", label: "Scheduled", description: "Upcoming maintenance", icon: Calendar },
  { value: "screenings", label: "Screenings", description: "Guest verification", icon: Shield },
  { value: "marketing", label: "Marketing", description: "Promotion & outreach", icon: Megaphone },
];

interface MobileMoreMenuProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onScheduleCall: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  isRefreshing: boolean;
}

export function MobileMoreMenu({
  open,
  onClose,
  activeTab,
  onTabChange,
  onScheduleCall,
  onRefresh,
  onLogout,
  isRefreshing,
}: MobileMoreMenuProps) {
  const handleTabSelect = (value: string) => {
    onTabChange(value);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Menu Panel */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ 
              type: "spring", 
              stiffness: 400, 
              damping: 35,
              mass: 0.8
            }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl bg-background shadow-2xl"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
              <div>
                <h2 className="text-xl font-bold">Menu</h2>
                <p className="text-sm text-muted-foreground">Access more features</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 rounded-full bg-muted hover:bg-muted/80"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-2">
              {/* Navigation Section */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
                Navigation
              </p>
              
              {SECONDARY_TABS.map((tab, index) => {
                const isActive = activeTab === tab.value;
                return (
                  <motion.button
                    key={tab.value}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleTabSelect(tab.value)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200",
                      "active:scale-[0.98] touch-manipulation",
                      isActive 
                        ? "bg-primary/10 border-2 border-primary/30" 
                        : "hover:bg-muted border-2 border-transparent"
                    )}
                  >
                    <div 
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        isActive 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <tab.icon className="h-5 w-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={cn(
                        "font-semibold truncate",
                        isActive && "text-primary"
                      )}>
                        {tab.label}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {tab.description}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground/50"
                    )} />
                  </motion.button>
                );
              })}
              
              {/* Actions Section */}
              <div className="pt-4 mt-4 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
                  Quick Actions
                </p>
                
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.24 }}
                  onClick={() => { onScheduleCall(); onClose(); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-muted transition-all active:scale-[0.98] touch-manipulation"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold">Schedule Call</p>
                    <p className="text-sm text-muted-foreground">Talk to your manager</p>
                  </div>
                </motion.button>
                
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.27 }}
                  onClick={() => { onRefresh(); onClose(); }}
                  disabled={isRefreshing}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-muted transition-all active:scale-[0.98] touch-manipulation disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <RefreshCw className={cn("h-5 w-5 text-blue-600", isRefreshing && "animate-spin")} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold">{isRefreshing ? "Refreshing..." : "Refresh Data"}</p>
                    <p className="text-sm text-muted-foreground">Update your dashboard</p>
                  </div>
                </motion.button>
                
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => { onLogout(); onClose(); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-destructive/10 transition-all active:scale-[0.98] touch-manipulation"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <LogOut className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-destructive">Log Out</p>
                    <p className="text-sm text-muted-foreground">Sign out of portal</p>
                  </div>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
