import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircle, Play, Video, Mic, ExternalLink, Clock, User } from "lucide-react";
import { format } from "date-fns";

interface OwnerMessagesTabProps {
  ownerId: string;
}

export function OwnerMessagesTab({ ownerId }: OwnerMessagesTabProps) {
  const { data: messages, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading messages...
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Card className="border-none shadow-lg">
        <CardContent className="py-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Messages Yet</h3>
          <p className="text-muted-foreground">
            Voice and video messages from your property manager will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages
        </h2>
        <Badge variant="secondary">{messages.length} message{messages.length !== 1 ? "s" : ""}</Badge>
      </div>

      <div className="grid gap-4">
        {messages.map((message) => (
          <Card key={message.id} className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Media type icon */}
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

                {/* Message content */}
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

                  {/* Transcript preview */}
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

                {/* Play button */}
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

              {/* Reply indicator */}
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
        ))}
      </div>
    </div>
  );
}
