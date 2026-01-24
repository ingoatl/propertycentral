import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MessageCircle, Play, Video, Mic, Clock, User, Mail, Phone, ArrowRight, ArrowLeft, RefreshCw, Building2 } from "lucide-react";
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

  // Helper to detect if a communication is a voicemail/video notification
  const isVoicemailNotification = (comm: Communication): boolean => {
    const body = comm.body?.toLowerCase() || "";
    return (
      body.includes("voice message") || 
      body.includes("video message") ||
      body.includes("voicemail") ||
      body.includes("left you a voice") ||
      body.includes("/vm/")
    );
  };

  // Detect if the communication is a video message (not audio)
  const isVideoMessage = (body: string | null): boolean => {
    if (!body) return false;
    return body.includes("🎬") || body.toLowerCase().includes("video message");
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
                    isVideoMessage={isVideoMessage}
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
                    isVideoMessage={isVideoMessage}
                  />
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VoicemailCard({ message }: { message: any }) {
  const isVideo = message.media_type === "video";
  
  // Determine the correct playback URL based on media type
  const getPlaybackUrl = () => {
    // If there's a direct audio/video URL stored, use that
    if (isVideo && message.video_url) {
      return message.video_url;
    }
    if (!isVideo && message.audio_url) {
      return message.audio_url;
    }
    // Fall back to the token-based URL with proper query param for media type
    return `/vm/${message.token}${isVideo ? '?type=video' : ''}`;
  };

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            isVideo 
              ? "bg-accent" 
              : "bg-primary/10"
          )}>
            {isVideo ? (
              <Video className="h-6 w-6 text-accent-foreground" />
            ) : (
              <Mic className="h-6 w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">
                {message.sender_name || message.recipient_name || "Property Manager"}
              </span>
              <Badge variant="outline" className="text-xs">
                {isVideo ? "Video" : "Voicemail"}
              </Badge>
              {message.status === "listened" && (
                <Badge variant="secondary" className="text-xs">Played</Badge>
              )}
              {message.direction === "outbound" && (
                <Badge variant="secondary" className="text-xs text-emerald-600">Sent</Badge>
              )}
            </div>

            {message.message_text && message.message_text !== "(Voice recording)" && message.message_text !== "(Video message)" && (
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
              href={getPlaybackUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Play className="h-4 w-4" />
              {isVideo ? "Watch" : "Listen"}
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

// New component for voicemails/videos detected from lead_communications
function VoicemailFromCommCard({ 
  communication,
  extractVoicemailUrl,
  extractVoicemailTranscript,
  isVideoMessage
}: { 
  communication: Communication;
  extractVoicemailUrl: (body: string | null) => string | null;
  extractVoicemailTranscript: (body: string | null) => string | null;
  isVideoMessage: (body: string | null) => boolean;
}) {
  const voicemailUrl = extractVoicemailUrl(communication.body);
  const transcript = extractVoicemailTranscript(communication.body);
  const isVideo = isVideoMessage(communication.body);
  
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            isVideo ? "bg-accent" : "bg-primary/10"
          )}>
            {isVideo ? (
              <Video className="h-6 w-6 text-accent-foreground" />
            ) : (
              <Mic className="h-6 w-6 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">Property Manager</span>
              <Badge variant="outline" className={cn(
                "text-xs",
                isVideo 
                  ? "bg-sky-50 text-sky-700 border-sky-200" 
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {isVideo ? "Video" : "Voicemail"}
              </Badge>
              <Badge variant="secondary" className="text-xs">Sent</Badge>
            </div>

            {!isVideo && transcript && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                "{transcript}"
              </p>
            )}

            {isVideo && (
              <p className="text-sm text-muted-foreground mb-2">
                "(Video message)"
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
              variant={isVideo ? "outline" : "default"}
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
                {isVideo ? "Watch" : "Listen"}
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
  // Determine if this message is from the owner (inbound) or property manager (outbound)
  const isFromOwner = communication.direction === "inbound";
  
  // Clear sender label - Owner messages say their name or "You", manager messages say "PeachHaus"
  const senderLabel = isFromOwner 
    ? (communication.from_name || "You")
    : "PeachHaus";
  
  return (
    <Card className={cn(
      "border shadow-sm hover:shadow-md transition-shadow",
      isFromOwner 
        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-l-4 border-l-emerald-400"
        : "bg-sky-50/50 dark:bg-sky-950/20 border-l-4 border-l-sky-400"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            isFromOwner 
              ? "bg-emerald-100 dark:bg-emerald-900/30" 
              : "bg-sky-100 dark:bg-sky-900/30"
          )}>
            {isFromOwner ? (
              <User className="h-5 w-5 text-emerald-600" />
            ) : (
              <Building2 className="h-5 w-5 text-sky-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {/* Clear sender badge */}
              <Badge className={cn(
                "text-xs font-medium",
                isFromOwner
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/50 dark:text-sky-300"
              )}>
                {senderLabel}
              </Badge>
              <div className="flex items-center gap-1">
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
