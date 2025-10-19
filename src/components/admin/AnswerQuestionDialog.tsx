import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const FAQ_CATEGORIES = [
  "General",
  "Maintenance",
  "Booking",
  "Payment",
  "Property Access",
  "Amenities",
  "Other"
];

interface Question {
  id: string;
  question: string;
  category: string | null;
  property_id: string | null;
  project_id: string | null;
  asked_by: string;
}

interface AnswerQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
  onAnswered: () => void;
}

export const AnswerQuestionDialog = ({ open, onOpenChange, question, onAnswered }: AnswerQuestionDialogProps) => {
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState<string>("");
  const [publishAsFAQ, setPublishAsFAQ] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!question || !answer.trim()) {
      toast({
        title: "Answer required",
        description: "Please enter your answer",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update question with answer
      const { error: updateError } = await supabase
        .from("faq_questions")
        .update({
          answer: answer.trim(),
          answered_by: user.id,
          answered_at: new Date().toISOString(),
          status: "answered",
          category: category || question.category || "General"
        })
        .eq("id", question.id);

      if (updateError) throw updateError;

      // Publish as FAQ if checked
      if (publishAsFAQ) {
        await supabase.from("frequently_asked_questions").insert({
          question: question.question,
          answer: answer.trim(),
          category: category || question.category || "General",
          property_id: question.property_id,
          project_id: question.project_id,
          asked_by: question.asked_by,
          answered_by: user.id
        });
      }

      // Get user details for notification
      const { data: askerProfile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", question.asked_by)
        .single();

      // Get property address if available
      let propertyAddress = "";
      if (question.property_id) {
        const { data: property } = await supabase
          .from("properties")
          .select("address")
          .eq("id", question.property_id)
          .single();
        propertyAddress = property?.address || "";
      }

      // Send notification to user
      await supabase.functions.invoke("send-faq-notification", {
        body: {
          type: "question_answered",
          question_id: question.id,
          user_email: askerProfile?.email,
          user_name: askerProfile?.first_name || "User",
          question_text: question.question,
          answer_text: answer.trim(),
          property_address: propertyAddress
        }
      });

      toast({
        title: "Answer submitted",
        description: publishAsFAQ ? "Question answered and published as FAQ" : "Question answered",
      });

      setAnswer("");
      setCategory("");
      setPublishAsFAQ(true);
      onOpenChange(false);
      onAnswered();
    } catch (error: any) {
      console.error("Error answering question:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit answer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Answer Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Question:</p>
            <p className="text-sm">{question?.question}</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={question?.category || "Select a category"} />
              </SelectTrigger>
              <SelectContent>
                {FAQ_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Your Answer</label>
            <Textarea
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={8}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="publish"
              checked={publishAsFAQ}
              onCheckedChange={(checked) => setPublishAsFAQ(checked as boolean)}
            />
            <label
              htmlFor="publish"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Publish as FAQ (visible to all users)
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Answer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
