import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, X, Loader2, MessageSquare } from "lucide-react";

const QUICK_REPLIES = [
  "Got it, thanks!",
  "I'll review and get back to you",
  "Thanks for the update!",
];

interface TextReplyComposerProps {
  token: string;
  voicemailId: string;
  onReplySent: () => void;
  onCancel: () => void;
}

export default function TextReplyComposer({
  token,
  voicemailId,
  onReplySent,
  onCancel,
}: TextReplyComposerProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleQuickReply = (text: string) => {
    setMessage(text);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("voicemail-text-reply", {
        body: {
          token,
          voicemailId,
          message: message.trim(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Reply sent successfully!");
        onReplySent();
      } else {
        throw new Error(data?.error || "Failed to send reply");
      }
    } catch (err) {
      console.error("Text reply error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl p-4 sm:p-5 mb-6 space-y-4">
      <div className="flex items-center gap-2 text-blue-700 mb-2">
        <MessageSquare className="h-5 w-5" />
        <span className="font-medium">Send a Text Reply</span>
      </div>

      {/* Quick Reply Buttons - Grid layout for mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => handleQuickReply(reply)}
            className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${
              message === reply
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Message Input */}
      <div className="relative">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          className="min-h-[100px] resize-none bg-white rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400"
          maxLength={500}
          disabled={isSending}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {message.length}/500
        </div>
      </div>

      {/* Action Buttons - Stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSending}
          className="h-12 rounded-xl order-2 sm:order-1 sm:flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          className="h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 order-1 sm:order-2 sm:flex-1"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send Reply
        </Button>
      </div>
    </div>
  );
}
