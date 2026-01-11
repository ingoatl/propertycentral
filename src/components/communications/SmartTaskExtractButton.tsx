import { useState } from "react";
import { Sparkles, Loader2, Calendar, Phone, Mail, FileText, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ExtractedAction {
  type: "schedule_call" | "send_email" | "create_task" | "request_info" | "follow_up";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  data?: Record<string, any>;
}

interface SmartTaskExtractButtonProps {
  conversationThread: Array<{
    type: string;
    direction: string;
    body: string;
    created_at: string;
    subject?: string;
  }>;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  contactId?: string;
  contactType: string;
  leadId?: string;
  onActionExecuted?: () => void;
}

export function SmartTaskExtractButton({
  conversationThread,
  contactName,
  contactPhone,
  contactEmail,
  contactId,
  contactType,
  leadId,
  onActionExecuted,
}: SmartTaskExtractButtonProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedActions, setExtractedActions] = useState<ExtractedAction[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const handleExtractActions = async () => {
    if (conversationThread.length === 0) {
      toast.error("No conversation to analyze");
      return;
    }

    setIsExtracting(true);
    setExtractedActions([]);

    try {
      // Build conversation context
      const conversationText = conversationThread
        .slice(0, 15)
        .map((msg) => {
          const dir = msg.direction === "outbound" ? "US" : "THEM";
          return `[${dir}]: ${msg.body}`;
        })
        .join("\n");

      const { data, error } = await supabase.functions.invoke("extract-smart-actions", {
        body: {
          conversationText,
          contactName,
          contactPhone,
          contactEmail,
          contactType,
        },
      });

      if (error) throw error;

      if (data?.actions && data.actions.length > 0) {
        setExtractedActions(data.actions);
        setIsOpen(true);
        toast.success(`Found ${data.actions.length} suggested action${data.actions.length > 1 ? 's' : ''}`);
      } else {
        toast.info("No specific actions detected in this conversation");
      }
    } catch (error: any) {
      console.error("Error extracting actions:", error);
      toast.error(`Failed to analyze: ${error.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExecuteAction = async (action: ExtractedAction, index: number) => {
    setExecutingAction(`${index}`);

    try {
      switch (action.type) {
        case "schedule_call":
          // Open scheduling modal or navigate to calendar
          toast.info("Opening scheduling...");
          // Could trigger the SmartSchedulingCard here
          break;

        case "send_email":
          // Could open email compose with pre-filled content
          toast.info("Opening email composer...");
          break;

        case "request_info":
          // Send an SMS asking for the missing info
          if (contactPhone) {
            const message = action.data?.message || `Hi ${contactName?.split(" ")[0]}! Quick question - ${action.description}`;
            await supabase.functions.invoke("ghl-send-sms", {
              body: {
                leadId: leadId || (contactType === "lead" ? contactId : undefined),
                phone: contactPhone,
                message,
              },
            });
            toast.success("Request sent!");
            onActionExecuted?.();
          }
          break;

        case "follow_up":
          // Create a pending task confirmation
          const { error: taskError } = await supabase
            .from("pending_task_confirmations")
            .insert({
              task_title: action.title,
              task_description: action.description,
              priority: action.priority,
              status: "pending",
              source_type: "conversation",
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
          
          if (taskError) throw taskError;
          toast.success("Follow-up task created!");
          break;

        case "create_task":
          // Create a pending task confirmation
          const { error: generalTaskError } = await supabase
            .from("pending_task_confirmations")
            .insert({
              task_title: action.title,
              task_description: action.description,
              priority: action.priority,
              status: "pending",
              source_type: "conversation",
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            });
          
          if (generalTaskError) throw generalTaskError;
          toast.success("Task created!");
          break;
      }

      // Remove the executed action from the list
      setExtractedActions(prev => prev.filter((_, i) => i !== index));
    } catch (error: any) {
      console.error("Error executing action:", error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setExecutingAction(null);
    }
  };

  const handleDismissAction = (index: number) => {
    setExtractedActions(prev => prev.filter((_, i) => i !== index));
  };

  const getActionIcon = (type: ExtractedAction["type"]) => {
    switch (type) {
      case "schedule_call":
        return <Calendar className="h-3.5 w-3.5" />;
      case "send_email":
        return <Mail className="h-3.5 w-3.5" />;
      case "request_info":
        return <Phone className="h-3.5 w-3.5" />;
      case "follow_up":
      case "create_task":
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const priorityColors = {
    high: "bg-red-500/10 text-red-600 border-red-500/20",
    medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    low: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  if (extractedActions.length > 0) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">
                  {extractedActions.length} Suggested Action{extractedActions.length > 1 ? 's' : ''}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-2 mt-3">
            {extractedActions.map((action, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 bg-background/80 rounded-lg border"
              >
                <div className={`p-1.5 rounded ${priorityColors[action.priority]}`}>
                  {getActionIcon(action.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {action.description}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                    onClick={() => handleExecuteAction(action, index)}
                    disabled={executingAction === `${index}`}
                  >
                    {executingAction === `${index}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDismissAction(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExtractActions}
      disabled={isExtracting || conversationThread.length === 0}
      className="gap-2"
    >
      {isExtracting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Extract Actions
        </>
      )}
    </Button>
  );
}
