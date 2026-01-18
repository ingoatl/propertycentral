import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIResponseFeedbackProps {
  originalResponse: string;
  editedResponse?: string;
  knowledgeUsed?: string[];
  onFeedbackSubmitted?: () => void;
}

export function AIResponseFeedback({
  originalResponse,
  editedResponse,
  knowledgeUsed,
  onFeedbackSubmitted,
}: AIResponseFeedbackProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editType, setEditType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only show if there was an edit
  const hasEdit = editedResponse && editedResponse !== originalResponse;

  const handleSubmit = async (rating: "positive" | "negative") => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("ai_response_feedback").insert({
        original_response: originalResponse,
        edited_response: editedResponse || null,
        edit_type: hasEdit ? editType : null,
        context_json: {
          notes,
          rating,
          had_edit: hasEdit,
        },
        knowledge_used: knowledgeUsed ? knowledgeUsed : null,
      });

      if (error) throw error;

      toast.success("Feedback submitted - helps improve AI responses!");
      setIsOpen(false);
      setNotes("");
      setEditType("");
      onFeedbackSubmitted?.();
    } catch (error: unknown) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFeedback = async (rating: "positive" | "negative") => {
    if (!hasEdit) {
      // Quick feedback without opening modal
      await handleSubmit(rating);
    } else {
      // Need more info for edited responses
      setIsOpen(true);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => handleQuickFeedback("positive")}
        title="AI response was good"
      >
        <ThumbsUp className="h-3 w-3 text-muted-foreground hover:text-green-600" />
      </Button>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={hasEdit ? "Provide feedback on edit" : "AI response needed work"}
          >
            {hasEdit ? (
              <MessageSquare className="h-3 w-3 text-amber-500" />
            ) : (
              <ThumbsDown className="h-3 w-3 text-muted-foreground hover:text-red-600" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">AI Response Feedback</h4>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {hasEdit && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  What needed to be changed?
                </label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select edit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tone">Tone was off</SelectItem>
                    <SelectItem value="accuracy">Information was wrong</SelectItem>
                    <SelectItem value="completeness">Missing key details</SelectItem>
                    <SelectItem value="personalization">Not personalized enough</SelectItem>
                    <SelectItem value="too_long">Too long/verbose</SelectItem>
                    <SelectItem value="too_short">Too short/incomplete</SelectItem>
                    <SelectItem value="format">Wrong format</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Additional notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What should have been different?"
                className="h-20 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleSubmit("negative")}
                disabled={isSubmitting || (hasEdit && !editType)}
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Needs Work
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleSubmit("positive")}
                disabled={isSubmitting}
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Good
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Your feedback improves AI responses over time
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
