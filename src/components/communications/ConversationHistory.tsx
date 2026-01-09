import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, MessageSquare, Mail, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  body: string | null;
  subject: string | null;
  created_at: string;
  call_duration: number | null;
}

interface ConversationHistoryProps {
  leadId?: string | null;
  ownerId?: string | null;
  maxHeight?: string;
  className?: string;
}

export function ConversationHistory({ 
  leadId, 
  ownerId, 
  maxHeight = "200px",
  className 
}: ConversationHistoryProps) {
  const { data: communications, isLoading } = useQuery({
    queryKey: ["conversation-history", leadId, ownerId],
    queryFn: async () => {
      if (!leadId && !ownerId) return [];
      
      let query = supabase
        .from("lead_communications")
        .select("id, communication_type, direction, body, subject, created_at, call_duration")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (leadId) {
        query = query.eq("lead_id", leadId);
      } else if (ownerId) {
        query = query.eq("owner_id", ownerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Communication[];
    },
    enabled: !!(leadId || ownerId),
    staleTime: 30000, // Cache for 30 seconds
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "call":
        return Phone;
      case "sms":
        return MessageSquare;
      case "email":
        return Mail;
      default:
        return MessageSquare;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-2 p-3 bg-muted/30 rounded-lg", className)}>
        <div className="text-xs font-medium text-muted-foreground mb-2">Conversation History</div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!communications || communications.length === 0) {
    return (
      <div className={cn("p-3 bg-muted/30 rounded-lg", className)}>
        <div className="text-xs font-medium text-muted-foreground mb-2">Conversation History</div>
        <p className="text-xs text-muted-foreground italic">No previous communications found</p>
      </div>
    );
  }

  return (
    <div className={cn("p-3 bg-muted/30 rounded-lg", className)}>
      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
        <span>Conversation History</span>
        <Badge variant="outline" className="text-[10px]">{communications.length} messages</Badge>
      </div>
      <div className="h-[200px] overflow-y-auto pr-2">
        <div className="space-y-2">
          {communications.map((comm) => {
            const Icon = getIcon(comm.communication_type);
            const DirectionIcon = getDirectionIcon(comm.direction);
            const isInbound = comm.direction === "inbound";
            
            return (
              <div 
                key={comm.id} 
                className={cn(
                  "flex items-start gap-2 p-2 rounded-md text-xs",
                  isInbound ? "bg-background" : "bg-primary/5"
                )}
              >
                <div className={cn(
                  "p-1 rounded-full shrink-0",
                  isInbound ? "bg-muted" : "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "h-3 w-3",
                    isInbound ? "text-muted-foreground" : "text-primary"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <DirectionIcon className={cn(
                      "h-3 w-3",
                      isInbound ? "text-green-600" : "text-blue-600"
                    )} />
                    <span className="font-medium capitalize">{comm.communication_type}</span>
                    {comm.call_duration && (
                      <span className="text-muted-foreground">
                        • {formatDuration(comm.call_duration)}
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {comm.subject && (
                    <p className="font-medium text-foreground truncate">{comm.subject}</p>
                  )}
                  {comm.body && (
                    <p className="text-muted-foreground whitespace-pre-wrap break-words">{comm.body}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Export a hook to get conversation context for AI follow-up generation
export function useConversationContext(leadId?: string | null, ownerId?: string | null) {
  return useQuery({
    queryKey: ["conversation-context", leadId, ownerId],
    queryFn: async () => {
      if (!leadId && !ownerId) return { messages: [], summary: "", contextForAI: "" };
      
      let query = supabase
        .from("lead_communications")
        .select("id, communication_type, direction, body, subject, created_at")
        .order("created_at", { ascending: true })
        .limit(15); // Get more messages for better context
      
      if (leadId) {
        query = query.eq("lead_id", leadId);
      } else if (ownerId) {
        query = query.eq("owner_id", ownerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const messages = (data || []) as Communication[];
      
      // Build detailed context for AI - include FULL message content
      const contextParts: string[] = [];
      const pendingRequests: string[] = [];
      let hasAskedForInfo = false;
      let lastOutboundAsk: string | null = null;
      
      messages.forEach((msg) => {
        const direction = msg.direction === "inbound" ? "THEM" : "US";
        const type = msg.communication_type.toUpperCase();
        const dateStr = format(new Date(msg.created_at), "MMM d 'at' h:mma");
        
        if (msg.body) {
          // Include full body content for context
          contextParts.push(`[${dateStr}] [${type}] ${direction}: ${msg.body}`);
          
          // Track what WE asked for
          if (msg.direction === "outbound") {
            const bodyLower = msg.body.toLowerCase();
            if (bodyLower.includes("address") || bodyLower.includes("send me") || 
                bodyLower.includes("please") || bodyLower.includes("can you") ||
                bodyLower.includes("let me know") || bodyLower.includes("need")) {
              hasAskedForInfo = true;
              lastOutboundAsk = msg.body;
              
              // Extract what we specifically asked for
              if (bodyLower.includes("address")) pendingRequests.push("their address");
              if (bodyLower.includes("insurance")) pendingRequests.push("insurance documents");
              if (bodyLower.includes("income") || bodyLower.includes("report")) pendingRequests.push("income report info");
              if (bodyLower.includes("document")) pendingRequests.push("documents");
            }
          }
        }
      });
      
      // Build a summary focusing on outstanding requests
      let summary = contextParts.join("\n");
      
      // Add explicit note about what we're waiting for
      let contextForAI = summary;
      if (pendingRequests.length > 0) {
        contextForAI += `\n\nIMPORTANT: We previously asked them for: ${pendingRequests.join(", ")}. Reference this in follow-up.`;
      }
      if (lastOutboundAsk) {
        contextForAI += `\n\nOur last request was: "${lastOutboundAsk.slice(0, 200)}"`;
      }
      
      return {
        messages,
        summary,
        contextForAI,
        lastMessage: messages[messages.length - 1] || null,
        hasAskedForInfo,
        pendingRequests,
        lastOutboundAsk,
      };
    },
    enabled: !!(leadId || ownerId),
    staleTime: 30000,
  });
}
