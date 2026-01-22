import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageCircle, 
  Mail, 
  Phone, 
  Clock,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface OwnerCallCommunicationHistoryProps {
  ownerId?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
}

interface Communication {
  id: string;
  type: "sms" | "email" | "call";
  direction: "inbound" | "outbound";
  subject?: string | null;
  body?: string | null;
  created_at: string;
  duration_seconds?: number | null;
}

function getTypeIcon(type: string) {
  switch (type) {
    case "sms":
      return MessageCircle;
    case "email":
      return Mail;
    case "call":
      return Phone;
    default:
      return MessageCircle;
  }
}

function getTypeBadgeColor(type: string) {
  switch (type) {
    case "sms":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700";
    case "email":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700";
    case "call":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700";
    default:
      return "bg-muted";
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function OwnerCallCommunicationHistory({
  ownerId,
  ownerEmail,
  ownerPhone,
}: OwnerCallCommunicationHistoryProps) {
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["owner-call-communications", ownerId, ownerEmail, ownerPhone],
    queryFn: async (): Promise<Communication[]> => {
      const allCommunications: Communication[] = [];

      // Fetch from lead_communications if we have owner_id
      if (ownerId) {
        const { data: leadComms } = await supabase
          .from("lead_communications")
          .select("id, communication_type, direction, subject, body, created_at")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(10);

        leadComms?.forEach((c) => {
          allCommunications.push({
            id: c.id,
            type: c.communication_type as "sms" | "email" | "call",
            direction: c.direction as "inbound" | "outbound",
            subject: c.subject,
            body: c.body,
            created_at: c.created_at,
          });
        });
      }

      // Fetch from user_phone_messages if we have phone
      if (ownerPhone) {
        const normalizedPhone = ownerPhone.replace(/\D/g, "");
        const phoneVariants = [
          normalizedPhone,
          `+1${normalizedPhone}`,
          `+${normalizedPhone}`,
        ];

        const { data: phoneMessages } = await supabase
          .from("user_phone_messages")
          .select("id, direction, body, created_at")
          .or(phoneVariants.map((p) => `from.ilike.%${p}%,to.ilike.%${p}%`).join(","))
          .order("created_at", { ascending: false })
          .limit(10);

        phoneMessages?.forEach((m) => {
          // Avoid duplicates by checking if already in list
          const exists = allCommunications.some(
            (c) => c.body === m.body && Math.abs(new Date(c.created_at).getTime() - new Date(m.created_at).getTime()) < 60000
          );
          if (!exists) {
            allCommunications.push({
              id: m.id,
              type: "sms",
              direction: m.direction as "inbound" | "outbound",
              body: m.body,
              created_at: m.created_at,
            });
          }
        });
      }

      // Sort by date descending and take top 10
      return allCommunications
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
    },
    enabled: !!(ownerId || ownerEmail || ownerPhone),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24 mt-1" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (communications.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Recent Communications</h4>
            <p className="text-xs text-muted-foreground">No recent messages</p>
          </div>
        </div>
        <div className="p-4 rounded-lg border bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">No communication history found</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const smsCount = communications.filter((c) => c.type === "sms").length;
  const emailCount = communications.filter((c) => c.type === "email").length;
  const callCount = communications.filter((c) => c.type === "call").length;
  const lastComm = communications[0];
  const daysSinceLastComm = lastComm
    ? Math.floor((Date.now() - new Date(lastComm.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-3">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Recent Communications</h4>
            <p className="text-xs text-muted-foreground">
              {daysSinceLastComm !== null
                ? daysSinceLastComm === 0
                  ? "Last contact today"
                  : `${daysSinceLastComm} day${daysSinceLastComm !== 1 ? "s" : ""} since last contact`
                : "No recent contact"}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {smsCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              <MessageCircle className="h-2.5 w-2.5 mr-0.5" />
              {smsCount}
            </Badge>
          )}
          {emailCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              <Mail className="h-2.5 w-2.5 mr-0.5" />
              {emailCount}
            </Badge>
          )}
          {callCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              <Phone className="h-2.5 w-2.5 mr-0.5" />
              {callCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Communication List */}
      <ScrollArea className="h-[200px]">
        <div className="space-y-2 pr-3">
          {communications.map((comm) => {
            const TypeIcon = getTypeIcon(comm.type);
            const isInbound = comm.direction === "inbound";

            return (
              <div
                key={comm.id}
                className={cn(
                  "p-2.5 rounded-lg border text-sm",
                  isInbound
                    ? "bg-muted/30 border-l-2 border-l-primary"
                    : "bg-background"
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                      getTypeBadgeColor(comm.type)
                    )}
                  >
                    <TypeIcon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isInbound ? (
                        <ArrowDownLeft className="h-3 w-3 text-green-600" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3 text-blue-600" />
                      )}
                      <span className="text-xs font-medium capitalize">
                        {comm.type} {isInbound ? "received" : "sent"}
                      </span>
                      {comm.type === "call" && comm.duration_seconds && (
                        <Badge variant="outline" className="text-[10px] px-1">
                          {formatDuration(comm.duration_seconds)}
                        </Badge>
                      )}
                    </div>
                    {comm.subject && (
                      <p className="text-xs font-medium truncate text-foreground">
                        {comm.subject}
                      </p>
                    )}
                    {comm.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {comm.body}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="text-[10px]">
                        {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
