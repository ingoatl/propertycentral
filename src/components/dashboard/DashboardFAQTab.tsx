import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FAQSection } from "../onboarding/FAQSection";
import { AskQuestionDialog } from "../faq/AskQuestionDialog";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, HelpCircle } from "lucide-react";
import { format } from "date-fns";

interface UserQuestion {
  id: string;
  question: string;
  category: string | null;
  status: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

export const DashboardFAQTab = () => {
  const [showAskDialog, setShowAskDialog] = useState(false);
  const [myQuestions, setMyQuestions] = useState<UserQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyQuestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("faq_questions")
        .select("*")
        .eq("asked_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMyQuestions(data || []);
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyQuestions();
  }, []);

  return (
    <div className="space-y-6">
      {/* Ask a Question Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Have a Question?
              </CardTitle>
              <CardDescription>
                Ask our team anything about property management
              </CardDescription>
            </div>
            <Button onClick={() => setShowAskDialog(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask a Question
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* My Questions Section */}
      {myQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Questions</CardTitle>
            <CardDescription>
              Questions you've asked and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myQuestions.map((q) => (
                <div key={q.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {q.category && (
                          <Badge variant="outline">{q.category}</Badge>
                        )}
                        <Badge
                          variant={q.status === "answered" ? "default" : "secondary"}
                        >
                          {q.status === "answered" ? "Answered" : "Pending"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(q.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="font-medium mb-2">{q.question}</p>
                      {q.answer && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-1">Answer:</p>
                          <p className="text-sm">{q.answer}</p>
                          {q.answered_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Answered on {format(new Date(q.answered_at), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQs Section */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>
            Common questions and answers about property management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FAQSection
            propertyId={undefined}
            projectId={undefined}
            faqs={[]}
            onUpdate={() => {}}
          />
        </CardContent>
      </Card>

      <AskQuestionDialog
        open={showAskDialog}
        onOpenChange={(open) => {
          setShowAskDialog(open);
          if (!open) loadMyQuestions();
        }}
      />
    </div>
  );
};
