import { useState, useRef, useEffect } from "react";
import { Send, CheckCheck, Paperclip, X, Image, FileVideo, Loader2 } from "lucide-react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ExpandableMessageInput } from "./ExpandableMessageInput";
import { InsertLinksDropdown } from "./InsertLinksDropdown";
interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface SendSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  contactType: "lead" | "owner" | "vendor";
  contactId: string;
  workOrderId?: string;
}

// Alex's user ID - he gets CC'd on all vendor communications
const ALEX_USER_ID = "fbd13e57-3a59-4c53-bb3b-14ab354b3420";

// Templates for leads/owners (general)
const OWNER_LEAD_TEMPLATES = [
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

// Maintenance-specific templates for owners (when workOrderId is provided)
const OWNER_MAINTENANCE_TEMPLATES = [
  {
    label: "Request Approval",
    content: "Hi {{name}}, we need your approval for a repair at your property. The vendor quoted ${{quote}}. Reply APPROVE to proceed or call us with questions.",
  },
  {
    label: "Work Started",
    content: "Hi {{name}}, just letting you know the vendor has started work at your property. We'll update you when complete.",
  },
  {
    label: "Work Complete",
    content: "Hi {{name}}, great news! The repair at your property is complete. Photos are available in your owner portal.",
  },
  {
    label: "Additional Issue",
    content: "Hi {{name}}, while working on the repair, the vendor found an additional issue. Please call us to discuss options.",
  },
  {
    label: "Schedule Access",
    content: "Hi {{name}}, we need to schedule vendor access to your property. What times work for you this week?",
  },
  {
    label: "Urgent",
    content: "URGENT: Hi {{name}}, there's a maintenance emergency at your property. We've dispatched a vendor. Please call us ASAP.",
  },
];

// Templates for vendors
const VENDOR_TEMPLATES = [
  {
    label: "ETA Check",
    content: "Hi {{name}}, checking in on your ETA for the job today. Please update us when you're en route or on-site.",
  },
  {
    label: "Job Status",
    content: "Hi {{name}}, can you provide a quick status update on the current work order? Let us know if you need anything.",
  },
  {
    label: "Photos Needed",
    content: "Hi {{name}}, please remember to upload before and after photos through the job portal link. We need these to complete the work order.",
  },
  {
    label: "Schedule",
    content: "Hi {{name}}, we have a new work order that needs attention. When is your earliest availability to take a look?",
  },
  {
    label: "Invoice Reminder",
    content: "Hi {{name}}, please submit your invoice for the completed work at your earliest convenience so we can process payment.",
  },
  {
    label: "Quality Issue",
    content: "Hi {{name}}, we need to discuss some concerns about the recent job. Please call us at your earliest convenience.",
  },
  {
    label: "Great Job",
    content: "Hi {{name}}, great work on the recent job! The property looks excellent. We'll definitely keep you in mind for future work.",
  },
  {
    label: "Urgent",
    content: "Hi {{name}}, we have an urgent maintenance request. Are you available to respond today? Please call us ASAP.",
  },
];

export function SendSMSDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  contactType,
  contactId,
  workOrderId,
}: SendSMSDialogProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMessage("");
      setAttachments([]);
    }
  }, [open]);

  // Fetch current user's personal phone assignment for routing
  const { data: userPhoneData } = useQuery({
    queryKey: ["current-user-phone"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("user_phone_assignments")
        .select("phone_number, id, user_id")
        .eq("user_id", user.id)
        .eq("phone_type", "personal")
        .eq("is_active", true)
        .maybeSingle();
      
      return { userId: user.id, phone: data?.phone_number || null };
    },
    enabled: open && contactType === "vendor",
  });

  // Fetch recent messages with this contact
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["recent-sms", contactType, contactId],
    queryFn: async () => {
      const query = supabase
        .from("lead_communications")
        .select("*")
        .eq("communication_type", "sms")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (contactType === "lead") {
        query.eq("lead_id", contactId);
      } else if (contactType === "owner") {
        query.eq("owner_id", contactId);
      } else if (contactType === "vendor") {
        query.or(`metadata->>vendor_id.eq.${contactId},metadata->>vendor_phone.ilike.%${contactPhone.replace(/\D/g, "").slice(-10)}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Handle file upload for MMS attachments
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 5) {
      toast.error("Maximum 5 attachments allowed");
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        const maxSize = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(`${file.name} exceeds size limit`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from("message-attachments")
          .upload(fileName, file);

        if (error) {
          console.error("Upload error:", error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("message-attachments")
          .getPublicUrl(data.path);

        newAttachments.push({
          id: data.path,
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
        });
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      
      if (newAttachments.length > 0) {
        toast.success(`${newAttachments.length} file(s) uploaded`);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    try {
      await supabase.storage
        .from("message-attachments")
        .remove([attachmentId]);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error("Remove error:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Send SMS/MMS mutation
  const sendSMS = useMutation({
    mutationFn: async () => {
      // For vendors: use the current user's personal phone, replies come to their inbox
      // The edge function will also CC Alex on all vendor communications
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          phone: contactPhone,
          message,
          leadId: contactType === "lead" ? contactId : undefined,
          ownerId: contactType === "owner" ? contactId : undefined,
          vendorId: contactType === "vendor" ? contactId : undefined,
          workOrderId: workOrderId,
          // For vendors: use sender's personal phone so replies come to their inbox
          // If no personal phone, edge function will fall back to Alex's line
          fromNumber: contactType === "vendor" ? userPhoneData?.phone : undefined,
          // MMS attachments
          mediaUrls: attachments.length > 0 ? attachments.map(a => a.url) : undefined,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(attachments.length > 0 ? "MMS sent!" : "SMS sent!");
      setMessage("");
      setAttachments([]);
      onOpenChange(false);
      
      queryClient.invalidateQueries({ queryKey: ["recent-sms", contactType, contactId] });
      queryClient.invalidateQueries({ queryKey: ["work-order-sms"] });
      queryClient.invalidateQueries({ queryKey: ["lead-communications"] });
    },
    onError: (error: any) => {
      console.error("Send SMS error:", error);
      toast.error(error.message || "Failed to send message");
    },
  });

  const applyTemplate = (template: { label: string; content: string }) => {
    const firstName = contactName.split(" ")[0];
    const filledContent = template.content.replace("{{name}}", firstName);
    setMessage(filledContent);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasAttachments = attachments.length > 0;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-lg p-0 md:max-h-[90vh]">
        <ResponsiveModalHeader className="px-4 md:px-6 py-4 border-b">
          <ResponsiveModalTitle className="flex items-center gap-3">
            <div className="h-11 w-11 md:h-10 md:w-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-primary-foreground">
                {getInitials(contactName)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-base truncate">{contactName}</div>
              <div className="text-sm text-muted-foreground font-normal">{contactPhone}</div>
            </div>
            <Badge variant={hasAttachments ? "default" : "secondary"} className="shrink-0">
              {hasAttachments ? "MMS" : "SMS"}
            </Badge>
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
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        {/* Show attachments in message */}
                        {msg.metadata?.attachments?.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {msg.metadata.attachments.map((att: any, idx: number) => (
                              <a
                                key={idx}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-12 w-12 rounded bg-background/20 overflow-hidden"
                              >
                                {att.type === "image" || att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                  <img src={att.url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center">
                                    <FileVideo className="h-5 w-5 opacity-70" />
                                  </div>
                                )}
                              </a>
                            ))}
                          </div>
                        )}
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
            {/* Insert Link Dropdown + Quick templates row */}
            <div className="flex items-center gap-2 flex-wrap">
              <InsertLinksDropdown
                onInsert={(text) => setMessage(text)}
                recipientName={contactName}
                contactType={contactType === "vendor" ? undefined : contactType}
              />
              
              {/* Quick templates - use maintenance templates for owners with workOrderId */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                {(contactType === "vendor" 
                  ? VENDOR_TEMPLATES 
                  : (contactType === "owner" && workOrderId)
                    ? OWNER_MAINTENANCE_TEMPLATES
                    : OWNER_LEAD_TEMPLATES
                ).slice(0, 5).map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyTemplate(template)}
                    className="px-3.5 py-2 rounded-full text-sm font-medium border border-border bg-background hover:bg-muted transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message input */}
            <div className="space-y-3">
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

              {/* Attachment preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative group">
                      {attachment.type.startsWith("image/") ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="h-16 w-16 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center">
                          <FileVideo className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="absolute bottom-0 left-0 right-0 bg-foreground/70 text-background text-[8px] text-center py-0.5 rounded-b-lg truncate px-1">
                        {formatFileSize(attachment.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center gap-3 p-4 md:p-6 border-t bg-background safe-area-bottom">
            {/* Attachment button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept="image/*,video/*"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || attachments.length >= 5}
              className="shrink-0"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>

            <div className="flex-1" />

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
              className="rounded-full h-11 md:h-10 px-6"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendSMS.isPending ? "Sending..." : hasAttachments ? "Send MMS" : "Send"}
            </Button>
          </div>

          {/* Vendor routing notice */}
          {contactType === "vendor" && (
            <div className="px-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">
                Sent from Alex's direct line • Replies route to his inbox
              </p>
            </div>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}