import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MessageSquare, FileText, Eye, CheckCircle, Clock, Loader2 } from "lucide-react";

interface ConversationHistoryProps {
  onViewConversation: (id: string) => void;
}

interface Conversation {
  id: string;
  title: string;
  status: string;
  conversation_date: string;
  created_at: string;
  ai_summary: string;
  property: {
    name: string;
    address: string;
  };
  owner_conversation_documents: { id: string }[];
  owner_conversation_actions: { id: string; status: string; action_type: string }[];
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-gray-500", icon: Clock },
  analyzing: { label: "Analyzing", color: "bg-blue-500", icon: Loader2 },
  analyzed: { label: "Analyzed", color: "bg-amber-500", icon: MessageSquare },
  completed: { label: "Completed", color: "bg-green-500", icon: CheckCircle },
};

export function ConversationHistory({ onViewConversation }: ConversationHistoryProps) {
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["owner-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_conversations")
        .select(`
          id,
          title,
          status,
          conversation_date,
          created_at,
          ai_summary,
          property:properties(name, address),
          owner_conversation_documents(id),
          owner_conversation_actions(id, status, action_type)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Conversation[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </CardContent>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No conversations yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a transcript or documents to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Conversation History</CardTitle>
          <CardDescription>
            View and manage previously analyzed owner conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversations.map((conversation) => {
              const status = statusConfig[conversation.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const docsCount = conversation.owner_conversation_documents?.length || 0;
              const actionsCount = conversation.owner_conversation_actions?.length || 0;
              const createdCount = conversation.owner_conversation_actions?.filter(
                a => a.status === "created"
              ).length || 0;

              return (
                <div
                  key={conversation.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium truncate">{conversation.title}</h3>
                        <Badge
                          variant="secondary"
                          className={`text-white ${status.color}`}
                        >
                          <StatusIcon className={`h-3 w-3 mr-1 ${
                            conversation.status === "analyzing" ? "animate-spin" : ""
                          }`} />
                          {status.label}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-1">
                        {conversation.property?.name} - {conversation.property?.address}
                      </p>

                      {conversation.ai_summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {conversation.ai_summary}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(conversation.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        {docsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {docsCount} doc{docsCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {actionsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {createdCount}/{actionsCount} items created
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewConversation(conversation.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
