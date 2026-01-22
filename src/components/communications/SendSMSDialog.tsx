import { useState } from "react";
import { Send, CheckCheck } from "lucide-react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ExpandableMessageInput } from "./ExpandableMessageInput";

interface SendSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  contactType: "lead" | "owner" | "vendor";
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
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          leadId: contactType === "lead" ? contactId : undefined,
          ownerId: contactType === "owner" ? contactId : undefined,
          vendorId: contactType === "vendor" ? contactId : undefined,
          phone: contactPhone,
          message: message,
          fromNumber: "+14048005932",
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
      queryClient.invalidateQueries({ queryKey: ["sent-communications"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-communications"] });
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

  // Character count is now handled by ExpandableMessageInput

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-lg p-0 md:max-h-[90vh]">
        <ResponsiveModalHeader className="px-4 md:px-6 py-4 border-b">
          <ResponsiveModalTitle className="flex items-center gap-3">
            <div className="h-11 w-11 md:h-10 md:w-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-white">
                {getInitials(contactName)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base truncate">{contactName}</div>
              <div className="text-sm text-muted-foreground font-normal">{contactPhone}</div>
            </div>
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Recent messages */}
          {recentMessages.length > 0 && (
            <ScrollArea className="h-40 md:h-48 px-4 md:px-6 py-4 border-b">
              <div className="space-y-3">
                {recentMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm ${
                          msg.direction === "outbound"
                            ? "bg-gradient-to-br from-violet-500 to-violet-600 text-white"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
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

          <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto">
            {/* Quick templates - horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {SMS_TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template)}
                  className="px-3.5 py-2 rounded-full text-sm font-medium border border-border bg-background hover:bg-muted transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {template.label}
                </button>
              ))}
            </div>

            {/* Message input with expand/review capability */}
            <ExpandableMessageInput
              value={message}
              onChange={setMessage}
              placeholder="Type your message..."
              messageType="sms"
              contactName={contactName}
              contactId={contactId}
              contactType={contactType}
              minRows={3}
              maxRows={6}
              showCharacterCount={true}
              showSegmentCount={true}
              showVoiceDictation={true}
              showAIAssistant={true}
            />
          </div>

          {/* Send button - sticky at bottom on mobile */}
          <div className="flex justify-end gap-3 p-4 md:p-6 border-t bg-background safe-area-bottom">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              className="rounded-full h-11 md:h-10 px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendSMS.mutate()}
              disabled={!message.trim() || sendSMS.isPending}
              className="rounded-full bg-gradient-to-br from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 h-11 md:h-10 px-6"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendSMS.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
