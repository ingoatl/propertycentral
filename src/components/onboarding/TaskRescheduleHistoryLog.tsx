import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronDown, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface RescheduleLog {
  id: string;
  previous_due_date: string;
  new_due_date: string;
  reason: string;
  rescheduled_by_name: string;
  rescheduled_at: string;
  days_delayed: number;
}

interface TaskRescheduleHistoryLogProps {
  taskId: string;
}

export const TaskRescheduleHistoryLog = ({ taskId }: TaskRescheduleHistoryLogProps) => {
  const [logs, setLogs] = useState<RescheduleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [taskId]);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("task_reschedule_logs")
        .select("*")
        .eq("task_id", taskId)
        .order("rescheduled_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Failed to load reschedule logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || logs.length === 0) return null;

  const totalDelays = logs.reduce((sum, log) => sum + log.days_delayed, 0);

  const getSeverityColor = (days: number) => {
    if (days <= 3) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (days <= 7) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between hover:bg-muted/50 rounded-none border-b"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-sm">Reschedule History</span>
              <Badge variant="secondary" className={cn("text-xs", getSeverityColor(totalDelays))}>
                {logs.length} {logs.length === 1 ? "time" : "times"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ({totalDelays} {totalDelays === 1 ? "day" : "days"} total delay)
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-3 bg-muted/20">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className="relative pl-6 pb-4 last:pb-0"
              >
                {/* Timeline line */}
                {index < logs.length - 1 && (
                  <div className="absolute left-2 top-6 bottom-0 w-px bg-border" />
                )}
                
                {/* Timeline dot */}
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-orange-500 border-2 border-background" />

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs", getSeverityColor(log.days_delayed))}>
                      +{log.days_delayed} {log.days_delayed === 1 ? "day" : "days"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.previous_due_date), "MMM d")} → {format(new Date(log.new_due_date), "MMM d, yyyy")}
                    </span>
                  </div>
                  
                  <p className="text-sm italic text-muted-foreground">
                    "{log.reason}"
                  </p>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>By {log.rescheduled_by_name}</span>
                    <span>•</span>
                    <span>{format(new Date(log.rescheduled_at), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
