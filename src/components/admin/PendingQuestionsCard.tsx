import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Clock, MapPin } from "lucide-react";
import { AnswerQuestionDialog } from "./AnswerQuestionDialog";
import { format } from "date-fns";

interface Question {
  id: string;
  question: string;
  category: string | null;
  created_at: string;
  asked_by: string;
  property_id: string | null;
  project_id: string | null;
  profiles?: {
    first_name: string | null;
    email: string;
  };
  properties?: {
    address: string;
  } | null;
}

export const PendingQuestionsCard = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [showAnswerDialog, setShowAnswerDialog] = useState(false);
  const { toast } = useToast();

  const loadPendingQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("faq_questions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles and properties separately
      const questionsWithDetails = await Promise.all((data || []).map(async (q) => {
        const profilePromise = supabase
          .from("profiles")
          .select("first_name, email")
          .eq("id", q.asked_by)
          .single();

        const propertyPromise = q.property_id
          ? supabase.from("properties").select("address").eq("id", q.property_id).single()
          : Promise.resolve({ data: null });

        const [{ data: profile }, { data: property }] = await Promise.all([
          profilePromise,
          propertyPromise,
        ]);

        return {
          ...q,
          profiles: profile,
          properties: property,
        };
      }));

      setQuestions(questionsWithDetails as any);
    } catch (error: any) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load pending questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingQuestions();
  }, []);

  const handleAnswer = (question: Question) => {
    setSelectedQuestion(question);
    setShowAnswerDialog(true);
  };

  const handleArchive = async (questionId: string) => {
    try {
      const { error } = await supabase
        .from("faq_questions")
        .update({ status: "archived" })
        .eq("id", questionId);

      if (error) throw error;

      toast({
        title: "Question archived",
      });
      loadPendingQuestions();
    } catch (error: any) {
      console.error("Error archiving question:", error);
      toast({
        title: "Error",
        description: "Failed to archive question",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Pending Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Pending Questions
            {questions.length > 0 && (
              <Badge variant="secondary">{questions.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No pending questions
            </p>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {q.category && (
                          <Badge variant="outline">{q.category}</Badge>
                        )}
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(q.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="font-medium mb-2">{q.question}</p>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>Asked by: {q.profiles?.first_name || q.profiles?.email || "Unknown"}</span>
                        {q.properties && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {q.properties.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAnswer(q)}>
                      Answer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchive(q.id)}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AnswerQuestionDialog
        open={showAnswerDialog}
        onOpenChange={setShowAnswerDialog}
        question={selectedQuestion}
        onAnswered={loadPendingQuestions}
      />
    </>
  );
};
