import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, CheckCheck, Phone, Send } from "lucide-react";
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
  // Fetch all SMS communications related to this work order or vendor
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["work-order-sms-thread", workOrderId, vendorId, vendorPhone],
    queryFn: async () => {
      // Get communications that match:
      // 1. work_order_id in metadata
      // 2. vendor_id in metadata
      // 3. vendor_phone in metadata matching this vendor's phone
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("communication_type", "sms")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filter for messages related to this work order or vendor
      const normalizePhone = (phone: string) => phone?.replace(/\D/g, '').slice(-10);
      const vendorPhoneNormalized = vendorPhone ? normalizePhone(vendorPhone) : null;

      return (data || []).filter((msg: any) => {
        const meta = msg.metadata as any;
        
        // Match by work order ID
        if (meta?.work_order_id === workOrderId) return true;
        
        // Match by vendor ID
        if (vendorId && meta?.vendor_id === vendorId) return true;
        
        // Match by vendor phone
        if (vendorPhoneNormalized) {
          const msgPhone = meta?.vendor_phone || meta?.to_number || meta?.ghl_data?.contactPhone;
          if (msgPhone && normalizePhone(msgPhone) === vendorPhoneNormalized) return true;
        }
        
        return false;
      });
    },
    enabled: !!(workOrderId && (vendorId || vendorPhone)),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No SMS History</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No text messages have been exchanged with this vendor for this work order yet.
          </p>
          {onSendMessage && (
            <Button onClick={onSendMessage} size="sm">
              <Send className="h-4 w-4 mr-2" />
              Send First Message
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              SMS Thread with {vendorName || 'Vendor'}
            </span>
          </div>
          {onSendMessage && (
            <Button variant="outline" size="sm" onClick={onSendMessage}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              New Message
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-4">
            {messages.map((msg: any) => {
              const isOutbound = msg.direction === "outbound";
              const meta = msg.metadata as any;
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${isOutbound ? 'items-end' : 'items-start'}`}>
                    {/* Sender info */}
                    <div className={`flex items-center gap-2 mb-1 text-xs text-muted-foreground ${isOutbound ? 'justify-end' : ''}`}>
                      {!isOutbound && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Vendor
                        </Badge>
                      )}
                      <span>{format(new Date(msg.created_at), "MMM d, h:mm a")}</span>
                      {isOutbound && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                          PM
                        </Badge>
                      )}
                    </div>
                    
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isOutbound
                          ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    </div>
                    
                    {/* Status indicator for outbound */}
                    {isOutbound && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground justify-end">
                        <CheckCheck className="h-3 w-3" />
                        <span className="capitalize">{msg.status || 'sent'}</span>
                        {meta?.alex_routed && (
                          <span className="text-[10px] opacity-60">• via Alex</span>
                        )}
                      </div>
                    )}
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
