import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Building2,
  DollarSign,
  MessageSquare,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  TrendingUp,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Owner360PanelProps {
  ownerId: string;
  ownerName: string;
  className?: string;
  defaultExpanded?: boolean;
}

interface Owner360Context {
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    service_type: string | null;
    created_at: string;
  };
  portfolio: {
    property_count: number;
    properties: Array<{
      id: string;
      name: string;
      address: string;
      management_fee_percentage: number | null;
      status: string | null;
    }>;
    total_monthly_revenue: number;
    avg_occupancy: number;
  };
  financial: {
    ytd_revenue: number;
    ytd_expenses: number;
    ytd_net: number;
    pending_payouts: number;
    last_payout_date: string | null;
    last_payout_amount: number | null;
  };
  communications: {
    total_messages: number;
    sms_count: number;
    email_count: number;
    call_count: number;
    last_contact_date: string | null;
    avg_response_time_hours: number | null;
    mood_score: number;
    mood_label: "positive" | "neutral" | "negative";
  };
  alerts: Array<{
    type: "warning" | "info" | "success";
    icon: string;
    message: string;
    priority: number;
  }>;
  tasks: {
    pending_count: number;
    overdue_count: number;
    pending_tasks: Array<{
      title: string;
      due_date: string | null;
      priority: string;
    }>;
  };
  bookings: {
    upcoming_turnovers: number;
    next_turnover_date: string | null;
    active_bookings: number;
    upcoming_checkouts: Array<{
      property_name: string;
      checkout_date: string;
    }>;
  };
  utility_anomalies: Array<{
    property_name: string;
    utility_type: string;
    change_percent: number;
    current_amount: number;
    previous_amount: number;
  }>;
  ai_summary: string | null;
  generated_at: string;
}

export function Owner360Panel({
  ownerId,
  ownerName,
  className,
  defaultExpanded = false,
}: Owner360PanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: context,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["owner-360-context", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("build-owner-context-360", {
        body: { ownerId },
      });

      if (error) throw error;
      return data as Owner360Context;
    },
    enabled: isExpanded && !!ownerId,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours (matches cache)
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await supabase.functions.invoke("build-owner-context-360", {
        body: { ownerId, forceRefresh: true },
      });
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getMoodEmoji = (label: "positive" | "neutral" | "negative") => {
    switch (label) {
      case "positive":
        return "😊";
      case "negative":
        return "😟";
      default:
        return "😐";
    }
  };

  const getMoodColor = (label: "positive" | "neutral" | "negative") => {
    switch (label) {
      case "positive":
        return "text-green-600";
      case "negative":
        return "text-red-600";
      default:
        return "text-amber-600";
    }
  };

  const getAlertIcon = (type: "warning" | "info" | "success") => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertBg = (type: "warning" | "info" | "success") => {
    switch (type) {
      case "warning":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
      case "success":
        return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
      default:
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800";
    }
  };

  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", className)}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              AI Insights
              <Badge variant="secondary" className="text-xs">
                360°
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              {ownerName}'s portfolio overview
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>Failed to load insights</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </div>
          ) : context ? (
            <div className="p-4 space-y-4">
              {/* AI Summary */}
              {context.ai_summary && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-100 dark:border-violet-800">
                  <p className="text-sm leading-relaxed">{context.ai_summary}</p>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{context.portfolio.property_count}</p>
                    <p className="text-xs text-muted-foreground">Properties</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold flex items-center gap-1">
                      <span className={getMoodColor(context.communications.mood_label)}>
                        {getMoodEmoji(context.communications.mood_label)}
                      </span>
                      <span className="text-sm font-normal capitalize">
                        {context.communications.mood_label}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">Mood (last 5 msgs)</p>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {context.alerts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Alerts & Updates
                  </h4>
                  <div className="space-y-2">
                    {context.alerts.slice(0, 4).map((alert, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg border text-sm",
                          getAlertBg(alert.type)
                        )}
                      >
                        <span className="text-base">{alert.icon}</span>
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Turnovers */}
              {context.bookings.upcoming_checkouts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Upcoming Turnovers
                  </h4>
                  <div className="space-y-1">
                    {context.bookings.upcoming_checkouts.slice(0, 3).map((checkout, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                      >
                        <span className="truncate">{checkout.property_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(checkout.checkout_date), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Tasks */}
              {context.tasks.pending_count > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Pending Tasks
                    {context.tasks.overdue_count > 0 && (
                      <Badge variant="destructive" className="text-xs ml-1">
                        {context.tasks.overdue_count} overdue
                      </Badge>
                    )}
                  </h4>
                  <div className="space-y-1">
                    {context.tasks.pending_tasks.slice(0, 3).map((task, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                      >
                        <span className="truncate flex-1">{task.title}</span>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(task.due_date), "MMM d")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utility Anomalies */}
              {context.utility_anomalies.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Utility Alerts
                  </h4>
                  <div className="space-y-1">
                    {context.utility_anomalies.slice(0, 2).map((anomaly, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                      >
                        <span className="truncate">
                          {anomaly.utility_type} at {anomaly.property_name}
                        </span>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          +{anomaly.change_percent}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              {(context.financial.pending_payouts > 0 || context.financial.last_payout_date) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Financial
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {context.financial.pending_payouts > 0 && (
                      <div className="p-2 rounded bg-muted/30 text-sm">
                        <p className="font-semibold text-green-600">
                          ${context.financial.pending_payouts.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending Payout</p>
                      </div>
                    )}
                    {context.financial.last_payout_date && (
                      <div className="p-2 rounded bg-muted/30 text-sm">
                        <p className="font-semibold">
                          ${context.financial.last_payout_amount?.toLocaleString() || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last payout {formatDistanceToNow(new Date(context.financial.last_payout_date), { addSuffix: true })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>
                  Updated {formatDistanceToNow(new Date(context.generated_at), { addSuffix: true })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
