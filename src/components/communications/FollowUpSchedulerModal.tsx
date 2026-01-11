import { useState, useMemo } from "react";
import { Calendar, MessageSquare, Mail, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

interface FollowUpSchedulerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  contactType: string;
  contactId?: string;
  leadId?: string;
  conversationContext?: string;
  lastMessageSent?: string;
  onScheduled?: () => void;
}

type FollowUpTiming = "tomorrow" | "3days" | "1week";
type FollowUpChannel = "sms" | "email";

interface SuggestedFollowUp {
  timing: FollowUpTiming;
  channel: FollowUpChannel;
  message: string;
  reason: string;
}

export function FollowUpSchedulerModal({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  contactEmail,
  contactType,
  contactId,
  leadId,
  conversationContext,
  lastMessageSent,
  onScheduled,
}: FollowUpSchedulerModalProps) {
  const [selectedTiming, setSelectedTiming] = useState<FollowUpTiming>("3days");
  const [selectedChannel, setSelectedChannel] = useState<FollowUpChannel>("sms");
  const [message, setMessage] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const firstName = contactName?.split(" ")[0] || "there";

  // Generate AI suggestion based on context
  const generateSuggestion = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-message-assistant", {
        body: {
          action: "generate",
          currentMessage: "",
          contactName,
          conversationContext: conversationContext || lastMessageSent || "",
          messageType: selectedChannel,
          leadId,
          includeCompanyKnowledge: true,
        },
      });

      if (error) throw error;
      if (data?.message) {
        setMessage(data.message);
      }
    } catch (error: any) {
      console.error("Failed to generate follow-up:", error);
      // Fallback to template
      setMessage(getDefaultMessage());
    } finally {
      setIsGenerating(false);
    }
  };

  const getDefaultMessage = () => {
    if (selectedChannel === "sms") {
      return `Hi ${firstName}, just checking in on our conversation. Have you had a chance to think about the property management options we discussed? Would love to run a free income analysis for your property - just need your address! - Ingo @ PeachHaus Group`;
    }
    return `Hi ${firstName},\n\nI wanted to follow up on our recent conversation about property management services. We'd love to show you what your property could earn with our complimentary income analysis.\n\nJust send over your property address and I'll have the report ready for you within 24 hours!\n\nBest,\nIngo @ PeachHaus Group`;
  };

  // Set default message when modal opens or channel changes
  useMemo(() => {
    if (open && !message) {
      setMessage(getDefaultMessage());
    }
  }, [open, selectedChannel]);

  const getScheduledDate = () => {
    const now = new Date();
    switch (selectedTiming) {
      case "tomorrow":
        return addDays(now, 1);
      case "3days":
        return addDays(now, 3);
      case "1week":
        return addDays(now, 7);
      default:
        return addDays(now, 3);
    }
  };

  const handleSchedule = async () => {
    if (!message.trim()) {
      toast.error("Please enter a follow-up message");
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledDate = getScheduledDate();
      
      // If we have a leadId, use the formal follow-up system
      if (leadId) {
        const { error } = await supabase.from("lead_follow_up_schedules").insert({
          lead_id: leadId,
          scheduled_for: scheduledDate.toISOString(),
          status: "pending",
          attempt_count: 0,
        });

        if (error) throw error;

        // Also store the message template in lead notes
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: `Follow-up scheduled for ${format(scheduledDate, "MMM d, yyyy")}`,
          details: `${selectedChannel.toUpperCase()}: ${message.substring(0, 200)}...`,
          metadata: {
            follow_up_type: selectedChannel,
            scheduled_for: scheduledDate.toISOString(),
            message_template: message,
          },
        });
      } else {
        // For non-lead contacts, store as a pending task
        const { data: { user } } = await supabase.auth.getUser();
        
        await supabase.from("pending_task_confirmations").insert([{
          source_type: "communication",
          caller_user_id: user?.id || null,
          task_title: `Follow up with ${contactName}`,
          task_description: `${selectedChannel.toUpperCase()} follow-up scheduled for ${format(scheduledDate, "MMM d")}. Message: ${message.substring(0, 200)}`,
          task_category: "follow_up",
          priority: "medium",
          status: "pending",
          expires_at: scheduledDate.toISOString(),
          source_quote: `Contact: ${contactName}, Phone: ${contactPhone || "N/A"}, Channel: ${selectedChannel}`,
        }]);
      }

      toast.success(`Follow-up scheduled for ${format(scheduledDate, "EEEE, MMM d")}`);
      onOpenChange(false);
      onScheduled?.();
    } catch (error: any) {
      console.error("Failed to schedule follow-up:", error);
      toast.error(`Failed to schedule: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const timingOptions: { value: FollowUpTiming; label: string }[] = [
    { value: "tomorrow", label: "Tomorrow" },
    { value: "3days", label: "3 Days" },
    { value: "1week", label: "1 Week" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Follow-Up
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI Suggestion Banner */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 inline mr-2" />
            Based on the conversation, a follow-up in a few days may help continue the conversation.
            {!leadId && (
              <span className="block mt-1 text-xs">
                Note: Follow-up will auto-cancel if they respond first.
              </span>
            )}
          </div>

          {/* Timing Selection */}
          <div className="flex gap-2">
            {timingOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedTiming === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTiming(option.value)}
                className="flex-1"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Channel Selection */}
          <div className="flex gap-2">
            {contactPhone && (
              <Button
                variant={selectedChannel === "sms" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedChannel("sms");
                  setMessage(getDefaultMessage());
                }}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </Button>
            )}
            {contactEmail && (
              <Button
                variant={selectedChannel === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedChannel("email");
                  setMessage(getDefaultMessage());
                }}
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            )}
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Follow-up Message</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateSuggestion}
                disabled={isGenerating}
                className="text-xs"
              >
                {isGenerating ? "Generating..." : "✨ Regenerate"}
              </Button>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter your follow-up message..."
              className="resize-none"
            />
            {selectedChannel === "sms" && (
              <p className="text-xs text-muted-foreground">
                {message.length} characters • {Math.ceil(message.length / 160)} SMS segment(s)
              </p>
            )}
          </div>

          {/* Schedule Button */}
          <Button
            onClick={handleSchedule}
            disabled={isScheduling || !message.trim()}
            className="w-full"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {isScheduling
              ? "Scheduling..."
              : `Schedule for ${format(getScheduledDate(), "EEEE, MMM d")}`}
          </Button>

          {/* Skip Option */}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
          >
            Skip Follow-Up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
