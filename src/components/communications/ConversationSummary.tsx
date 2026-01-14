import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  RefreshCw,
  Clock,
  MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ConversationSummaryProps {
  leadId?: string;
  ownerId?: string;
  contactPhone?: string;
  contactEmail?: string;
  messageCount: number;
  unreadCount?: number;
  className?: string;
}

interface SummaryData {
  id: string;
  note: string;
  created_at: string;
}

export function ConversationSummary({
  leadId,
  ownerId,
  contactPhone,
  contactEmail,
  messageCount,
  unreadCount = 0,
  className,
}: ConversationSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  // Fetch existing summary
  useEffect(() => {
    const fetchExistingSummary = async () => {
      // Allow fetching for any contact type
      if (!leadId && !ownerId && !contactPhone && !contactEmail) return;
      
      setIsLoading(true);
      try {
        let query = supabase
          .from("conversation_notes")
          .select("id, note, created_at")
          .eq("is_ai_generated", true)
          .eq("summary_type", "thread_summary")
          .order("created_at", { ascending: false })
          .limit(1);

        if (leadId) {
          query = query.eq("lead_id", leadId);
        } else if (ownerId) {
          query = query.eq("owner_id", ownerId);
        } else if (contactPhone) {
          query = query.eq("contact_phone", contactPhone);
        } else if (contactEmail) {
          query = query.eq("contact_email", contactEmail);
        }

        const { data } = await query.maybeSingle();
        if (data) {
          setSummary(data);
        }
      } catch (error) {
        console.error("Error fetching summary:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingSummary();
  }, [leadId, ownerId, contactPhone, contactEmail]);

  // Auto-trigger for 10+ unread messages
  useEffect(() => {
    if (unreadCount >= 10 && !summary && !autoTriggered && messageCount >= 5) {
      setAutoTriggered(true);
      handleGenerateSummary();
    }
  }, [unreadCount, summary, autoTriggered, messageCount]);

  const handleGenerateSummary = async () => {
    // Allow summarization for any conversation with sufficient context
    if (!leadId && !ownerId && !contactPhone && !contactEmail) {
      toast.error("No contact information available to summarize");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-conversation", {
        body: {
          leadId,
          ownerId,
          contactPhone,
          contactEmail,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.summary) {
        setSummary({
          id: data.noteId || "temp",
          note: data.summary,
          created_at: new Date().toISOString(),
        });
        setIsOpen(true);
        toast.success("Summary generated");
      }
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast.error(error.message || "Failed to generate summary");
    } finally {
      setIsGenerating(false);
    }
  };

  // Don't show if less than 5 messages
  if (messageCount < 5) {
    return null;
  }

  const formatSummaryContent = (text: string) => {
    // Split by section headers (bold markdown)
    const sections = text.split(/\*\*([^*]+)\*\*:?\s*/g).filter(s => s.trim());
    
    const result: JSX.Element[] = [];
    for (let i = 0; i < sections.length; i += 2) {
      const header = sections[i]?.trim();
      const content = sections[i + 1]?.trim();
      if (header && content) {
        result.push(
          <div key={i} className="mb-3 last:mb-0">
            <div className="text-xs font-semibold text-primary mb-1">{header}</div>
            <div className="text-sm text-foreground/80 leading-relaxed">{content}</div>
          </div>
        );
      } else if (header) {
        // Handle case where there's text without header (fallback for bullet format)
        const cleanedLine = header.replace(/^[\d\.\-\*\•]+\s*/, "").trim();
        if (cleanedLine) {
          result.push(
            <li key={i} className="text-sm text-foreground/80 leading-relaxed mb-1">
              {cleanedLine}
            </li>
          );
        }
      }
    }
    
    // If no sections found, fall back to line-by-line parsing
    if (result.length === 0) {
      const lines = text.split(/\n/).filter(l => l.trim());
      return (
        <ul className="space-y-2 list-disc list-inside">
          {lines.map((line, i) => {
            const cleaned = line.replace(/^[\d\.\-\*\•]+\s*/, "").trim();
            return (
              <li key={i} className="text-sm text-foreground/80 leading-relaxed">
                {cleaned}
              </li>
            );
          })}
        </ul>
      );
    }
    
    // Check if we have list items vs structured sections
    const hasListItems = result.some(r => r.type === 'li');
    if (hasListItems) {
      return <ul className="space-y-2 list-disc list-inside">{result}</ul>;
    }
    
    return <div className="space-y-1">{result}</div>;
  };

  return (
    <Card className={cn("border-border/50 bg-muted/20", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between p-2 sm:p-3">
          <CollapsibleTrigger className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0">
            <div className="p-1 sm:p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Summary</span>
              {summary && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs h-5 px-1.5 hidden sm:flex">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                  {format(new Date(summary.created_at), "MMM d")}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] sm:text-xs h-5 px-1.5 flex-shrink-0">
                <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                {messageCount}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground ml-auto flex-shrink-0" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground ml-auto flex-shrink-0" />
            )}
          </CollapsibleTrigger>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateSummary();
            }}
            disabled={isGenerating}
            className="h-7 sm:h-8 px-2 sm:px-3 ml-1 sm:ml-2 flex-shrink-0"
          >
            {isGenerating ? (
              <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            )}
            <span className="ml-1 text-[10px] sm:text-xs">
              {summary ? "Refresh" : "Summarize"}
            </span>
          </Button>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : summary ? (
              <div className="bg-background/50 rounded-lg p-3 border border-border/30 max-h-[400px] overflow-y-auto">
                {formatSummaryContent(summary.note)}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground">
                  Click "Summarize" to generate an AI summary of this conversation
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
