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
import { VoiceDictationButton } from "./VoiceDictationButton";

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
    label: "Check-in",
    content: "Hi {{name}}, just checking in to see if you have any questions about your property. Let me know if there's anything I can help with!",
  },
  {
    label: "Follow Up",
    content: "Hi {{name}}, following up on our recent conversation. Would you have some time this week to discuss further?",
  },
  {
    label: "Walkthrough",
    content: "Hi {{name}}, I'd love to schedule a walkthrough of your property. What times work best for you this week?",
  },
  {
    label: "Confirm",
    content: "Hi {{name}}, just confirming our meeting scheduled for tomorrow. Please let me know if that still works for you!",
  },
  {
    label: "Thanks",
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
      // Use GHL for ALL SMS (unified A2P compliant sending)
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          leadId: contactType === "lead" ? contactId : undefined,
          ownerId: contactType === "owner" ? contactId : undefined,
          phone: contactPhone,
          message: message,
          fromNumber: "+14048005932", // GHL main number
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send SMS");
      return data;
    },
    onSuccess: () => {
      toast.success("SMS sent successfully!");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["contact-sms-history"] });
      queryClient.invalidateQueries({ queryKey: ["owner-communications"] });
      queryClient.invalidateQueries({ queryKey: ["lead-communications"] });
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {getInitials(contactName)}
              </span>
            </div>
            <div>
              <div className="font-semibold">{contactName}</div>
              <div className="text-sm text-muted-foreground font-normal">{contactPhone}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col">
          {/* Recent messages */}
          {recentMessages.length > 0 && (
            <ScrollArea className="h-48 px-6 py-4 border-b">
              <div className="space-y-3">
                {recentMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm ${
                          msg.direction === "outbound"
                            ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${msg.direction === "outbound" ? "justify-end" : ""}`}>
                        {msg.direction === "outbound" && <CheckCheck className="h-3 w-3" />}
                        {format(new Date(msg.created_at), "MMM d, h:mm a")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="p-6 space-y-4">
            {/* Quick templates */}
            <div className="flex flex-wrap gap-2">
              {SMS_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
                >
                  {template.label}
                </button>
              ))}
            </div>

            {/* Message input */}
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="resize-none rounded-xl pr-10"
                />
                <div className="absolute right-2 top-2">
                  <VoiceDictationButton
                    onResult={(text) => setMessage(prev => prev ? `${prev}\n${text}` : text)}
                    messageType="sms"
                    contactName={contactName}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{characterCount} characters</span>
                <span>
                  {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Send button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
                Cancel
              </Button>
              <Button
                onClick={() => sendSMS.mutate()}
                disabled={!message.trim() || sendSMS.isPending}
                className="rounded-full bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendSMS.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
