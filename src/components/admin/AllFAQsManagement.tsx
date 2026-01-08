import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Trash2, MessageCircleQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  property_id: string | null;
  project_id: string | null;
  created_at: string;
}

export const AllFAQsManagement = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [deletingFAQ, setDeletingFAQ] = useState<FAQ | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const FAQ_CATEGORIES = [
    'General',
    'Maintenance',
    'Booking',
    'Payment',
    'Property Access',
    'Amenities',
    'Other'
  ];

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const { data, error } = await supabase
        .from("frequently_asked_questions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error("Error loading FAQs:", error);
      toast.error("Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFAQ(faq);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  };

  const handleSaveEdit = async () => {
    if (!editingFAQ || !editQuestion.trim() || !editAnswer.trim()) {
      toast.error("Question and answer are required");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("frequently_asked_questions")
        .update({
          question: editQuestion.trim(),
          answer: editAnswer.trim(),
        })
        .eq("id", editingFAQ.id);

      if (error) throw error;

      toast.success("FAQ updated successfully");
      setEditingFAQ(null);
      setEditQuestion("");
      setEditAnswer("");
      loadFAQs();
    } catch (error) {
      console.error("Error updating FAQ:", error);
      toast.error("Failed to update FAQ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingFAQ) return;

    try {
      const { error } = await supabase
        .from("frequently_asked_questions")
        .delete()
        .eq("id", deletingFAQ.id);

      if (error) throw error;

      toast.success("FAQ deleted successfully");
      setDeletingFAQ(null);
      loadFAQs();
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      toast.error("Failed to delete FAQ");
    }
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchQuery === "" || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === null || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const groupedFAQs = filteredFAQs.reduce((acc, faq) => {
    const category = faq.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(faq);
    return acc;
  }, {} as Record<string, FAQ[]>);

  if (loading) {
    return <div>Loading FAQs...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5" />
          All FAQs Management
        </CardTitle>
        <CardDescription>
          Manage all frequently asked questions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All ({faqs.length})
            </Button>
            {FAQ_CATEGORIES.map(category => {
              const count = faqs.filter(f => f.category === category).length;
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        {/* FAQ List */}
        {Object.keys(groupedFAQs).length > 0 ? (
          <Accordion type="multiple" className="w-full">
            {Object.entries(groupedFAQs).map(([category, categoryFAQs]) => (
              <div key={category} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground mt-4 mb-2">
                  {category} ({categoryFAQs.length})
                </h3>
                {categoryFAQs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-left hover:no-underline">
                      <div className="flex items-start justify-between w-full pr-4">
                        <span className="font-medium">{faq.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {faq.answer}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(faq)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingFAQ(faq)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery || selectedCategory 
              ? "No FAQs match your search criteria"
              : "No FAQs available"}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingFAQ} onOpenChange={(open) => !open && setEditingFAQ(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit FAQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {editingFAQ?.category && (
              <div>
                <p className="text-sm font-medium mb-2">Category</p>
                <Badge variant="outline">{editingFAQ.category}</Badge>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Question</label>
              <Textarea
                placeholder="Enter question..."
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Answer</label>
              <Textarea
                placeholder="Enter answer..."
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFAQ(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingFAQ} onOpenChange={() => setDeletingFAQ(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
