import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PhoneCall, Bot, ChevronDown, Loader2 } from "lucide-react";

interface AIVoiceCallButtonProps {
  leadId: string;
  leadPhone?: string | null;
  leadName: string;
  leadStage: string;
}

const CALL_TYPES = [
  {
    id: "follow_up",
    label: "Follow-up Call",
    description: "General follow-up to re-engage",
  },
  {
    id: "appointment_reminder",
    label: "Appointment Reminder",
    description: "Remind about scheduled call",
  },
  {
    id: "contract_nudge",
    label: "Contract Nudge",
    description: "Encourage contract completion",
  },
  {
    id: "qualification",
    label: "Qualification Call",
    description: "Qualify the lead with questions",
  },
  {
    id: "breakup",
    label: "Break-up Call",
    description: "Final attempt before closing lead",
  },
];

export function AIVoiceCallButton({
  leadId,
  leadPhone,
  leadName,
  leadStage,
}: AIVoiceCallButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeCallType, setActiveCallType] = useState<string | null>(null);

  const initiateCall = async (callType: string) => {
    if (!leadPhone) {
      toast.error("No phone number available for this lead");
      return;
    }

    setIsLoading(true);
    setActiveCallType(callType);

    try {
      const { data, error } = await supabase.functions.invoke("lead-ai-voice-call", {
        body: {
          leadId,
          callType,
        },
      });

      if (error) throw error;

      toast.success(`AI call initiated to ${leadName}`, {
        description: `Call SID: ${data.callSid?.slice(-8)}`,
      });
    } catch (error: any) {
      console.error("Error initiating AI voice call:", error);
      toast.error("Failed to initiate call", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
      setActiveCallType(null);
    }
  };

  if (!leadPhone) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 border-violet-200"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Bot className="h-4 w-4 mr-2" />
          )}
          AI Call
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4" />
          AI Voice Calls
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CALL_TYPES.map((callType) => (
          <DropdownMenuItem
            key={callType.id}
            onClick={() => initiateCall(callType.id)}
            disabled={isLoading}
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium">
              {isLoading && activeCallType === callType.id ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calling...
                </span>
              ) : (
                callType.label
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {callType.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
