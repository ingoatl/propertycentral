import { useState } from "react";
import { Send, Mail, Loader2, Sparkles, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VoiceDictationButton } from "./VoiceDictationButton";

interface AIComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIComposeEmailDialog({
  open,
  onOpenChange,
}: AIComposeEmailDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [context, setContext] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generateAIDraft = async () => {
    if (!context.trim()) {
      toast.error("Please provide some context for the AI to draft an email");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compose-email", {
        body: {
          recipientName: recipientName || "the recipient",
          recipientEmail,
          context: context.trim(),
          includeCalendarLink: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
      
      toast.success("AI draft generated!");
    } catch (error: any) {
      console.error("AI compose error:", error);
      toast.error(`Failed to generate draft: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const sendEmail = useMutation({
    mutationFn: async () => {
      if (!recipientEmail) throw new Error("Please enter a recipient email");
      if (!subject.trim()) throw new Error("Please enter a subject");
      if (!body.trim()) throw new Error("Please enter a message");

      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          to: recipientEmail,
          toName: recipientName || "",
          subject,
          body,
          contactType: "other",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully!");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  const resetForm = () => {
    setRecipientEmail("");
    setRecipientName("");
    setContext("");
    setSubject("");
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Email Composer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Recipient Name (optional)</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
          </div>

          {/* Context for AI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="context" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Context for AI (describe what you want to say)
              </Label>
              <VoiceDictationButton
                onResult={(text) => setContext(prev => prev ? `${prev} ${text}` : text)}
                messageType="email"
                contactName={recipientName}
              />
            </div>
            <Textarea
              id="context"
              placeholder="e.g., Follow up on a discovery call we had last week about their property in Buckhead. They were interested in mid-term rental management but had questions about pricing."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button
              onClick={generateAIDraft}
              disabled={isGenerating || !context.trim()}
              variant="outline"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Draft...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Draft
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              AI will use PeachHaus knowledge and include the discovery call booking link strategically
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              placeholder="Email message... (Generate with AI or type manually)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="resize-none font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendEmail.mutate()}
              disabled={!recipientEmail || !subject.trim() || !body.trim() || sendEmail.isPending}
            >
              {sendEmail.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sendEmail.isPending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
