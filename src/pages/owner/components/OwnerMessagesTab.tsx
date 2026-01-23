import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MessageCircle, Play, Video, Mic, Clock, User, Mail, Phone, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface OwnerMessagesTabProps {
  ownerId: string;
  propertyId?: string;
}

interface Communication {
  id: string;
  direction: string | null;
  communication_type: string | null;
  body: string | null;
  sent_at: string | null;
  created_at: string;
  subject: string | null;
  status: string | null;
  from_name?: string | null;
  from_email?: string | null;
  from_phone?: string | null;
}

export function OwnerMessagesTab({ ownerId, propertyId }: OwnerMessagesTabProps) {
  // Fetch voicemail messages
  const { data: voicemails, isLoading: voicemailsLoading } = useQuery({
    queryKey: ["owner-voicemail-messages", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voicemail_messages")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!ownerId,
  });

  // Fetch lead communications for owner's properties
  const { data: communications, isLoading: communicationsLoading, refetch: refetchCommunications } = useQuery({
    queryKey: ["owner-communications", ownerId, propertyId],
    queryFn: async () => {
      // First get all properties linked to this owner
      const { data: ownerProperties, error: propsError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerId);

      if (propsError) throw propsError;

      const propertyIds = ownerProperties?.map(p => p.id) || [];
      if (propertyIds.length === 0) return [];

      // Get leads for these properties
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id")
        .in("property_id", propertyIds);

      if (leadsError) throw leadsError;

      const leadIds = leads?.map(l => l.id) || [];
      if (leadIds.length === 0) return [];

      // Get communications for these leads
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as unknown as Communication[];
    },
    enabled: !!ownerId,
  });

  // Fetch owner-specific communications (direct owner communications)
  const { data: ownerComms, isLoading: ownerCommsLoading } = useQuery({
    queryKey: ["owner-direct-communications", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as Communication[];
    },
    enabled: !!ownerId,
  });

  const isLoading = voicemailsLoading || communicationsLoading || ownerCommsLoading;

  // Helper to detect if a communication is a voicemail notification
  const isVoicemailNotification = (comm: Communication): boolean => {
    const body = comm.body?.toLowerCase() || "";
    return (
      body.includes("voice message") || 
      body.includes("voicemail") ||
      body.includes("left you a voice") ||
      body.includes("/vm/")
    );
  };

  // Extract voicemail URL from body
  const extractVoicemailUrl = (body: string | null): string | null => {
    if (!body) return null;
    const match = body.match(/https?:\/\/[^\s]+\/vm\/[^\s]+/);
    return match ? match[0] : null;
  };

  // Extract voicemail transcript from body
  const extractVoicemailTranscript = (body: string | null): string | null => {
    if (!body) return null;
    const match = body.match(/"([^"]+)"/);
    return match ? match[1] : null;
  };

  // Combine all communications
  const allCommunications = [
    ...(communications || []),
    ...(ownerComms || []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Deduplicate by id
  const uniqueCommunications = allCommunications.filter(
    (comm, index, self) => index === self.findIndex(c => c.id === comm.id)
  );

  // Separate voicemail notifications from regular communications
  const voicemailNotifications = uniqueCommunications.filter(isVoicemailNotification);
  const regularCommunications = uniqueCommunications.filter(c => !isVoicemailNotification(c));

  // Combine voicemails from both sources
  const allVoicemails = [
    ...(voicemails || []).map(v => ({ source: 'table' as const, data: v })),
    ...voicemailNotifications.map(c => ({ source: 'comm' as const, data: c })),
  ];

  const getChannelIcon = (channel: string | null) => {
    switch (channel?.toLowerCase()) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sms":
      case "phone":
      case "call":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getDirectionIcon = (direction: string | null) => {
    return direction === "inbound" ? (
      <ArrowLeft className="h-3 w-3 text-emerald-500" />
    ) : (
      <ArrowRight className="h-3 w-3 text-sky-500" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading messages...
        </div>
      </div>
    );
  }

  const hasVoicemails = allVoicemails.length > 0;
  const hasCommunications = regularCommunications.length > 0;
  const hasAnyMessages = hasVoicemails || hasCommunications;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchCommunications()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant="secondary">
            {allVoicemails.length + regularCommunications.length} total
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All ({allVoicemails.length + regularCommunications.length})</TabsTrigger>
          <TabsTrigger value="communications">Communications ({regularCommunications.length})</TabsTrigger>
          <TabsTrigger value="voicemails">Voicemails ({allVoicemails.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {/* Mix and sort all messages by date */}
          {[
            ...allVoicemails.map(v => ({ 
              type: 'voicemail' as const, 
              data: v, 
              date: new Date(v.source === 'table' ? v.data.created_at : v.data.created_at) 
            })),
            ...regularCommunications.map(c => ({ type: 'communication' as const, data: c, date: new Date(c.created_at) })),
          ]
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 50)
            .map((item) => 
              item.type === 'voicemail' 
                ? item.data.source === 'table'
                  ? <VoicemailCard key={`vm-${item.data.data.id}`} message={item.data.data} />
                  : <VoicemailFromCommCard 
                      key={`vm-comm-${item.data.data.id}`} 
                      communication={item.data.data as Communication} 
                      extractVoicemailUrl={extractVoicemailUrl}
                      extractVoicemailTranscript={extractVoicemailTranscript}
                    />
                : <CommunicationCard key={`comm-${(item.data as Communication).id}`} communication={item.data as Communication} getChannelIcon={getChannelIcon} getDirectionIcon={getDirectionIcon} />
            )}
        </TabsContent>

        <TabsContent value="communications" className="mt-4 space-y-3">
          {regularCommunications.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No communications yet
              </CardContent>
            </Card>
          ) : (
            regularCommunications.slice(0, 50).map((comm) => (
              <CommunicationCard 
                key={comm.id} 
                communication={comm}
                getChannelIcon={getChannelIcon}
                getDirectionIcon={getDirectionIcon}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="voicemails" className="mt-4 space-y-3">
          {!hasVoicemails ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No voicemails yet
              </CardContent>
            </Card>
          ) : (
            allVoicemails.map((vm) => 
              vm.source === 'table' 
                ? <VoicemailCard key={`vm-${vm.data.id}`} message={vm.data} />
                : <VoicemailFromCommCard 
                    key={`vm-comm-${vm.data.id}`} 
                    communication={vm.data as Communication} 
                    extractVoicemailUrl={extractVoicemailUrl}
                    extractVoicemailTranscript={extractVoicemailTranscript}
                  />
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoicemailCard({ message }: { message: any }) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            message.media_type === "video" 
              ? "bg-accent" 
              : "bg-primary/10"
          )}>
            {message.media_type === "video" ? (
              <Video className="h-6 w-6 text-accent-foreground" />
            ) : (
              <Mic className="h-6 w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">
                {message.sender_name || "Property Manager"}
              </span>
              <Badge variant="outline" className="text-xs">
                {message.media_type === "video" ? "Video" : "Voice"}
              </Badge>
              {message.status === "listened" && (
                <Badge variant="secondary" className="text-xs">Played</Badge>
              )}
            </div>

            {message.message_text && message.message_text !== "(Voice recording)" && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                "{message.message_text}"
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(message.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
              {message.duration_seconds && (
                <span>
                  {Math.floor(message.duration_seconds / 60)}:{String(Math.floor(message.duration_seconds % 60)).padStart(2, "0")}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="shrink-0 gap-2"
          >
            <a
              href={`/vm/${message.token}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Play className="h-4 w-4" />
              {message.media_type === "video" ? "Watch" : "Listen"}
            </a>
          </Button>
        </div>

        {message.reply_audio_url && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>You replied</span>
              {message.reply_transcript && (
                <span className="text-xs">• "{message.reply_transcript.substring(0, 50)}..."</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// New component for voicemails detected from lead_communications
function VoicemailFromCommCard({ 
  communication,
  extractVoicemailUrl,
  extractVoicemailTranscript
}: { 
  communication: Communication;
  extractVoicemailUrl: (body: string | null) => string | null;
  extractVoicemailTranscript: (body: string | null) => string | null;
}) {
  const voicemailUrl = extractVoicemailUrl(communication.body);
  const transcript = extractVoicemailTranscript(communication.body);
  
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
            <Mic className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">Property Manager</span>
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                Voicemail
              </Badge>
              <Badge variant="secondary" className="text-xs">Sent</Badge>
            </div>

            {transcript && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                "{transcript}"
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(communication.sent_at || communication.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>

          {voicemailUrl && (
            <Button
              variant="default"
              size="sm"
              asChild
              className="shrink-0 gap-2"
            >
              <a
                href={voicemailUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Play className="h-4 w-4" />
                Listen
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CommunicationCard({ 
  communication, 
  getChannelIcon, 
  getDirectionIcon 
}: { 
  communication: Communication;
  getChannelIcon: (channel: string | null) => React.ReactNode;
  getDirectionIcon: (direction: string | null) => React.ReactNode;
}) {
  const senderDisplay = communication.from_name || communication.from_email || communication.from_phone || "Property Manager";
  
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            communication.direction === "inbound" 
              ? "bg-emerald-100 dark:bg-emerald-900/30" 
              : "bg-sky-100 dark:bg-sky-900/30"
          )}>
            {getChannelIcon(communication.communication_type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium">{senderDisplay}</span>
              <div className="flex items-center gap-1">
                {getDirectionIcon(communication.direction)}
                <Badge variant="outline" className="text-xs capitalize">
                  {communication.communication_type || "message"}
                </Badge>
              </div>
              {communication.status && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {communication.status}
                </Badge>
              )}
            </div>

            {communication.subject && (
              <p className="text-sm font-medium text-foreground mb-1">
                {communication.subject}
              </p>
            )}

            {communication.body && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {communication.body}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(communication.sent_at || communication.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
