import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FAQ } from "@/types/onboarding";

interface AddFAQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  projectId: string;
  existingFAQ?: FAQ | null;
  onSuccess: () => void;
}

const FAQ_CATEGORIES = [
  'Access & Entry',
  'Utilities & Amenities',
  'House Rules',
  'Maintenance',
  'Guest Experience',
  'Emergency',
  'Other'
];

export function AddFAQDialog({ 
  open, 
  onOpenChange, 
  propertyId, 
  projectId,
  existingFAQ,
  onSuccess 
}: AddFAQDialogProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingFAQ) {
      setQuestion(existingFAQ.question);
      setAnswer(existingFAQ.answer);
      setCategory(existingFAQ.category || "Other");
    } else {
      setQuestion("");
      setAnswer("");
      setCategory("Other");
    }
  }, [existingFAQ, open]);

  const handleSave = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Please fill in both question and answer");
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (existingFAQ) {
        // Update existing FAQ
        const { error } = await supabase
          .from('frequently_asked_questions')
          .update({
            question: question.trim(),
            answer: answer.trim(),
            category,
            answered_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFAQ.id);

        if (error) throw error;
        toast.success("FAQ updated successfully");
      } else {
        // Create new FAQ
        const { error } = await supabase
          .from('frequently_asked_questions')
          .insert({
            property_id: propertyId,
            project_id: projectId,
            question: question.trim(),
            answer: answer.trim(),
            category,
            asked_by: user?.id,
            answered_by: user?.id,
          });

        if (error) throw error;
        toast.success("FAQ added successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving FAQ:', error);
      toast.error("Failed to save FAQ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{existingFAQ ? 'Edit FAQ' : 'Add New FAQ'}</DialogTitle>
          <DialogDescription>
            {existingFAQ 
              ? 'Update the question and answer below.'
              : 'Add a frequently asked question and its answer for this property.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {FAQ_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              placeholder="e.g., What's the WiFi password?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              placeholder="Provide a detailed answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : existingFAQ ? "Update FAQ" : "Add FAQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
