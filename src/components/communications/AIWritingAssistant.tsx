import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, Zap, MessageSquare, FileText, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useUnifiedAI } from "@/hooks/useUnifiedAI";

const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

interface AIWritingAssistantProps {
  currentMessage: string;
  onMessageGenerated: (message: string) => void;
  contactName?: string;
  conversationContext?: string;
  messageType: "sms" | "email";
  contactId?: string;
  contactType?: "lead" | "owner" | "vendor";
}

type ActionType = "improve" | "shorter" | "professional" | "generate" | "friendly";

export function AIWritingAssistant({
  currentMessage,
  onMessageGenerated,
  contactName,
  conversationContext,
  messageType,
  contactId,
  contactType,
}: AIWritingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use the unified AI hook for better context-aware responses
  const { 
    composeMessage, 
    improveMessage, 
    shortenMessage, 
    makeProfessional, 
    makeFriendly,
    isLoading 
  } = useUnifiedAI();

  const handleAction = async (action: ActionType) => {
    try {
      // Validate required fields
      if (!contactId) {
        toast.error("Contact information is missing. Please select a conversation first.");
        return;
      }
      
      let response = null;
      const cType = contactType || "lead";
      
      switch (action) {
        case "generate":
          response = await composeMessage(cType, contactId, messageType);
          break;
        case "improve":
          if (!currentMessage) {
            toast.error("Please write a message first to improve it.");
            return;
          }
          response = await improveMessage(cType, contactId, messageType, currentMessage);
          break;
        case "shorter":
          if (!currentMessage) {
            toast.error("Please write a message first to shorten it.");
            return;
          }
          response = await shortenMessage(cType, contactId, messageType, currentMessage);
          break;
        case "professional":
          if (!currentMessage) {
            toast.error("Please write a message first.");
            return;
          }
          response = await makeProfessional(cType, contactId, messageType, currentMessage);
          break;
        case "friendly":
          if (!currentMessage) {
            toast.error("Please write a message first.");
            return;
          }
          response = await makeFriendly(cType, contactId, messageType, currentMessage);
          break;
      }

      if (response?.message) {
        onMessageGenerated(response.message);
        toast.success("Message generated!");
        setIsOpen(false);
      }
    } catch (error: any) {
      console.error("AI assistant error:", error);
      toast.error(`Failed to generate message: ${error.message}`);
    }
  };

  // Quick insert actions - these don't use AI, just insert text
  const handleAddScheduleCall = () => {
    const scheduleText = currentMessage 
      ? `${currentMessage}\n\nWant to hop on a quick call? Here's my calendar: ${SCHEDULING_LINK}`
      : `Want to hop on a quick call? Here's my calendar: ${SCHEDULING_LINK}`;
    onMessageGenerated(scheduleText);
    toast.success("Added scheduling link!");
    setIsOpen(false);
  };

  const handleAddIncomeAnalysis = () => {
    const firstName = contactName?.split(" ")[0] || "there";
    const incomeText = currentMessage 
      ? `${currentMessage}\n\nBy the way - I can put together a free income analysis showing what your property could earn. Just need your address and email to send it over!`
      : `Hey ${firstName}! I can put together a free income analysis showing what your property could earn. Just need your address and email to send it over! - Ingo`;
    onMessageGenerated(incomeText);
    toast.success("Added income analysis offer!");
    setIsOpen(false);
  };

  const actions = [
    { type: "generate" as ActionType, label: "Generate Reply", icon: MessageSquare, description: "Create a contextual reply" },
    { type: "improve" as ActionType, label: "Improve", icon: Sparkles, description: "Make it better" },
    { type: "shorter" as ActionType, label: "Make Shorter", icon: Zap, description: "Condense the message" },
    { type: "professional" as ActionType, label: "Professional", icon: FileText, description: "Formal tone" },
    { type: "friendly" as ActionType, label: "Friendly", icon: RefreshCw, description: "Casual tone" },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-11 w-11 md:h-10 md:w-10 rounded-full transition-all duration-200 active:scale-95 hover:bg-primary/10"
        >
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 md:w-64 p-3" align="start" side="top" sideOffset={8}>
        <div className="space-y-1.5">
          <p className="text-sm md:text-xs font-semibold text-muted-foreground px-2 py-1.5">
            AI Writing Assistant
          </p>
          {actions.map((action) => (
            <button
              key={action.type}
              onClick={() => handleAction(action.type)}
              disabled={isLoading}
              className="w-full flex items-center gap-3 px-3 py-3 md:py-2.5 text-base md:text-sm rounded-xl md:rounded-lg hover:bg-muted transition-all duration-200 disabled:opacity-50 text-left active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin" />
              ) : (
                <action.icon className="h-5 w-5 md:h-4 md:w-4 text-primary" />
              )}
              <div>
                <p className="font-medium">{action.label}</p>
                <p className="text-sm md:text-xs text-muted-foreground">{action.description}</p>
              </div>
            </button>
          ))}
          
          {/* Divider */}
          <div className="border-t border-border my-3" />
          
          {/* Quick Insert Section */}
          <p className="text-sm md:text-xs font-semibold text-muted-foreground px-2 py-1.5">
            Quick Insert
          </p>
          
          <button
            onClick={handleAddScheduleCall}
            className="w-full flex items-center gap-3 px-3 py-3 md:py-2.5 text-base md:text-sm rounded-xl md:rounded-lg hover:bg-muted transition-all duration-200 text-left active:scale-[0.98]"
          >
            <Calendar className="h-5 w-5 md:h-4 md:w-4 text-blue-500" />
            <div>
              <p className="font-medium">+ Schedule Call</p>
              <p className="text-sm md:text-xs text-muted-foreground">Add calendar link</p>
            </div>
          </button>
          
          <button
            onClick={handleAddIncomeAnalysis}
            className="w-full flex items-center gap-3 px-3 py-3 md:py-2.5 text-base md:text-sm rounded-xl md:rounded-lg hover:bg-muted transition-all duration-200 text-left active:scale-[0.98]"
          >
            <TrendingUp className="h-5 w-5 md:h-4 md:w-4 text-green-500" />
            <div>
              <p className="font-medium">+ Income Analysis</p>
              <p className="text-sm md:text-xs text-muted-foreground">Offer free report</p>
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
