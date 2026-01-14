import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CreditCard,
  Wrench,
  Home,
  MessageSquare,
  FileText,
  ShoppingCart,
  Zap,
  AlertTriangle,
  Info,
  TrendingUp,
  Users,
  Building2,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EmailCategory = 
  | "booking"
  | "payment"
  | "maintenance"
  | "expense"
  | "guest_communication"
  | "tenant_communication"
  | "owner_communication"
  | "legal"
  | "utilities"
  | "order"
  | "other";

export type EmailSentiment = "positive" | "neutral" | "negative" | "concerning" | "urgent";
export type EmailPriority = "urgent" | "high" | "normal" | "low";

interface EmailCategoryBadgeProps {
  category?: EmailCategory | string;
  sentiment?: EmailSentiment | string;
  priority?: EmailPriority | string;
  compact?: boolean;
  className?: string;
}

const categoryConfig: Record<string, { 
  icon: typeof Calendar; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  booking: { 
    icon: Calendar, 
    label: "Booking", 
    color: "text-blue-600",
    bgColor: "bg-blue-500/10"
  },
  payment: { 
    icon: CreditCard, 
    label: "Payment", 
    color: "text-green-600",
    bgColor: "bg-green-500/10"
  },
  maintenance: { 
    icon: Wrench, 
    label: "Maintenance", 
    color: "text-orange-600",
    bgColor: "bg-orange-500/10"
  },
  expense: { 
    icon: ShoppingCart, 
    label: "Expense", 
    color: "text-purple-600",
    bgColor: "bg-purple-500/10"
  },
  guest_communication: { 
    icon: Users, 
    label: "Guest", 
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10"
  },
  tenant_communication: { 
    icon: Home, 
    label: "Tenant", 
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/10"
  },
  owner_communication: { 
    icon: Building2, 
    label: "Owner", 
    color: "text-violet-600",
    bgColor: "bg-violet-500/10"
  },
  legal: { 
    icon: Scale, 
    label: "Legal", 
    color: "text-red-600",
    bgColor: "bg-red-500/10"
  },
  utilities: { 
    icon: Zap, 
    label: "Utilities", 
    color: "text-amber-600",
    bgColor: "bg-amber-500/10"
  },
  order: { 
    icon: ShoppingCart, 
    label: "Order", 
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10"
  },
  other: { 
    icon: FileText, 
    label: "Other", 
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
};

const sentimentConfig: Record<string, { 
  color: string;
  bgColor: string;
  indicator: string;
}> = {
  positive: { 
    color: "text-green-600", 
    bgColor: "bg-green-500/10",
    indicator: "bg-green-500"
  },
  neutral: { 
    color: "text-muted-foreground", 
    bgColor: "bg-muted",
    indicator: "bg-muted-foreground"
  },
  negative: { 
    color: "text-red-600", 
    bgColor: "bg-red-500/10",
    indicator: "bg-red-500"
  },
  concerning: { 
    color: "text-amber-600", 
    bgColor: "bg-amber-500/10",
    indicator: "bg-amber-500"
  },
  urgent: { 
    color: "text-red-600", 
    bgColor: "bg-red-500/10",
    indicator: "bg-red-500"
  },
};

const priorityConfig: Record<string, { 
  color: string;
  bgColor: string;
  label: string;
}> = {
  urgent: { 
    color: "text-red-600", 
    bgColor: "bg-red-500/10",
    label: "Urgent"
  },
  high: { 
    color: "text-orange-600", 
    bgColor: "bg-orange-500/10",
    label: "High"
  },
  normal: { 
    color: "text-muted-foreground", 
    bgColor: "bg-muted",
    label: "Normal"
  },
  low: { 
    color: "text-muted-foreground", 
    bgColor: "bg-muted/50",
    label: "Low"
  },
};

export function EmailCategoryBadge({ 
  category, 
  sentiment, 
  priority,
  compact = false,
  className 
}: EmailCategoryBadgeProps) {
  const catConfig = category ? categoryConfig[category] || categoryConfig.other : null;
  const sentConfig = sentiment ? sentimentConfig[sentiment] || sentimentConfig.neutral : null;
  const prioConfig = priority && priority !== "normal" && priority !== "low" 
    ? priorityConfig[priority] 
    : null;

  if (!catConfig && !sentConfig && !prioConfig) return null;

  const Icon = catConfig?.icon || FileText;

  if (compact) {
    // Compact mode: just icon with tooltip
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {catConfig && (
          <div 
            className={cn(
              "flex items-center justify-center rounded p-0.5",
              catConfig.bgColor
            )}
            title={catConfig.label}
          >
            <Icon className={cn("h-3 w-3", catConfig.color)} />
          </div>
        )}
        {sentConfig && sentiment !== "neutral" && (
          <div 
            className={cn("w-1.5 h-1.5 rounded-full", sentConfig.indicator)}
            title={`Sentiment: ${sentiment}`}
          />
        )}
        {prioConfig && (
          <span 
            className={cn(
              "text-[9px] font-bold px-1 py-0.5 rounded",
              prioConfig.bgColor,
              prioConfig.color
            )}
          >
            {priority === "urgent" ? "!" : "↑"}
          </span>
        )}
      </div>
    );
  }

  // Full mode: badges with labels
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {catConfig && (
        <Badge 
          variant="secondary" 
          className={cn(
            "gap-1 text-[10px] font-medium px-1.5 py-0",
            catConfig.bgColor,
            catConfig.color
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {catConfig.label}
        </Badge>
      )}
      {prioConfig && (
        <Badge 
          variant="secondary" 
          className={cn(
            "text-[10px] font-medium px-1.5 py-0",
            prioConfig.bgColor,
            prioConfig.color
          )}
        >
          {prioConfig.label}
        </Badge>
      )}
      {sentConfig && sentiment !== "neutral" && (
        <div 
          className={cn("w-2 h-2 rounded-full", sentConfig.indicator)}
          title={`Sentiment: ${sentiment}`}
        />
      )}
    </div>
  );
}

// Export for use in filters
export const EMAIL_CATEGORIES = Object.entries(categoryConfig).map(([key, config]) => ({
  value: key,
  label: config.label,
  icon: config.icon,
}));
