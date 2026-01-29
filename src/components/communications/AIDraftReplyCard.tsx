import { useState } from "react";
import { Bot, Send, Pencil, X, Loader2, Sparkles, Presentation, RefreshCw, Palette, Home, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRESENTATION_LINKS = {
  designer: {
    label: "Designer Presentation",
    url: "https://propertycentral.lovable.app/p/designer",
    description: "Professional design services showcase",
    icon: Palette,
    context: "Interior design and furnishing services by designer Ilana. Showcase successful transformations like Southvale ($25K+ revenue) and Justice ($23K+). Great for unfurnished properties or owners looking to maximize earnings."
  },
  onboarding: {
    label: "Onboarding Presentation",
    url: "https://propertycentral.lovable.app/p/onboarding",
    description: "Full-service property management overview",
    icon: Briefcase,
    context: "Full-service property management by PeachHaus Group. Highlights 1400+ five-star reviews, comprehensive services, transparent pricing, and next steps for getting started."
  },
  ownerPortal: {
    label: "Owner Portal Presentation",
    url: "https://propertycentral.lovable.app/p/owner-portal",
    description: "Owner portal features & transparency",
    icon: Home,
    context: "Showcase the owner portal features: real-time performance tracking, monthly statements, maintenance updates, and full transparency. Great for leads asking about reporting or tracking their investment."
  },
};

interface AIDraftReplyCardProps {
  draftId: string;
  draftContent: string;
  confidenceScore?: number;
  onSend: (message: string) => void;
  onDismiss: () => void;
  onRegenerate?: (presentationContext?: string) => void;
  isSending?: boolean;
  isRegenerating?: boolean;
  leadId?: string;
  ownerId?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export function AIDraftReplyCard({
  draftId,
  draftContent,
  confidenceScore,
  onSend,
  onDismiss,
  onRegenerate,
  isSending = false,
  isRegenerating = false,
  leadId,
  ownerId,
  contactPhone,
  contactEmail,
}: AIDraftReplyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(draftContent);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleSend = async () => {
    const messageToSend = isEditing ? editedContent : draftContent;
    
    // Update draft status to sent or edited
    await supabase
      .from("ai_draft_replies")
      .update({ 
        status: isEditing ? "edited" : "sent",
        sent_at: new Date().toISOString(),
        draft_content: messageToSend,
      })
      .eq("id", draftId);

    onSend(messageToSend);
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await supabase
        .from("ai_draft_replies")
        .update({ 
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", draftId);
      
      onDismiss();
    } catch (error) {
      console.error("Error dismissing draft:", error);
      toast.error("Failed to dismiss draft");
    } finally {
      setIsDismissing(false);
    }
  };

  const confidenceLabel = confidenceScore 
    ? confidenceScore >= 0.8 ? "High confidence" 
    : confidenceScore >= 0.6 ? "Good confidence" 
    : "Draft ready"
    : "Draft ready";

  const confidenceColor = confidenceScore 
    ? confidenceScore >= 0.8 ? "bg-green-500/10 text-green-600" 
    : confidenceScore >= 0.6 ? "bg-blue-500/10 text-blue-600" 
    : "bg-amber-500/10 text-amber-600"
    : "bg-blue-500/10 text-blue-600";

  return (
    <div className="bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-violet-500/5 border border-violet-500/20 rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Bot className="h-4 w-4 text-violet-600" />
          </div>
          <span className="text-sm font-medium text-violet-700">AI Draft Ready</span>
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${confidenceColor}`}>
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            {confidenceLabel}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          disabled={isDismissing || isSending}
        >
          {isDismissing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Draft Content */}
      {isEditing ? (
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="min-h-[80px] text-sm bg-background/50 border-violet-500/20 focus:border-violet-500/40"
          placeholder="Edit your reply..."
        />
      ) : (
        <div className="bg-background/50 rounded-lg px-3 py-2 text-sm text-foreground/90 border border-violet-500/10">
          {draftContent}
        </div>
      )}

      {/* Character count for SMS */}
      {isEditing && (
        <div className="text-[10px] text-muted-foreground text-right">
          {editedContent.length}/160 {editedContent.length > 160 && <span className="text-amber-500">(will be split)</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={handleSend}
          disabled={isSending || isDismissing || isRegenerating}
        >
          {isSending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send{isEditing ? " Edited" : ""}
            </>
          )}
        </Button>
        
        {/* Regenerate with Context button */}
        <Button
          variant="outline"
          size="sm"
          className="border-violet-500/30 hover:bg-violet-500/10"
          onClick={() => onRegenerate?.()}
          disabled={isSending || isDismissing || isRegenerating || !onRegenerate}
        >
          {isRegenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Presentation Links Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-violet-500/30 hover:bg-violet-500/10"
              disabled={isSending || isDismissing || isRegenerating}
            >
              <Presentation className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Redraft with Presentation
            </div>
            <DropdownMenuSeparator />
            {Object.entries(PRESENTATION_LINKS).map(([key, link]) => {
              const Icon = link.icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={() => {
                    // Regenerate the draft with presentation context
                    const presentationContext = `Include this presentation link in the email: ${link.url}\n\nContext about this presentation: ${link.context}\n\nMake the email persuasively introduce the presentation and encourage them to watch it. Use the context to tailor the message.`;
                    onRegenerate?.(presentationContext);
                  }}
                  disabled={isRegenerating || !onRegenerate}
                  className="flex flex-col items-start gap-1 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{link.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">
                    {link.description}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button
          variant="outline"
          size="sm"
          className="border-violet-500/30 hover:bg-violet-500/10"
          onClick={() => {
            if (isEditing) {
              setEditedContent(draftContent);
            }
            setIsEditing(!isEditing);
          }}
          disabled={isSending || isDismissing || isRegenerating}
        >
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          {isEditing ? "Reset" : "Edit"}
        </Button>
      </div>
    </div>
  );
}
