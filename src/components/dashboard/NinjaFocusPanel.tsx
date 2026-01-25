import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  Zap, 
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Mail,
  CheckSquare,
  Phone,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NinjaFocusItem {
  priority: "critical" | "high" | "medium";
  action: string;
  reason: string;
  source: "email" | "task" | "call" | "system";
  link?: string;
}

interface NinjaPlan {
  greeting: string;
  topPriorities: NinjaFocusItem[];
  quickWins: NinjaFocusItem[];
  proactiveSuggestions: string[];
}

const priorityStyles = {
  critical: "bg-destructive/10 border-destructive/30 text-destructive",
  high: "bg-orange-500/10 border-orange-500/30 text-orange-700",
  medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700",
};

const priorityIcons = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
};

const sourceIcons = {
  email: Mail,
  task: CheckSquare,
  call: Phone,
  system: Settings,
};

export function NinjaFocusPanel() {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["ninja-plan"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-ninja-plan");
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to generate plan");
      return data.plan as NinjaPlan;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <Skeleton className="h-6 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="py-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load your ninja plan</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">🥷</span>
            <span>Your Ninja Plan</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{data.greeting}</p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-5 pt-2">
          {/* Top Priorities */}
          {data.topPriorities.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Top Priorities
              </h4>
              <div className="space-y-2">
                {data.topPriorities.map((item, index) => {
                  const SourceIcon = sourceIcons[item.source] || Settings;
                  return (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-lg border",
                        priorityStyles[item.priority]
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg">{priorityIcons[item.priority]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{item.action}</span>
                            <Badge variant="outline" className="text-xs gap-1 h-5">
                              <SourceIcon className="h-3 w-3" />
                              {item.source}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Wins */}
          {data.quickWins.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                Quick Wins
              </h4>
              <div className="grid gap-2">
                {data.quickWins.map((item, index) => {
                  const SourceIcon = sourceIcons[item.source] || Settings;
                  return (
                    <div
                      key={index}
                      className="p-2.5 rounded-lg border border-border bg-muted/30 flex items-center gap-3"
                    >
                      <Zap className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className="text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs gap-1 h-5 flex-shrink-0">
                        <SourceIcon className="h-3 w-3" />
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proactive Suggestions */}
          {data.proactiveSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                Proactive Insights
              </h4>
              <div className="space-y-1.5">
                {data.proactiveSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2"
                  >
                    <span className="text-blue-500">💡</span>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
