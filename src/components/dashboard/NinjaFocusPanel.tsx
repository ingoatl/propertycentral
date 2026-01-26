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
  Settings,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CallDialog } from "@/components/communications/CallDialog";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";
import { useNavigate } from "react-router-dom";

interface NinjaFocusItem {
  priority: "critical" | "high" | "medium";
  action: string;
  reason: string;
  source: "email" | "task" | "call" | "system";
  link?: string;
  // Actionable fields
  actionType?: "call" | "email" | "sms" | "view";
  contactId?: string;
  contactType?: "lead" | "owner" | "vendor" | "guest";
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface NinjaPlan {
  greeting: string;
  topPriorities: NinjaFocusItem[];
  quickWins: NinjaFocusItem[];
  proactiveSuggestions: string[];
}

const priorityStyles = {
  critical: "bg-destructive/10 border-destructive/30 text-destructive",
  high: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300",
  medium: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300",
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
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{
    name: string;
    phone?: string;
    email?: string;
    leadId?: string;
    ownerId?: string;
  } | null>(null);

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

  const handleActionClick = (item: NinjaFocusItem) => {
    // If there's a specific action type, handle it
    if (item.actionType === "call" && item.contactPhone) {
      setSelectedContact({
        name: item.contactName || "Unknown",
        phone: item.contactPhone,
        leadId: item.contactType === "lead" ? item.contactId : undefined,
        ownerId: item.contactType === "owner" ? item.contactId : undefined,
      });
      setShowCallDialog(true);
      return;
    }

    if (item.actionType === "email" && item.contactEmail) {
      setSelectedContact({
        name: item.contactName || "Unknown",
        email: item.contactEmail,
        leadId: item.contactType === "lead" ? item.contactId : undefined,
        ownerId: item.contactType === "owner" ? item.contactId : undefined,
      });
      setShowEmailDialog(true);
      return;
    }

    // If there's a link, navigate to it
    if (item.link) {
      if (item.link.startsWith("http")) {
        window.open(item.link, "_blank");
      } else {
        navigate(item.link);
      }
      return;
    }

    // Fallback: navigate to relevant section based on source
    if (item.source === "email") {
      navigate("/inbox");
    } else if (item.source === "task") {
      navigate("/tasks");
    } else if (item.source === "call") {
      navigate("/");
    }
  };

  const getActionBadge = (item: NinjaFocusItem) => {
    if (item.actionType === "call" && item.contactPhone) {
      return (
        <Badge variant="outline" className="text-xs gap-1 h-5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
          <Phone className="h-3 w-3" />
          Call
        </Badge>
      );
    }
    if (item.actionType === "email" && item.contactEmail) {
      return (
        <Badge variant="outline" className="text-xs gap-1 h-5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
          <Mail className="h-3 w-3" />
          Email
        </Badge>
      );
    }
    if (item.actionType === "sms" && item.contactPhone) {
      return (
        <Badge variant="outline" className="text-xs gap-1 h-5 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
          <MessageSquare className="h-3 w-3" />
          SMS
        </Badge>
      );
    }
    if (item.link) {
      return (
        <Badge variant="outline" className="text-xs gap-1 h-5">
          <ExternalLink className="h-3 w-3" />
          View
        </Badge>
      );
    }
    return null;
  };

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
    <>
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
                    const isActionable = item.actionType || item.link;
                    return (
                      <div
                        key={index}
                        onClick={() => handleActionClick(item)}
                        className={cn(
                          "p-3 rounded-lg border transition-all",
                          priorityStyles[item.priority],
                          isActionable && "cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.99]"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{priorityIcons[item.priority]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{item.action}</span>
                              {getActionBadge(item) || (
                                <Badge variant="outline" className="text-xs gap-1 h-5">
                                  <SourceIcon className="h-3 w-3" />
                                  {item.source}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                            {item.contactName && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">
                                Contact: {item.contactName}
                              </p>
                            )}
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
                    const isActionable = item.actionType || item.link;
                    return (
                      <div
                        key={index}
                        onClick={() => handleActionClick(item)}
                        className={cn(
                          "p-2.5 rounded-lg border border-border bg-muted/30 flex items-center gap-3 transition-all",
                          isActionable && "cursor-pointer hover:bg-muted/50 hover:ring-1 hover:ring-primary/20"
                        )}
                      >
                        <Zap className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        {getActionBadge(item) || (
                          <Badge variant="secondary" className="text-xs gap-1 h-5 flex-shrink-0">
                            <SourceIcon className="h-3 w-3" />
                          </Badge>
                        )}
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

      {/* Call Dialog */}
      {showCallDialog && selectedContact && selectedContact.phone && (
        <CallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          contactPhone={selectedContact.phone}
          contactName={selectedContact.name}
          contactType={selectedContact.leadId ? "lead" : selectedContact.ownerId ? "owner" : "lead"}
          leadId={selectedContact.leadId || null}
          ownerId={selectedContact.ownerId || null}
        />
      )}

      {/* Email Dialog */}
      {showEmailDialog && selectedContact && selectedContact.email && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contactEmail={selectedContact.email}
          contactName={selectedContact.name}
          contactType={selectedContact.leadId ? "lead" : "owner"}
          contactId={selectedContact.leadId || selectedContact.ownerId || ""}
        />
      )}
    </>
  );
}