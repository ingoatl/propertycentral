import { motion } from "framer-motion";
import { Phone, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionsProps {
  onScheduleCall: () => void;
  onGenerateReport: () => void;
  className?: string;
}

export function FloatingActions({
  onScheduleCall,
  onGenerateReport,
  className,
}: FloatingActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className={cn(
        "fixed right-4 bottom-28 z-40 flex flex-col gap-3",
        className
      )}
    >
      {/* Report FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onGenerateReport}
        className="w-14 h-14 rounded-2xl bg-background border-2 border-border shadow-lg flex items-center justify-center transition-colors hover:border-primary/50 active:bg-muted"
      >
        <FileText className="h-6 w-6 text-muted-foreground" />
      </motion.button>
      
      {/* Call FAB - Primary action */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onScheduleCall}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30 flex items-center justify-center"
      >
        <Phone className="h-6 w-6 text-primary-foreground" />
      </motion.button>
    </motion.div>
  );
}
