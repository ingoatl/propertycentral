import { useState } from "react";
import { Sparkles, Loader2, Check, X, Edit3, Calendar, TrendingUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceDictationButton } from "./VoiceDictationButton";
import { useUnifiedAI } from "@/hooks/useUnifiedAI";

const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

interface AIReplyButtonProps {
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  contactId?: string;
  contactType: string;
  ghlContactId?: string;
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
  contactEmail,
  contactId,
  contactType,
  ghlContactId,
  conversationThread,
  onSendMessage,
  isSending = false,
}: AIReplyButtonProps) {
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReply, setEditedReply] = useState("");
  const [showContextInput, setShowContextInput] = useState(false);
  const [userInstructions, setUserInstructions] = useState("");

  // Use the unified AI hook for better context-aware responses
  const { replyToMessage, isLoading } = useUnifiedAI();

  const handleGenerateReply = async (withInstructions?: string) => {
    setGeneratedReply(null);

    try {
      // Get the most recent inbound messages for context about what we're replying to
      const inboundMessages = conversationThread
        .filter(msg => msg.direction === "inbound" && msg.body)
        .slice(-3); // Last 3 inbound messages for context
      
      const lastInboundMessage = inboundMessages[inboundMessages.length - 1];
      
      // Build a richer "incoming message" that includes recent context
      let messageToReplyTo = lastInboundMessage?.body || "";
      
      // If there are multiple recent inbound messages, combine them for better context
      if (inboundMessages.length > 1) {
        const recentContext = inboundMessages
          .slice(-2)
          .map(m => m.body)
          .join("\n\n");
        messageToReplyTo = recentContext;
      }
      
      console.log("[AIReplyButton] Generating reply with:", {
        contactId,
        contactType,
        threadLength: conversationThread.length,
        inboundMessagePreview: messageToReplyTo.substring(0, 100),
        hasInstructions: !!withInstructions || !!userInstructions,
      });

      // Pass the FULL conversation thread to the AI
      const cType = contactType === "owner" ? "owner" : "lead";
      const response = await replyToMessage(
        cType,
        contactId || "",
        "sms",
        messageToReplyTo,
        withInstructions || userInstructions || undefined,
        conversationThread, // Pass full thread!
        contactPhone,
        contactEmail,
        ghlContactId
      );

      if (response?.message) {
        setGeneratedReply(response.message);
        setEditedReply(response.message);
        setShowContextInput(false);
        setUserInstructions("");
        
        // Log quality info for debugging
        console.log("[AIReplyButton] Generated reply:", {
          qualityScore: response.qualityScore,
          messagesAnalyzed: response.contextUsed.messagesAnalyzed,
          sentimentDetected: response.contextUsed.sentimentDetected,
          conversationPhase: response.contextUsed.conversationPhase,
        });
        
        if (response.qualityScore < 70) {
          console.warn("[AIReplyButton] Low quality score:", response.qualityScore, response.validationIssues);
        }
      }
    } catch (error: any) {
      console.error("AI reply generation error:", error);
    }
  };

  const handleSend = () => {
    const messageToSend = isEditing ? editedReply : generatedReply;
    console.log("[AIReplyButton] handleSend called:", { isEditing, editedReply: editedReply?.substring(0, 50), generatedReply: generatedReply?.substring(0, 50), messageToSend: messageToSend?.substring(0, 50) });
    if (messageToSend) {
      console.log("[AIReplyButton] Calling onSendMessage with:", messageToSend.substring(0, 100));
      onSendMessage(messageToSend);
      setGeneratedReply(null);
      setIsEditing(false);
      setEditedReply("");
    } else {
      console.warn("[AIReplyButton] No message to send!");
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
            disabled={isLoading || !userInstructions.trim()}
            className="gap-2"
          >
            {isLoading ? (
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

        <div className="flex items-center gap-2 flex-wrap relative z-10">
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[AIReplyButton] Send button clicked");
              handleSend();
            }}
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
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEdit();
              }} 
              className="gap-2"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowContextInput(true);
              setGeneratedReply(null);
            }} 
            className="gap-2"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Regenerate with Context
          </Button>
          
          <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel();
            }} 
            className="gap-2"
          >
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
        disabled={isLoading}
        className="gap-1.5 h-8 px-3 text-xs sm:text-sm sm:gap-2 sm:px-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 whitespace-nowrap flex-shrink-0"
      >
        {isLoading ? (
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
        disabled={isLoading}
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
