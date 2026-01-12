import { Bot, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VoiceAIBadgeProps {
  callerPhone?: string;
  agentName?: string;
  onCallBack?: () => void;
  compact?: boolean;
}

// Helper to detect if a message is a Voice AI transcript
export function isVoiceAITranscript(body: string): boolean {
  if (!body) return false;
  return (
    body.includes("Your AI Employee has handled another call") ||
    body.includes("AI Agent Name:") ||
    body.includes("Call Transcript:")
  );
}

// Helper to extract caller phone from Voice AI transcript
export function extractCallerPhoneFromTranscript(body: string): string | null {
  if (!body) return null;
  const match = body.match(/Caller's Number:\s*(\+?\d[\d\s-]+)/);
  if (match) {
    return match[1].replace(/[\s-]/g, "").trim();
  }
  return null;
}

// Helper to extract AI agent name from transcript
export function extractAgentNameFromTranscript(body: string): string | null {
  if (!body) return null;
  const match = body.match(/AI Agent Name:\s*([^\n]+)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

// Helper to extract call summary from transcript
export function extractCallSummaryFromTranscript(body: string): string | null {
  if (!body) return null;
  const match = body.match(/Call Summary:\s*([\s\S]*?)(?:Call Transcript:|$)/);
  if (match) {
    return match[1].trim().slice(0, 200);
  }
  return null;
}

export function VoiceAIBadge({ callerPhone, agentName, onCallBack, compact = false }: VoiceAIBadgeProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 text-[10px] font-medium">
        <Bot className="h-2.5 w-2.5" />
        AI
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className="gap-1 bg-violet-500/10 text-violet-600 border-violet-200">
        <Bot className="h-3 w-3" />
        {agentName || "Voice AI"}
      </Badge>
      {callerPhone && onCallBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCallBack}
          className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 h-7"
        >
        <PhoneOutgoing className="h-3.5 w-3.5" />
          Call Back
        </Button>
      )}
    </div>
  );
}
