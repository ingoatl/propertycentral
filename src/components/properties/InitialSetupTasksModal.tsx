import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Building2, 
  User, 
  CheckCircle2, 
  Mail, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  AlertCircle,
  Clock
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  category: string | null;
  assigned_to: string | null;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
}

interface InitialSetupTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
  ownerEmail?: string | null;
}

export function InitialSetupTasksModal({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  ownerEmail,
}: InitialSetupTasksModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (open && propertyId) {
      loadTasks();
    }
  }, [open, propertyId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      // Find the conversation linked to this property
      const { data: conversations, error: convError } = await supabase
        .from("owner_conversations")
        .select("id")
        .eq("property_id", propertyId);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        setTasks([]);
        return;
      }

      const conversationIds = conversations.map(c => c.id);

      // Get all task-type actions for these conversations
      const { data: actions, error: actionsError } = await supabase
        .from("owner_conversation_actions")
        .select("*")
        .in("conversation_id", conversationIds)
        .eq("action_type", "task")
        .order("created_at", { ascending: true });

      if (actionsError) throw actionsError;

      setTasks(actions || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      setCompletingTask(taskId);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("owner_conversation_actions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user?.id || null,
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Task marked as complete");
      await loadTasks();
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Failed to complete task");
    } finally {
      setCompletingTask(null);
    }
  };

  const handleReassignTask = async (taskId: string, newAssignee: 'peachhaus' | 'owner') => {
    try {
      const { error } = await supabase
        .from("owner_conversation_actions")
        .update({ assigned_to: newAssignee })
        .eq("id", taskId);

      if (error) throw error;

      toast.success(`Task reassigned to ${newAssignee === 'peachhaus' ? 'PeachHaus' : 'Owner'}`);
      await loadTasks();
    } catch (error) {
      console.error("Error reassigning task:", error);
      toast.error("Failed to reassign task");
    }
  };

  const handleSendOwnerEmail = async () => {
    if (!ownerEmail) {
      toast.error("No owner email configured for this property");
      return;
    }

    try {
      setSendingEmail(true);
      
      const { error } = await supabase.functions.invoke("send-owner-setup-status", {
        body: {
          propertyId,
          propertyName,
          ownerEmail,
          tasks: ownerTasks,
        },
      });

      if (error) throw error;

      toast.success("Owner status email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  // Separate tasks by assignee and status
  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const completedTasks = tasks.filter(t => t.status === "completed");
  
  const peachHausTasks = pendingTasks.filter(t => t.assigned_to !== "owner");
  const ownerTasks = pendingTasks.filter(t => t.assigned_to === "owner");

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const TaskItem = ({ task }: { task: Task }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <Checkbox
        checked={task.status === "completed"}
        disabled={completingTask === task.id || task.status === "completed"}
        onCheckedChange={() => handleCompleteTask(task.id)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </span>
          {task.priority && (
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>
          )}
          {task.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {task.category}
            </Badge>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        {task.status !== "completed" && (
          <div className="flex gap-1 pt-1">
            {task.assigned_to !== "owner" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleReassignTask(task.id, "owner")}
              >
                → Move to Owner
              </Button>
            )}
            {task.assigned_to === "owner" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => handleReassignTask(task.id, "peachhaus")}
              >
                → Move to PeachHaus
              </Button>
            )}
          </div>
        )}
      </div>
      {completingTask === task.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="w-5 h-5 text-primary" />
            Initial Setup Tasks
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{propertyName}</p>
        </DialogHeader>

        <div className="flex-shrink-0 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {pendingTasks.length} pending • {completedTasks.length} completed
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendOwnerEmail}
            disabled={sendingEmail || ownerTasks.length === 0}
            className="gap-2"
          >
            {sendingEmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Send Owner Status Email
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No setup tasks found for this property.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload owner intel documents to generate tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* PeachHaus Tasks Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">PeachHaus Tasks</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {peachHausTasks.length}
                  </Badge>
                </div>
                {peachHausTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">No pending tasks</p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {peachHausTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>

              {/* Owner Tasks Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-orange-500" />
                  <h3 className="font-semibold text-sm">Owner Tasks</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {ownerTasks.length}
                  </Badge>
                </div>
                {ownerTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">No pending owner tasks</p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {ownerTasks.map((task) => (
                      <TaskItem key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>

              {/* Completed Tasks Section */}
              {completedTasks.length > 0 && (
                <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-9 px-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium">Completed Tasks</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {completedTasks.length}
                        </Badge>
                      </div>
                      {showCompleted ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 pl-6 pt-2">
                      {completedTasks.map((task) => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
