import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SAVE_REASONS = [
  { value: "important_decision", label: "Important Decision" },
  { value: "client_request", label: "Client Request" },
  { value: "action_item", label: "Action Item" },
  { value: "price_quote", label: "Price Quote" },
  { value: "contract", label: "Contract" },
  { value: "follow_up_needed", label: "Follow-up Needed" },
  { value: "legal_compliance", label: "Legal/Compliance" },
  { value: "other", label: "Other" },
];

interface SaveCommunicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  messageType: "email" | "sms" | "call" | "personal_sms" | "personal_call";
  threadId?: string;
  messageContent: string;
  messageSubject?: string;
  messageSnippet?: string;
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  messageDate: string;
  propertyId?: string;
  leadId?: string;
  ownerId?: string;
}

export function SaveCommunicationModal({
  open,
  onOpenChange,
  messageId,
  messageType,
  threadId,
  messageContent,
  messageSubject,
  messageSnippet,
  senderName,
  senderEmail,
  senderPhone,
  messageDate,
  propertyId,
  leadId,
  ownerId,
}: SaveCommunicationModalProps) {
  const [saveReason, setSaveReason] = useState<string>("");
  const [userComment, setUserComment] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("saved_communications").insert({
        message_id: messageId,
        message_type: messageType,
        thread_id: threadId,
        message_content: messageContent,
        message_subject: messageSubject,
        message_snippet: messageSnippet,
        sender_name: senderName,
        sender_email: senderEmail,
        sender_phone: senderPhone,
        message_date: messageDate,
        save_reason: saveReason,
        user_comment: userComment || null,
        ai_summary: aiSummary || null,
        saved_by: user.id,
        property_id: propertyId || null,
        lead_id: leadId || null,
        owner_id: ownerId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✓ Message saved", {
        description: "You can find it in the Saved tab",
        action: {
          label: "View Saved",
          onClick: () => {
            // Could navigate to saved tab
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["saved-communications"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Already saved", {
          description: "This message has already been saved",
        });
      } else {
        toast.error("Failed to save message");
      }
    },
  });

  const resetForm = () => {
    setSaveReason("");
    setUserComment("");
    setAiSummary("");
  };

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-communication", {
        body: {
          content: messageContent,
          subject: messageSubject,
          sender: senderName,
        },
      });

      if (error) throw error;
      setAiSummary(data?.summary || "Unable to generate summary");
    } catch (error) {
      console.error("Failed to generate summary:", error);
      toast.error("Failed to generate AI summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const preview = messageSnippet || messageContent?.slice(0, 100) + "...";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Archive Communication</DialogTitle>
          <DialogDescription>
            Save this message to your archive for future reference
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message Preview */}
          <div className="rounded-lg bg-muted/50 p-3 border">
            <p className="text-xs text-muted-foreground mb-1">From: {senderName}</p>
            {messageSubject && (
              <p className="text-sm font-medium mb-1">{messageSubject}</p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>
          </div>

          {/* Archive Reason */}
          <div className="space-y-2">
            <Label htmlFor="save-reason">Archive Reason *</Label>
            <Select value={saveReason} onValueChange={setSaveReason}>
              <SelectTrigger id="save-reason">
                <SelectValue placeholder="Why are you archiving this?" />
              </SelectTrigger>
              <SelectContent>
                {SAVE_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Your Note (optional)</Label>
            <Textarea
              id="comment"
              placeholder="Why I'm archiving this..."
              value={userComment}
              onChange={(e) => setUserComment(e.target.value)}
              rows={2}
            />
          </div>

          {/* AI Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-summary">AI Summary</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={generateAISummary}
                disabled={isGeneratingSummary}
                className="h-7 gap-1 text-xs"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate Summary
              </Button>
            </div>
            <Textarea
              id="ai-summary"
              placeholder="AI will summarize this message..."
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!saveReason || saveMutation.isPending}
              className="flex-1 gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Archive
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
