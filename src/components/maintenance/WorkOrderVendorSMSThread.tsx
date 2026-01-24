import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send, CheckCheck, Clock, Image, FileVideo, Play, Mic } from "lucide-react";
import { format } from "date-fns";

interface WorkOrderVendorSMSThreadProps {
  workOrderId: string;
  vendorId?: string;
  vendorPhone?: string;
  vendorName?: string;
  onSendMessage?: () => void;
}

export function WorkOrderVendorSMSThread({
  workOrderId,
  vendorId,
  vendorPhone,
  vendorName,
  onSendMessage,
}: WorkOrderVendorSMSThreadProps) {
  // Fetch SMS messages related to this work order
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["work-order-sms", workOrderId, vendorId],
    queryFn: async () => {
      // Get all SMS communications
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("communication_type", "sms")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filter by work order ID or vendor ID/phone in metadata
      const normalizedVendorPhone = vendorPhone?.replace(/\D/g, "").slice(-10);
      
      return (data || []).filter((msg) => {
        const meta = msg.metadata as any;
        // Match by work order ID
        if (meta?.work_order_id === workOrderId) return true;
        // Match by vendor ID
        if (vendorId && meta?.vendor_id === vendorId) return true;
        // Match by phone number
        if (normalizedVendorPhone) {
          const metaPhone = meta?.vendor_phone || meta?.to_number || meta?.ghl_data?.contactPhone;
          if (metaPhone && metaPhone.replace(/\D/g, "").slice(-10) === normalizedVendorPhone) {
            return true;
          }
        }
        return false;
      });
    },
    enabled: !!(workOrderId || vendorId || vendorPhone),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-3/4 ml-auto" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No SMS history with this vendor</p>
            {onSendMessage && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                onClick={onSendMessage}
              >
                <Send className="h-4 w-4" />
                Send First Message
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          SMS History
          <Badge variant="secondary" className="ml-1 text-xs">
            {messages.length}
          </Badge>
        </CardTitle>
        {onSendMessage && (
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={onSendMessage}>
            <Send className="h-3.5 w-3.5" />
            New Message
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          <div className="space-y-3">
            {messages.map((msg: any) => {
              const isOutbound = msg.direction === "outbound";
              const meta = msg.metadata as any;
              const hasAttachments = meta?.attachments?.length > 0;
              const hasVoicemail = meta?.audio_url || meta?.player_url;
              const hasVideo = meta?.video_url;
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] ${isOutbound ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isOutbound
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      
                      {/* Media attachments */}
                      {hasAttachments && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {meta.attachments.map((att: any, idx: number) => {
                            const isImage = att.type === "image" || att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                            return (
                              <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-16 w-16 rounded-lg overflow-hidden border border-primary-foreground/20"
                              >
                                {isImage ? (
                                  <img src={att.url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center bg-background/20">
                                    <FileVideo className="h-6 w-6" />
                                  </div>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Voice message */}
                      {hasVoicemail && (
                        <a
                          href={meta.player_url || meta.audio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-background/20 text-xs"
                        >
                          <div className="h-8 w-8 rounded-full bg-background/30 flex items-center justify-center">
                            <Mic className="h-4 w-4" />
                          </div>
                          <span>Voice Message</span>
                          <Play className="h-3 w-3 ml-auto" />
                        </a>
                      )}
                      
                      {/* Video message */}
                      {hasVideo && !hasVoicemail && (
                        <a
                          href={meta.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-background/20 text-xs"
                        >
                          <div className="h-8 w-8 rounded-full bg-background/30 flex items-center justify-center">
                            <FileVideo className="h-4 w-4" />
                          </div>
                          <span>Video Message</span>
                          <Play className="h-3 w-3 ml-auto" />
                        </a>
                      )}
                    </div>
                    
                    {/* Status & timestamp */}
                    <div className={`flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground ${isOutbound ? "justify-end" : ""}`}>
                      {isOutbound && (
                        <>
                          {msg.status === "sent" || msg.status === "delivered" ? (
                            <CheckCheck className="h-3 w-3 text-primary" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                        </>
                      )}
                      {format(new Date(msg.created_at), "MMM d, h:mm a")}
                      {isOutbound && meta?.alex_routed && (
                        <span className="text-muted-foreground/60">• via Alex</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
