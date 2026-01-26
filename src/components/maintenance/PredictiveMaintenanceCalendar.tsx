import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Calendar, ChevronLeft, ChevronRight, Loader2, 
  Snowflake, Droplets, Zap, Bug, Leaf, Wrench, 
  Send, SkipForward, CheckCircle, Clock, AlertCircle
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, subWeeks, addMonths, subMonths, isToday } from "date-fns";

interface ScheduledTask {
  id: string;
  scheduled_date: string;
  status: string;
  scheduled_time_window?: string;
  auto_assigned: boolean;
  assignment_reason?: string;
  work_order_id?: string;
  property: { id: string; name: string; address: string } | null;
  template: { id: string; name: string; category: string; description?: string; estimated_cost_low?: number; estimated_cost_high?: number } | null;
  vendor: { id: string; name: string; phone?: string } | null;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  hvac: { icon: Snowflake, color: "text-blue-600", bgColor: "bg-blue-100" },
  plumbing: { icon: Droplets, color: "text-cyan-600", bgColor: "bg-cyan-100" },
  electrical: { icon: Zap, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  pest_control: { icon: Bug, color: "text-orange-600", bgColor: "bg-orange-100" },
  exterior: { icon: Leaf, color: "text-green-600", bgColor: "bg-green-100" },
  pool_spa: { icon: Droplets, color: "text-teal-600", bgColor: "bg-teal-100" },
  appliances: { icon: Wrench, color: "text-purple-600", bgColor: "bg-purple-100" },
  general: { icon: Wrench, color: "text-gray-600", bgColor: "bg-gray-100" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: "Scheduled", color: "text-blue-600", bgColor: "bg-blue-100" },
  dispatched: { label: "Dispatched", color: "text-indigo-600", bgColor: "bg-indigo-100" },
  completed: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100" },
  skipped: { label: "Skipped", color: "text-gray-500", bgColor: "bg-gray-100" },
  cancelled: { label: "Cancelled", color: "text-red-500", bgColor: "bg-red-100" },
};

export function PredictiveMaintenanceCalendar() {
  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const queryClient = useQueryClient();

  const dateRange = useMemo(() => {
    if (view === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    };
  }, [view, currentDate]);

  const days = useMemo(() => eachDayOfInterval(dateRange), [dateRange]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["scheduled-maintenance-tasks", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_maintenance_tasks")
        .select(`
          *,
          property:properties(id, name, address),
          template:preventive_maintenance_templates(id, name, category, description, estimated_cost_low, estimated_cost_high),
          vendor:vendors(id, name, phone)
        `)
        .gte("scheduled_date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("scheduled_date", format(dateRange.end, "yyyy-MM-dd"))
        .order("scheduled_date");
      
      if (error) throw error;
      return data as unknown as ScheduledTask[];
    },
  });

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, ScheduledTask[]> = {};
    tasks.forEach((task) => {
      const dateKey = task.scheduled_date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(task);
    });
    return grouped;
  }, [tasks]);

  const navigate = (direction: "prev" | "next") => {
    if (view === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    }
  };

  const handleDispatch = async () => {
    if (!selectedTask) return;
    setIsDispatching(true);
    try {
      // Create a work order from the scheduled task
      const { data: workOrder, error: woError } = await supabase
        .from("work_orders")
        .insert({
          property_id: selectedTask.property?.id,
          title: selectedTask.template?.name || "Preventive Maintenance",
          description: selectedTask.template?.description || "",
          category: selectedTask.template?.category || "general",
          urgency: "normal",
          source: "preventive_maintenance",
          status: "dispatched",
          assigned_vendor_id: selectedTask.vendor?.id,
          estimated_cost: selectedTask.template?.estimated_cost_low,
          requires_vendor: true,
        })
        .select()
        .single();

      if (woError) throw woError;

      // Update the scheduled task
      const { error: updateError } = await supabase
        .from("scheduled_maintenance_tasks")
        .update({ 
          status: "dispatched", 
          work_order_id: workOrder.id,
          vendor_notified_at: new Date().toISOString()
        })
        .eq("id", selectedTask.id);

      if (updateError) throw updateError;

      // Notify vendor if assigned
      if (selectedTask.vendor?.id) {
        await supabase.functions.invoke("notify-vendor-work-order", {
          body: { workOrderId: workOrder.id },
        });
      }

      toast.success("Work order created and vendor notified");
      queryClient.invalidateQueries({ queryKey: ["scheduled-maintenance-tasks"] });
      setSelectedTask(null);
    } catch (error: any) {
      toast.error("Failed to dispatch: " + error.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSkip = async () => {
    if (!selectedTask) return;
    setIsSkipping(true);
    try {
      const { error } = await supabase
        .from("scheduled_maintenance_tasks")
        .update({ status: "skipped" })
        .eq("id", selectedTask.id);

      if (error) throw error;
      toast.success("Task skipped");
      queryClient.invalidateQueries({ queryKey: ["scheduled-maintenance-tasks"] });
      setSelectedTask(null);
    } catch (error: any) {
      toast.error("Failed to skip: " + error.message);
    } finally {
      setIsSkipping(false);
    }
  };

  const getCategoryConfig = (category: string) => CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Predictive Maintenance Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {view === "week" 
                  ? `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`
                  : format(currentDate, "MMMM yyyy")
                }
              </span>
              <Button variant="outline" size="icon" onClick={() => navigate("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex gap-1 ml-2">
                <Button
                  variant={view === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("week")}
                >
                  Week
                </Button>
                <Button
                  variant={view === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setView("month")}
                >
                  Month
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={`grid gap-1 ${view === "week" ? "grid-cols-7" : "grid-cols-7"}`}>
              {/* Day headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              
              {/* Calendar cells */}
              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDate[dateKey] || [];
                const isCurrentDay = isToday(day);
                
                return (
                  <div
                    key={dateKey}
                    className={`min-h-[100px] border rounded-md p-1 ${
                      isCurrentDay ? "bg-primary/5 border-primary/30" : "bg-background"
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((task) => {
                        const config = getCategoryConfig(task.template?.category || "general");
                        const Icon = config.icon;
                        const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.scheduled;
                        
                        return (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`w-full text-left rounded px-1.5 py-1 text-xs flex items-center gap-1 transition-colors hover:opacity-80 ${config.bgColor}`}
                          >
                            <Icon className={`h-3 w-3 flex-shrink-0 ${config.color}`} />
                            <span className="truncate flex-1">{task.template?.name}</span>
                            {task.status === "completed" && <CheckCircle className="h-3 w-3 text-green-600" />}
                            {task.status === "dispatched" && <Clock className="h-3 w-3 text-indigo-600" />}
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {Object.entries(CATEGORY_CONFIG).slice(0, 6).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-1 text-xs">
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${config.bgColor}`}>
                    <Icon className={`h-3 w-3 ${config.color}`} />
                  </div>
                  <span className="capitalize">{key.replace("_", " ")}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.template && (() => {
                const config = getCategoryConfig(selectedTask.template.category);
                const Icon = config.icon;
                return <Icon className={`h-5 w-5 ${config.color}`} />;
              })()}
              {selectedTask?.template?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={STATUS_CONFIG[selectedTask?.status || "scheduled"]?.bgColor}>
                {STATUS_CONFIG[selectedTask?.status || "scheduled"]?.label}
              </Badge>
            </div>

            {/* Property */}
            <div>
              <span className="text-sm text-muted-foreground">Property</span>
              <p className="font-medium">{selectedTask?.property?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedTask?.property?.address}</p>
            </div>

            {/* Scheduled Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Scheduled Date</span>
              <span className="font-medium">
                {selectedTask?.scheduled_date && format(new Date(selectedTask.scheduled_date + "T12:00:00"), "MMM d, yyyy")}
              </span>
            </div>

            {/* Assigned Vendor */}
            <div>
              <span className="text-sm text-muted-foreground">Assigned Vendor</span>
              {selectedTask?.vendor ? (
                <p className="font-medium">{selectedTask.vendor.name}</p>
              ) : (
                <p className="text-sm text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  No vendor assigned
                </p>
              )}
              {selectedTask?.auto_assigned && (
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-assigned: {selectedTask.assignment_reason}
                </p>
              )}
            </div>

            {/* Estimated Cost */}
            {selectedTask?.template?.estimated_cost_low && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Cost</span>
                <span className="font-medium">
                  ${selectedTask.template.estimated_cost_low} - ${selectedTask.template.estimated_cost_high}
                </span>
              </div>
            )}

            {/* Description */}
            {selectedTask?.template?.description && (
              <div>
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm mt-1">{selectedTask.template.description}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedTask?.status === "scheduled" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSkipping}
                  className="gap-2"
                >
                  {isSkipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
                  Skip
                </Button>
                <Button
                  onClick={handleDispatch}
                  disabled={isDispatching || !selectedTask.vendor}
                  className="gap-2"
                >
                  {isDispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Dispatch Now
                </Button>
              </>
            )}
            {selectedTask?.status === "dispatched" && selectedTask.work_order_id && (
              <Button variant="outline" onClick={() => setSelectedTask(null)}>
                View Work Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PredictiveMaintenanceCalendar;
