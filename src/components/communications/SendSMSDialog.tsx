import { useState } from "react";
import { Send, MessageSquare, Clock, CheckCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface SendSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  contactType: "lead" | "owner";
  contactId: string;
}

const SMS_TEMPLATES = [
  {
    label: "Quick Check-in",
    content: "Hi {{name}}, just checking in to see if you have any questions about your property. Let me know if there's anything I can help with!",
  },
  {
    label: "Follow Up",
    content: "Hi {{name}}, following up on our recent conversation. Would you have some time this week to discuss further?",
  },
  {
    label: "Property Walkthrough",
    content: "Hi {{name}}, I'd love to schedule a walkthrough of your property. What times work best for you this week?",
  },
  {
    label: "Confirm Appointment",
    content: "Hi {{name}}, just confirming our meeting scheduled for tomorrow. Please let me know if that still works for you!",
  },
  {
    label: "Thank You",
    content: "Hi {{name}}, thank you for taking the time to speak with me today. I'll follow up with the information we discussed shortly.",
  },
];

export function SendSMSDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  contactType,
  contactId,
}: SendSMSDialogProps) {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  // Fetch recent communications for this contact
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["contact-sms-history", contactType, contactId],
    queryFn: async () => {
      if (contactType === "lead") {
        const { data } = await supabase
          .from("lead_communications")
          .select("*")
          .eq("lead_id", contactId)
          .eq("communication_type", "sms")
          .order("created_at", { ascending: false })
          .limit(10);
        return data || [];
      }
      return [];
    },
    enabled: open,
  });

  const sendSMS = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-review-sms", {
        body: {
          to: contactPhone,
          message: message,
          contactType,
          contactId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("SMS sent successfully!");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["contact-sms-history"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send SMS: ${error.message}`);
    },
  });

  const applyTemplate = (template: typeof SMS_TEMPLATES[0]) => {
    const personalizedMessage = template.content.replace(
      /{{name}}/g,
      contactName.split(" ")[0]
    );
    setMessage(personalizedMessage);
  };

  const characterCount = message.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Text {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone number display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>To:</span>
            <Badge variant="secondary">{contactPhone}</Badge>
          </div>

          {/* Quick templates */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {SMS_TEMPLATES.map((template, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                  className="text-xs"
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Message input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{characterCount} characters</span>
              <span>
                {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Recent conversation history */}
          {recentMessages.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Recent Messages</label>
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-2">
                  {recentMessages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-md text-sm ${
                        msg.direction === "outbound"
                          ? "bg-primary/10 ml-4"
                          : "bg-muted mr-4"
                      }`}
                    >
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        {msg.direction === "outbound" ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {format(new Date(msg.created_at), "MMM d, h:mm a")}
                      </div>
                      <p className="line-clamp-2">{msg.body}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Send button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendSMS.mutate()}
              disabled={!message.trim() || sendSMS.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendSMS.isPending ? "Sending..." : "Send SMS"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
