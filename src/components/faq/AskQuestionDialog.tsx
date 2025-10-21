import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

interface AskQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  projectId?: string;
  taskId?: string;
}

export const AskQuestionDialog = ({ open, onOpenChange, propertyId, projectId, taskId }: AskQuestionDialogProps) => {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!question.trim()) {
      toast({
        title: "Question required",
        description: "Please enter your question",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .single();

      // Insert question
      const { data: questionData, error: insertError } = await supabase
        .from("faq_questions")
        .insert({
          question: question.trim(),
          category: category || "General",
          property_id: propertyId || null,
          project_id: projectId || null,
          task_id: taskId || null,
          asked_by: user.id,
          status: "pending"
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get property address if available
      let propertyAddress = "";
      if (propertyId) {
        const { data: property } = await supabase
          .from("properties")
          .select("address")
          .eq("id", propertyId)
          .single();
        propertyAddress = property?.address || "";
      }

      // Send notification to admin
      await supabase.functions.invoke("send-faq-notification", {
        body: {
          type: "new_question",
          question_id: questionData.id,
          user_email: profile?.email || user.email,
          user_name: profile?.first_name || "User",
          question_text: question.trim(),
          property_address: propertyAddress
        }
      });

      toast({
        title: "Question submitted",
        description: "You'll be notified when your question is answered.",
      });

      setQuestion("");
      setCategory("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting question:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit question",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ask a Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
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
            <label className="text-sm font-medium mb-2 block">Your Question</label>
            <Textarea
              placeholder="Type your question here..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={6}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Question"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
