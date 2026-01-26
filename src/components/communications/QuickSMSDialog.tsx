import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Send, User, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPhoneForDisplay } from "@/lib/phoneUtils";
import { extractFirstName } from "@/lib/nameUtils";
import { useUnifiedAI } from "@/hooks/useUnifiedAI";

interface QuickSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPhone: string;
  recipientName: string;
  leadId?: string;
  ownerId?: string;
  vendorId?: string;
}

export function QuickSMSDialog({
  open,
  onOpenChange,
  recipientPhone,
  recipientName,
  leadId,
  ownerId,
  vendorId,
}: QuickSMSDialogProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showAICompose, setShowAICompose] = useState(false);
  const [aiContext, setAIContext] = useState("");
  const { composeMessage, isLoading: isAILoading } = useUnifiedAI();

  const handleAICompose = async () => {
    if (!aiContext.trim()) {
      toast.error("Please enter context for the message");
      return;
    }

    const contactType = leadId ? 'lead' : ownerId ? 'owner' : vendorId ? 'vendor' : 'other';
    const contactId = leadId || ownerId || vendorId || '';
    
    const result = await composeMessage(
      contactType as any,
      contactId,
      'sms',
      aiContext.trim(),
      undefined,
      recipientPhone,
      undefined
    );

    if (result?.message) {
      setMessage(result.message);
      setShowAICompose(false);
      setAIContext("");
      toast.success("Message generated!");
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          to: recipientPhone,
          message: message.trim(),
          leadId,
          ownerId,
          recipientName,
          vendorId, // Include vendorId for vendor communications
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send SMS");

      toast.success("SMS sent successfully");
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("SMS send error:", error);
      toast.error(error.message || "Failed to send SMS");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{recipientName}</p>
              <p className="text-sm text-muted-foreground">
                {formatPhoneForDisplay(recipientPhone)}
              </p>
            </div>
          </div>

          {/* AI Compose Panel */}
          {showAICompose && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Wand2 className="h-4 w-4" />
                  AI Compose
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowAICompose(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder={`What should we tell ${extractFirstName(recipientName) || 'them'}?`}
                  value={aiContext}
                  onChange={(e) => setAIContext(e.target.value)}
                  disabled={isAILoading}
                  onKeyDown={(e) => e.key === 'Enter' && handleAICompose()}
                />
                <p className="text-xs text-muted-foreground">
                  e.g., "Tell him I just sent the management agreement and need it signed"
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleAICompose}
                disabled={isAILoading || !aiContext.trim()}
                className="w-full"
              >
                {isAILoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Generate Message
              </Button>
            </div>
          )}

          {/* Message input */}
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none pr-10"
                disabled={isSending || isAILoading}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-2 left-2 h-8 w-8 text-primary hover:bg-primary/10"
                onClick={() => setShowAICompose(!showAICompose)}
                disabled={isSending || isAILoading}
                title="AI Compose"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {message.length} / 160 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !message.trim()}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
