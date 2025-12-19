import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Building2, 
  User, 
  CheckCircle2, 
  Mail, 
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight
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
  const [activeTab, setActiveTab] = useState("peachhaus");

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
  const completedTasks = tasks.filter(t => t.status === "completed");
  const peachHausTasks = tasks.filter(t => t.status !== "completed" && t.assigned_to !== "owner");
  const ownerTasks = tasks.filter(t => t.status !== "completed" && t.assigned_to === "owner");

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

  const TaskItem = ({ task, showReassign = true }: { task: Task; showReassign?: boolean }) => (
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
        {showReassign && task.status !== "completed" && (
          <div className="flex gap-1 pt-1">
            {task.assigned_to !== "owner" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => handleReassignTask(task.id, "owner")}
              >
                <ArrowRight className="h-3 w-3" />
                Move to Owner
              </Button>
            )}
            {task.assigned_to === "owner" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => handleReassignTask(task.id, "peachhaus")}
              >
                <ArrowRight className="h-3 w-3" />
                Move to PeachHaus
              </Button>
            )}
          </div>
        )}
      </div>
      {completingTask === task.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
    </div>
  );

  const TaskList = ({ taskList, emptyMessage }: { taskList: Task[]; emptyMessage: string }) => (
    <ScrollArea className="h-[50vh]">
      {taskList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500/50 mb-3" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2 pr-4">
          {taskList.map((task) => (
            <TaskItem key={task.id} task={task} showReassign={task.status !== "completed"} />
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Clock className="w-5 h-5 text-primary" />
            Initial Setup Tasks
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{propertyName}</p>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {peachHausTasks.length + ownerTasks.length} pending • {completedTasks.length} completed
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
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No setup tasks found for this property.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload owner intel documents to generate tasks.
              </p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid grid-cols-3 mb-4 flex-shrink-0">
                <TabsTrigger value="peachhaus" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  PeachHaus
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    {peachHausTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="owner" className="gap-2">
                  <User className="w-4 h-4" />
                  Owner
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    {ownerTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                    {completedTasks.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="peachhaus" className="h-full mt-0">
                  <TaskList 
                    taskList={peachHausTasks} 
                    emptyMessage="No pending PeachHaus tasks" 
                  />
                </TabsContent>
                <TabsContent value="owner" className="h-full mt-0">
                  <TaskList 
                    taskList={ownerTasks} 
                    emptyMessage="No pending owner tasks" 
                  />
                </TabsContent>
                <TabsContent value="completed" className="h-full mt-0">
                  <TaskList 
                    taskList={completedTasks} 
                    emptyMessage="No completed tasks yet" 
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
