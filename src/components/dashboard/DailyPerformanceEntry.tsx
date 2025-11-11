import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useDailyPerformanceEntries } from "@/hooks/useDailyPerformanceEntries";
import { format } from "date-fns";

export function DailyPerformanceEntry() {
  const [entry, setEntry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { entries, loading, refetch } = useDailyPerformanceEntries({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async () => {
    if (!entry.trim()) {
      toast.error("Please enter your daily accomplishments");
      return;
    }

    if (entry.length > 500) {
      toast.error("Entry must be 500 characters or less");
      return;
    }

    try {
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("daily_performance_entries")
        .insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          entry: entry.trim()
        });

      if (error) throw error;

      toast.success("Daily entry submitted successfully!");
      setEntry("");
      refetch();
    } catch (error: any) {
      console.error("Error submitting entry:", error);
      toast.error(error.message || "Failed to submit entry");
    } finally {
      setSubmitting(false);
    }
  };

  const todayEntries = entries.filter(e => e.date === new Date().toISOString().split('T')[0]);
  const hasSubmittedToday = todayEntries.length > 0;

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasSubmittedToday && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          Daily Performance Entry
        </CardTitle>
        <CardDescription>
          What did you accomplish today? (tasks, visits, expenses, meetings, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSubmittedToday ? (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              ✓ You've already logged your entry for today:
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
              {todayEntries[0].entry}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Submitted at {format(new Date(todayEntries[0].created_at), 'h:mm a')}
            </p>
          </div>
        ) : (
          <>
            <Textarea
              placeholder="E.g., Completed 3 onboarding tasks for Villa property, logged 2 property visits, responded to 4 owner emails..."
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {entry.length}/500 characters
              </span>
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || !entry.trim()}
                className="gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Entry
              </Button>
            </div>
          </>
        )}

        {/* Recent Entries */}
        {entries.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">Your Recent Entries (Last 7 Days)</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {entries.map((e) => (
                <div 
                  key={e.id} 
                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {format(new Date(e.date), 'MMM d, yyyy')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), 'h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{e.entry}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
