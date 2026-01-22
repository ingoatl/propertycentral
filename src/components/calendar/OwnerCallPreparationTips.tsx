import { 
  AlertCircle, 
  DollarSign, 
  Wrench, 
  Users, 
  TrendingUp, 
  Home, 
  Tag,
  CheckCircle2,
  FileText,
  Phone,
  MessageCircle,
  Calendar,
  ClipboardList
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PreparationTipsProps {
  topic: string;
  topicDetails?: string | null;
  pendingMaintenanceCount?: number;
  thisMonthRevenue?: number;
  lastMonthRevenue?: number;
  upcomingBookingsCount?: number;
  recentGuestsCount?: number;
}

interface TipItem {
  icon: typeof CheckCircle2;
  text: string;
  priority: "high" | "medium" | "low";
}

const TOPIC_PREPARATION: Record<string, { title: string; tips: TipItem[] }> = {
  monthly_statement: {
    title: "Statement Discussion Prep",
    tips: [
      { icon: FileText, text: "Pull up the latest monthly statement PDF", priority: "high" },
      { icon: DollarSign, text: "Review any unusual charges or adjustments", priority: "high" },
      { icon: ClipboardList, text: "Check for pending expense approvals", priority: "medium" },
      { icon: TrendingUp, text: "Compare revenue to previous months", priority: "medium" },
      { icon: Calendar, text: "Note upcoming bookings that will affect next statement", priority: "low" },
    ],
  },
  maintenance: {
    title: "Maintenance Discussion Prep",
    tips: [
      { icon: Wrench, text: "Review all open work orders", priority: "high" },
      { icon: DollarSign, text: "Have cost estimates ready for pending repairs", priority: "high" },
      { icon: ClipboardList, text: "Prepare vendor recommendations if needed", priority: "medium" },
      { icon: FileText, text: "Pull photos of any damage or issues", priority: "medium" },
      { icon: Calendar, text: "Check booking calendar for scheduling repairs", priority: "low" },
    ],
  },
  guest_concerns: {
    title: "Guest Concerns Prep",
    tips: [
      { icon: Users, text: "Review recent guest reviews and feedback", priority: "high" },
      { icon: MessageCircle, text: "Pull up relevant guest communications", priority: "high" },
      { icon: AlertCircle, text: "Document any incidents or complaints", priority: "medium" },
      { icon: CheckCircle2, text: "Note resolutions already in progress", priority: "medium" },
      { icon: DollarSign, text: "Calculate any refunds or credits issued", priority: "low" },
    ],
  },
  pricing: {
    title: "Pricing Discussion Prep",
    tips: [
      { icon: TrendingUp, text: "Run market comp analysis for the area", priority: "high" },
      { icon: Calendar, text: "Review occupancy rate vs market average", priority: "high" },
      { icon: DollarSign, text: "Check ADR and RevPAR trends", priority: "medium" },
      { icon: ClipboardList, text: "Note any seasonal adjustments planned", priority: "medium" },
      { icon: Home, text: "Consider recent upgrades that justify rate increase", priority: "low" },
    ],
  },
  property_update: {
    title: "Property Update Prep",
    tips: [
      { icon: Home, text: "Review recent booking activity", priority: "high" },
      { icon: Calendar, text: "Note upcoming turnovers and bookings", priority: "high" },
      { icon: AlertCircle, text: "Check for any damage reports", priority: "medium" },
      { icon: Users, text: "Review recent guest feedback", priority: "medium" },
      { icon: Wrench, text: "List any recommended improvements", priority: "low" },
    ],
  },
  general_checkin: {
    title: "General Check-in Prep",
    tips: [
      { icon: TrendingUp, text: "Review overall property performance", priority: "high" },
      { icon: MessageCircle, text: "Note last communication and any follow-ups", priority: "medium" },
      { icon: CheckCircle2, text: "Prepare positive highlights to share", priority: "medium" },
      { icon: ClipboardList, text: "List any items requiring owner decision", priority: "medium" },
      { icon: Calendar, text: "Check for upcoming important dates", priority: "low" },
    ],
  },
  other: {
    title: "Call Preparation",
    tips: [
      { icon: FileText, text: "Review the topic details provided", priority: "high" },
      { icon: MessageCircle, text: "Check recent communication history", priority: "medium" },
      { icon: ClipboardList, text: "Prepare relevant documents", priority: "medium" },
      { icon: Users, text: "Note any pending owner requests", priority: "low" },
    ],
  },
};

function getPriorityColor(priority: "high" | "medium" | "low"): string {
  switch (priority) {
    case "high":
      return "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300";
    case "medium":
      return "bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300";
    case "low":
      return "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300";
  }
}

function getPriorityBadge(priority: "high" | "medium" | "low"): string {
  switch (priority) {
    case "high":
      return "Essential";
    case "medium":
      return "Helpful";
    case "low":
      return "Nice to have";
  }
}

export function OwnerCallPreparationTips({
  topic,
  topicDetails,
  pendingMaintenanceCount = 0,
  thisMonthRevenue = 0,
  lastMonthRevenue = 0,
  upcomingBookingsCount = 0,
  recentGuestsCount = 0,
}: PreparationTipsProps) {
  const preparation = TOPIC_PREPARATION[topic] || TOPIC_PREPARATION.other;

  // Generate dynamic alerts based on context
  const contextAlerts: { icon: typeof AlertCircle; text: string; type: "warning" | "info" }[] = [];

  if (pendingMaintenanceCount > 0 && topic === "maintenance") {
    contextAlerts.push({
      icon: Wrench,
      text: `${pendingMaintenanceCount} open maintenance item${pendingMaintenanceCount > 1 ? "s" : ""} to discuss`,
      type: "warning",
    });
  }

  if (topic === "monthly_statement" && thisMonthRevenue < lastMonthRevenue * 0.8) {
    contextAlerts.push({
      icon: TrendingUp,
      text: "Revenue is down vs last month - be prepared to explain",
      type: "warning",
    });
  }

  if (upcomingBookingsCount > 0) {
    contextAlerts.push({
      icon: Calendar,
      text: `${upcomingBookingsCount} upcoming booking${upcomingBookingsCount > 1 ? "s" : ""} on the calendar`,
      type: "info",
    });
  }

  if (recentGuestsCount > 0 && topic === "guest_concerns") {
    contextAlerts.push({
      icon: Users,
      text: `${recentGuestsCount} recent guest${recentGuestsCount > 1 ? "s" : ""} in the last 30 days`,
      type: "info",
    });
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">{preparation.title}</h4>
          <p className="text-xs text-muted-foreground">Review before the call</p>
        </div>
      </div>

      {/* Context Alerts */}
      {contextAlerts.length > 0 && (
        <div className="space-y-2">
          {contextAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-sm",
                alert.type === "warning"
                  ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
              )}
            >
              <alert.icon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium">{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preparation Checklist */}
      <div className="space-y-2">
        {preparation.tips.map((tip, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-3 p-2.5 rounded-lg border text-sm",
              getPriorityColor(tip.priority)
            )}
          >
            <tip.icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{tip.text}</p>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] shrink-0 border-current/30",
                tip.priority === "high" && "bg-red-50 dark:bg-red-900/30",
                tip.priority === "medium" && "bg-amber-50 dark:bg-amber-900/30",
                tip.priority === "low" && "bg-green-50 dark:bg-green-900/30"
              )}
            >
              {getPriorityBadge(tip.priority)}
            </Badge>
          </div>
        ))}
      </div>

      {/* Topic Details */}
      {topicDetails && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground font-medium mb-1">Owner's Notes</p>
          <p className="text-sm">{topicDetails}</p>
        </div>
      )}
    </div>
  );
}
