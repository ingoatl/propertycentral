import { useState } from "react";
import { Sparkles, Loader2, Check, X, Edit3, Calendar, TrendingUp, MessageSquare, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { VoiceDictationButton } from "./VoiceDictationButton";

const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

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
  const [showContextInput, setShowContextInput] = useState(false);
  const [userInstructions, setUserInstructions] = useState("");

  const handleGenerateReply = async (withInstructions?: string) => {
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

      // CRITICAL: Extract the most recent INBOUND message - this is what we're replying to
      const lastInboundMessage = conversationThread
        .filter(msg => msg.direction === "inbound" && msg.body)
        .pop();
      
      const messageToReplyTo = lastInboundMessage?.body || "";
      console.log("[AIReplyButton] Replying to message:", messageToReplyTo.substring(0, 100));

      const { data, error } = await supabase.functions.invoke("ai-message-assistant", {
        body: {
          action: "generate_contextual_reply",
          currentMessage: messageToReplyTo, // Pass the actual message we're replying to
          contactName,
          conversationContext,
          messageType: "sms",
          leadId: contactType === "lead" ? contactId : undefined,
          ownerId: contactType === "owner" ? contactId : undefined,
          includeCompanyKnowledge: true,
          userInstructions: withInstructions || userInstructions || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.message) {
        setGeneratedReply(data.message);
        setEditedReply(data.message);
        setShowContextInput(false);
        setUserInstructions("");
      }
    } catch (error: any) {
      console.error("AI reply generation error:", error);
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
    setShowContextInput(false);
    setUserInstructions("");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedReply(generatedReply || "");
  };

  // Quick action buttons to add scheduling or income analysis offer
  const handleAddScheduleCall = () => {
    const scheduleText = `\n\nWant to hop on a quick call? Here's my calendar: ${SCHEDULING_LINK}`;
    const newReply = (isEditing ? editedReply : generatedReply || "") + scheduleText;
    setEditedReply(newReply);
    setIsEditing(true);
  };

  const handleAddIncomeAnalysis = () => {
    const incomeText = `\n\nBy the way - I can put together a free income analysis showing what your property could earn. Just need your address and email to send it over!`;
    const newReply = (isEditing ? editedReply : generatedReply || "") + incomeText;
    setEditedReply(newReply);
    setIsEditing(true);
  };

  // Show context input panel - full width display
  if (showContextInput && !generatedReply) {
    return (
      <div className="w-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <MessageSquare className="h-4 w-4" />
            <span>What would you like to say?</span>
          </div>
          <VoiceDictationButton
            onResult={(text) => setUserInstructions(prev => prev ? `${prev} ${text}` : text)}
            messageType="sms"
            contactName={contactName}
          />
        </div>
        
        <Textarea
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          placeholder="Enter context or key points... e.g. 'Tell them we can do a walkthrough next Tuesday'"
          className="min-h-[100px] text-sm bg-background resize-y w-full"
          autoFocus
        />

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => handleGenerateReply()}
            disabled={isGenerating || !userInstructions.trim()}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate Reply
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-2">
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (generatedReply) {
    return (
      <div className="w-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            <span>AI Suggested Reply</span>
          </div>
          
          {/* Quick action buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddScheduleCall}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
              title="Add scheduling link"
            >
              <Calendar className="h-3 w-3" />
              + Call
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddIncomeAnalysis}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
              title="Add income analysis offer"
            >
              <TrendingUp className="h-3 w-3" />
              + Analysis
            </Button>
          </div>
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <VoiceDictationButton
                onResult={(text) => setEditedReply(prev => prev ? `${prev} ${text}` : text)}
                messageType="sms"
                contactName={contactName}
              />
            </div>
            <Textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              className="min-h-[120px] text-sm bg-background resize-y w-full"
              autoFocus
            />
          </div>
        ) : (
          <div
            onClick={handleEdit}
            className="text-sm bg-background/80 rounded-lg p-3 whitespace-pre-wrap cursor-text hover:bg-background/90 transition-colors border border-transparent hover:border-primary/20"
            title="Click to edit"
          >
            {generatedReply}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
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
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setShowContextInput(true);
              setGeneratedReply(null);
            }} 
            className="gap-2"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Regenerate with Context
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-2">
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="default"
        size="sm"
        onClick={() => handleGenerateReply()}
        disabled={isGenerating}
        className="gap-1.5 h-8 px-3 text-xs sm:text-sm sm:gap-2 sm:px-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 whitespace-nowrap flex-shrink-0"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
            <span className="hidden sm:inline">Generating...</span>
            <span className="sm:hidden">AI...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Reply with AI</span>
            <span className="sm:hidden">AI Reply</span>
          </>
        )}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowContextInput(true)}
        disabled={isGenerating}
        className="gap-1.5 h-8 px-3 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
        title="Generate AI reply with your context"
      >
        <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">Reply with Context</span>
        <span className="sm:hidden">+ Context</span>
      </Button>
    </div>
  );
}