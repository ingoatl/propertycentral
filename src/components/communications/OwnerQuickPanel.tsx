import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Phone,
  Mail,
  Users,
  ArrowDownLeft,
  Clock,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { OwnerCommunicationDetail } from "./OwnerCommunicationDetail";

interface OwnerWithComms {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastMessage: {
    body: string;
    type: string;
    direction: string;
    created_at: string;
  } | null;
  totalMessages: number;
  unansweredCount: number;
}

export function OwnerQuickPanel() {
  const [selectedOwner, setSelectedOwner] = useState<OwnerWithComms | null>(null);

  // Fetch owners with their recent communications
  const { data: ownersWithComms = [], isLoading } = useQuery({
    queryKey: ["owners-with-comms"],
    queryFn: async () => {
      // Get all owners
      const { data: owners, error: ownersError } = await supabase
        .from("property_owners")
        .select("id, name, email, phone")
        .order("name");

      if (ownersError) throw ownersError;

      // Get communications grouped by owner
      const { data: comms, error: commsError } = await supabase
        .from("lead_communications")
        .select("id, owner_id, communication_type, direction, body, created_at")
        .not("owner_id", "is", null)
        .order("created_at", { ascending: false });

      if (commsError) throw commsError;

      // Group communications by owner
      const commsByOwner: Record<string, typeof comms> = {};
      comms.forEach((comm) => {
        if (comm.owner_id) {
          if (!commsByOwner[comm.owner_id]) {
            commsByOwner[comm.owner_id] = [];
          }
          commsByOwner[comm.owner_id].push(comm);
        }
      });

      // Build owner with comms data
      const result: OwnerWithComms[] = owners.map((owner) => {
        const ownerComms = commsByOwner[owner.id] || [];
        const lastComm = ownerComms[0];
        
        // Count unanswered inbound messages (inbound with no outbound after)
        let unansweredCount = 0;
        const sortedComms = [...ownerComms].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        for (const comm of sortedComms) {
          if (comm.direction === "inbound") {
            unansweredCount++;
          } else if (comm.direction === "outbound") {
            break; // Found our response, stop counting
          }
        }

        return {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          lastMessage: lastComm
            ? {
                body: lastComm.body,
                type: lastComm.communication_type,
                direction: lastComm.direction,
                created_at: lastComm.created_at,
              }
            : null,
          totalMessages: ownerComms.length,
          unansweredCount,
        };
      });

      // Sort by most recent message
      return result.sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
      });
    },
    refetchInterval: 30000,
  });

  const ownersWithMessages = ownersWithComms.filter((o) => o.totalMessages > 0);
  const ownersNeedingResponse = ownersWithComms.filter((o) => o.unansweredCount > 0);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-3 w-3" />;
      case "call":
        return <Phone className="h-3 w-3" />;
      case "email":
        return <Mail className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  return (
    <>
      <Card className="border-purple-200 dark:border-purple-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-purple-500" />
            Owner Communications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-purple-600">{ownersWithMessages.length}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">
                {ownersWithComms.reduce((sum, o) => sum + o.totalMessages, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Messages</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-600">{ownersNeedingResponse.length}</div>
              <div className="text-xs text-muted-foreground">Need Reply</div>
            </div>
          </div>

          {/* Owners needing response */}
          {ownersNeedingResponse.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                <Clock className="h-4 w-4" />
                Needs Response
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {ownersNeedingResponse.slice(0, 5).map((owner) => (
                    <Button
                      key={owner.id}
                      variant="ghost"
                      className="w-full justify-between h-auto py-2 px-3"
                      onClick={() => setSelectedOwner(owner)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-white">
                            {owner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-sm font-medium truncate">{owner.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                            {owner.unansweredCount} unanswered
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Recent owner messages */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Recent Activity</div>
            <ScrollArea className="h-40">
              <div className="space-y-2">
                {ownersWithMessages.slice(0, 8).map((owner) => (
                  <Button
                    key={owner.id}
                    variant="ghost"
                    className="w-full justify-between h-auto py-2 px-3"
                    onClick={() => setSelectedOwner(owner)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-white">
                          {owner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-medium truncate">{owner.name}</div>
                        {owner.lastMessage && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            {getTypeIcon(owner.lastMessage.type)}
                            <span className="truncate">
                              {owner.lastMessage.body.slice(0, 30)}
                              {owner.lastMessage.body.length > 30 ? "..." : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {owner.lastMessage && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(owner.lastMessage.created_at), {
                            addSuffix: false,
                          })}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {owner.totalMessages}
                      </Badge>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Owner Detail Modal */}
      {selectedOwner && (
        <OwnerCommunicationDetail
          ownerId={selectedOwner.id}
          ownerName={selectedOwner.name}
          ownerEmail={selectedOwner.email}
          ownerPhone={selectedOwner.phone}
          isOpen={!!selectedOwner}
          onClose={() => setSelectedOwner(null)}
        />
      )}
    </>
  );
}
