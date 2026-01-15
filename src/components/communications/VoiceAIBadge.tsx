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

// Helper to extract caller's actual name from Voice AI transcript
// Parses the transcript conversation to find how the caller introduced themselves
// Supports both old format (User:) and new GHL format (human:)
export function extractCallerNameFromTranscript(body: string): string | null {
  if (!body) return null;
  
  // Common words that are NOT names
  const commonWords = [
    'yes', 'no', 'okay', 'sure', 'hello', 'hi', 'hey', 'thanks', 'thank', 'good', 'great',
    'just', 'please', 'connect', 'okay', 'ok', 'alright', 'right', 'yeah', 'yep', 'nope',
    'bot', 'human', 'user', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'one', 'moment',
    'hold', 'wait', 'transfer', 'call', 'back', 'calling', 'speaking', 'speak', 'talk', 'i',
    'um', 'uh', 'hmm', 'got', 'it', 'and', 'or', 'but', 'so', 'very', 'much', 'how'
  ];
  
  // Helper to validate name
  const isValidName = (name: string): boolean => {
    if (!name || name.length < 2) return false;
    const lowerName = name.toLowerCase();
    // Not a common word
    if (commonWords.includes(lowerName)) return false;
    // Not a phone number format
    if (/^[\d\s\-\(\)\+\.]+$/.test(name)) return false;
    // Not starting with +
    if (name.startsWith('+')) return false;
    // Should have at least one letter
    if (!/[a-zA-Z]/.test(name)) return false;
    // Should start with a capital letter for proper names
    if (!/^[A-Z]/.test(name)) return false;
    return true;
  };
  
  // GHL format patterns (human:Message)
  const ghlNamePatterns = [
    // "human:My name is [Name]" or "human:I'm [Name]" or "human:This is [Name]"
    /human:\s*(?:My name is|I'm|This is|I am|It's|Hi,?\s*(?:this is|I'm|it's))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    // "human:[Name]." at start - short response with name only (like "human:Tanya.")
    /human:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[.,!?\n]/g,
    // "human:Hi. My name is [Name]" 
    /human:\s*(?:Hi\.?|Hello\.?)\s*My name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    // Full name pattern like "human:Samuel Penn,"
    /human:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)[,.\s]/g,
    // "It's [Name]" pattern like "human:It's Addie Brook."
    /human:\s*It's\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  ];
  
  for (const pattern of ghlNamePatterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const name = match[1]?.trim();
      if (isValidName(name)) {
        return name;
      }
    }
  }
  
  // Also try old format patterns (User:Message)
  const oldFormatPatterns = [
    /User:\s*(?:My name is|I'm|This is|I am|It's|Hi,?\s*(?:this is|I'm))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    /User:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[.,!?\n]/g,
  ];
  
  for (const pattern of oldFormatPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const name = match[1]?.trim();
      if (isValidName(name)) {
        return name;
      }
    }
  }
  
  return null;
}

// Helper to extract mentioned team member names from Voice AI transcript
// This finds if a caller asked to speak with a specific team member like "Alex", "Anja", etc.
export function extractMentionedTeamMember(body: string): string | null {
  if (!body) return null;
  
  // Known team members (case-insensitive matching)
  const teamMembers = ['alex', 'anja', 'ingo', 'chris', 'christian', 'catherine'];
  
  // Patterns that indicate the caller wants to speak to someone specific
  const mentionPatterns = [
    // "connect me to Alex" or "transfer to Anja"
    /(?:connect|transfer|speak|talk)\s+(?:me\s+)?(?:to|with)\s+(\w+)/gi,
    // "is Alex available" or "can I speak with Ingo"
    /(?:is|can\s+I\s+speak\s+with|looking\s+for)\s+(\w+)\s+(?:available|there|around)?/gi,
    // "I'm looking for Alex" or "I need to reach Anja"
    /(?:looking\s+for|need\s+to\s+reach|trying\s+to\s+reach)\s+(\w+)/gi,
    // "Alex please" or "Ingo, please"
    /\b(\w+)[,]?\s*please\b/gi,
    // Direct reference in transcript like "human:Alex" or "bot:...Alex..."
    /(?:human|bot|user):\s*.*\b(alex|anja|ingo|chris|christian|catherine)\b/gi,
  ];
  
  for (const pattern of mentionPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const name = match[1]?.toLowerCase().trim();
      if (teamMembers.includes(name)) {
        // Return properly capitalized
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  }
  
  // Also do a simple scan for team member names in the body
  const bodyLower = body.toLowerCase();
  for (const member of teamMembers) {
    if (bodyLower.includes(member)) {
      return member.charAt(0).toUpperCase() + member.slice(1);
    }
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
