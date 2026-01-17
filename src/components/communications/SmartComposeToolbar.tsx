import { useState } from "react";
import { Sparkles, Loader2, Wand2, ListChecks, TrendingUp, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useSmartCompose } from "@/hooks/useSmartCompose";
import { useToneProfile } from "@/hooks/useToneProfile";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SmartComposeToolbarProps {
  currentMessage: string;
  onMessageGenerated: (message: string, subject?: string) => void;
  messageType: "email" | "sms";
  contactName?: string;
  contactEmail?: string;
  replyToContent?: string;
}

export function SmartComposeToolbar({
  currentMessage,
  onMessageGenerated,
  messageType,
  contactName,
  contactEmail,
  replyToContent,
}: SmartComposeToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bulletsMode, setBulletsMode] = useState(false);
  const [bullets, setBullets] = useState("");
  
  const { profile: toneProfile } = useToneProfile();
  const { composeFromBullets, improveMessage, generateReply, isLoading } = useSmartCompose();

  const handleImprove = async () => {
    if (!currentMessage.trim()) {
      toast.error("Enter some text first to improve");
      return;
    }
    
    try {
      const result = await improveMessage(currentMessage, messageType, contactName);
      if (result?.message) {
        onMessageGenerated(result.message, result.subject);
        setIsOpen(false);
        toast.success("Message improved using your tone!");
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleGenerateReply = async () => {
    if (!replyToContent) {
      toast.error("No message to reply to");
      return;
    }
    
    try {
      const result = await generateReply(replyToContent, messageType, contactName, contactEmail);
      if (result?.message) {
        onMessageGenerated(result.message, result.subject);
        setIsOpen(false);
        toast.success("Reply generated in your voice!");
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleComposeFromBullets = async () => {
    const bulletList = bullets
      .split("\n")
      .map(b => b.trim().replace(/^[-•*]\s*/, ""))
      .filter(b => b.length > 0);
    
    if (bulletList.length === 0) {
      toast.error("Enter at least one bullet point");
      return;
    }
    
    try {
      const result = await composeFromBullets(bulletList, messageType, contactName, contactEmail);
      if (result?.message) {
        onMessageGenerated(result.message, result.subject);
        setBullets("");
        setBulletsMode(false);
        setIsOpen(false);
        toast.success("Email composed from your notes!");
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1.5"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          <span className="hidden sm:inline">Smart Compose</span>
          {toneProfile && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 hidden sm:inline-flex">
              Your voice
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start" side="top">
        {bulletsMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Write from Bullets</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBulletsMode(false)}
              >
                ← Back
              </Button>
            </div>
            
            <Textarea
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              placeholder={"• Can meet Tuesday\n• Need property photos\n• Discuss pricing..."}
              rows={4}
              className="text-sm"
            />
            
            <p className="text-xs text-muted-foreground">
              Enter key points on separate lines. AI will compose a full {messageType} in your voice.
            </p>
            
            <Button
              className="w-full"
              onClick={handleComposeFromBullets}
              disabled={isLoading || !bullets.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Compose {messageType === "email" ? "Email" : "SMS"}
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                AI Writing Assistant
              </span>
              {toneProfile && (
                <Badge variant="outline" className="text-[10px]">
                  Using your tone
                </Badge>
              )}
            </div>
            
            <button
              onClick={() => setBulletsMode(true)}
              className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
            >
              <ListChecks className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">Write from bullets</p>
                <p className="text-xs text-muted-foreground">Turn notes into full message</p>
              </div>
            </button>
            
            <button
              onClick={handleImprove}
              disabled={isLoading || !currentMessage.trim()}
              className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">Improve message</p>
                <p className="text-xs text-muted-foreground">Polish in your voice</p>
              </div>
            </button>
            
            {replyToContent && (
              <button
                onClick={handleGenerateReply}
                disabled={isLoading}
                className="w-full flex items-center gap-3 px-2 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <MessageSquare className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium">Auto-reply</p>
                  <p className="text-xs text-muted-foreground">Generate contextual reply</p>
                </div>
              </button>
            )}
            
            {!toneProfile && (
              <div className="mt-3 p-2 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 inline mr-1" />
                  Analyze your sent messages in Settings to enable personalized tone.
                </p>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
