import { useState } from "react";
import { Sparkles, Loader2, Check, X, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIReplyButtonProps {
  contactName: string;
  contactPhone?: string;
  contactId?: string;
  contactType: string;
  conversationThread: Array<{
    type: string;
    direction: string;
    body: string;
    created_at: string;
    subject?: string;
  }>;
  onSendMessage: (message: string) => void;
  isSending?: boolean;
}

export function AIReplyButton({
  contactName,
  contactPhone,
  contactId,
  contactType,
  conversationThread,
  onSendMessage,
  isSending = false,
}: AIReplyButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReply, setEditedReply] = useState("");

  const handleGenerateReply = async () => {
    setIsGenerating(true);
    setGeneratedReply(null);

    try {
      // Build full conversation context
      const conversationContext = conversationThread
        .slice(0, 15) // Last 15 messages for context
        .map((msg) => {
          const direction = msg.direction === "outbound" ? "SENT" : "RECEIVED";
          const typeLabel = msg.type === "sms" ? "SMS" : msg.type === "call" ? "CALL" : "EMAIL";
          const content = msg.body || (msg.type === "call" ? "Phone call" : "No content");
          return `[${direction} ${typeLabel}]: ${content}`;
        })
        .join("\n");

      const { data, error } = await supabase.functions.invoke("ai-message-assistant", {
        body: {
          action: "generate_contextual_reply",
          currentMessage: "",
          contactName,
          conversationContext,
          messageType: "sms",
          leadId: contactType === "lead" ? contactId : undefined,
          ownerId: contactType === "owner" ? contactId : undefined,
          includeCompanyKnowledge: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.message) {
        setGeneratedReply(data.message);
        setEditedReply(data.message);
        toast.success("AI reply generated!");
      }
    } catch (error: any) {
      console.error("AI reply generation error:", error);
      toast.error(`Failed to generate reply: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    const messageToSend = isEditing ? editedReply : generatedReply;
    if (messageToSend) {
      onSendMessage(messageToSend);
      setGeneratedReply(null);
      setIsEditing(false);
      setEditedReply("");
    }
  };

  const handleCancel = () => {
    setGeneratedReply(null);
    setIsEditing(false);
    setEditedReply("");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedReply(generatedReply || "");
  };

  if (generatedReply) {
    return (
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          <span>AI Suggested Reply</span>
        </div>
        
        {isEditing ? (
          <Textarea
            value={editedReply}
            onChange={(e) => setEditedReply(e.target.value)}
            className="min-h-[120px] text-sm bg-background resize-y"
            autoFocus
          />
        ) : (
          <div
            onClick={handleEdit}
            className="text-sm bg-background/80 rounded-lg p-3 whitespace-pre-wrap cursor-text hover:bg-background/90 transition-colors border border-transparent hover:border-primary/20"
            title="Click to edit"
          >
            {generatedReply}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isSending || (!generatedReply && !editedReply.trim())}
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
          
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          
          <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-2">
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleGenerateReply}
      disabled={isGenerating}
      className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Reply with AI
        </>
      )}
    </Button>
  );
}
