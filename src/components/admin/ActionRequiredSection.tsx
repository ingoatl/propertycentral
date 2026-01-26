import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { PendingQuestionsCard } from "./PendingQuestionsCard";
import { DashboardBugReportsCard } from "./DashboardBugReportsCard";

export const ActionRequiredSection = () => {
  const [hasQuestions, setHasQuestions] = useState(false);
  const [hasBugs, setHasBugs] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkForActionItems = async () => {
      try {
        // Check for pending questions
        const { count: questionCount } = await supabase
          .from("faq_questions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");

        // Check for open/in-progress bugs
        const { count: bugCount } = await supabase
          .from("bug_reports")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]);

        setHasQuestions((questionCount || 0) > 0);
        setHasBugs((bugCount || 0) > 0);
      } catch (error) {
        console.error("Error checking action items:", error);
      } finally {
        setLoading(false);
      }
    };

    checkForActionItems();
  }, []);

  // Don't show anything if loading or no action items
  if (loading || (!hasQuestions && !hasBugs)) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20">
      <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-4">
        <AlertTriangle className="h-5 w-5" />
        Action Required
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasQuestions && <PendingQuestionsCard />}
        {hasBugs && <DashboardBugReportsCard />}
      </div>
    </div>
  );
};
