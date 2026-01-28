import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Calendar, 
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useUserTasks, UserTask, CreateTaskInput } from "@/hooks/useUserTasks";
import { cn } from "@/lib/utils";
import { format, isToday, isPast, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const priorityConfig = {
  urgent: { label: "Urgent", color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle },
  high: { label: "High", color: "bg-warning/20 text-warning border-warning/30", icon: AlertTriangle },
  medium: { label: "Medium", color: "bg-primary/20 text-primary border-primary/30", icon: Circle },
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border", icon: Circle },
};

const sourceIcons = {
  meeting: MessageSquare,
  call: Phone,
  email: Mail,
  manual: Circle,
  ai_suggested: Circle,
};

function TaskItem({ task, onComplete }: { task: UserTask; onComplete: (id: string) => void }) {
  const config = priorityConfig[task.priority];
  const SourceIcon = sourceIcons[task.source_type as keyof typeof sourceIcons] || Circle;
  
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && isToday(parseISO(task.due_date));

  return (
    <div className={cn(
      "group flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-muted/50",
      task.status === "completed" && "opacity-60"
    )}>
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={() => onComplete(task.id)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "font-medium text-sm",
            task.status === "completed" && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>
          {task.priority === "urgent" && (
            <Badge variant="outline" className={config.color}>
              <config.icon className="w-3 h-3 mr-1" />
              Urgent
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {task.source_type && task.source_type !== "manual" && (
            <span className="flex items-center gap-1">
              <SourceIcon className="w-3 h-3" />
              {task.source_type}
            </span>
          )}
          {task.due_date && (
            <span className={cn(
              "flex items-center gap-1",
              isOverdue && "text-destructive",
              isDueToday && "text-warning font-medium"
            )}>
              <Calendar className="w-3 h-3" />
              {isDueToday ? "Today" : format(parseISO(task.due_date), "MMM d")}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {task.description}
          </p>
        )}
      </div>
    </div>
  );
}

function AddTaskDialog({ onAdd }: { onAdd: (input: CreateTaskInput) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      due_date: dueDate || undefined,
    });
    
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🔵 Medium</SelectItem>
                  <SelectItem value="low">⚪ Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Add Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskSection({ 
  title, 
  tasks, 
  icon: Icon, 
  iconColor,
  onComplete,
  defaultCollapsed = false
}: { 
  title: string; 
  tasks: UserTask[]; 
  icon: React.ElementType;
  iconColor: string;
  onComplete: (id: string) => void;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-2">
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Icon className={cn("w-4 h-4", iconColor)} />
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" />
        )}
      </button>
      {!collapsed && (
        <div className="space-y-1">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onComplete={onComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function UserTasksPanel() {
  const { 
    urgentTasks, 
    todayTasks, 
    upcomingTasks,
    completedTasks,
    isLoading, 
    createTask,
    completeTask 
  } = useUserTasks();

  const totalPending = urgentTasks.length + todayTasks.length + upcomingTasks.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          My Tasks
          {totalPending > 0 && (
            <Badge variant="secondary">{totalPending}</Badge>
          )}
        </CardTitle>
        <AddTaskDialog onAdd={(input) => createTask.mutate(input)} />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : totalPending === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs">Add a task to get started</p>
          </div>
        ) : (
          <>
            <TaskSection
              title="Urgent"
              tasks={urgentTasks}
              icon={AlertTriangle}
              iconColor="text-red-400"
              onComplete={(id) => completeTask.mutate(id)}
            />
            <TaskSection
              title="Due Today"
              tasks={todayTasks}
              icon={Clock}
              iconColor="text-amber-400"
              onComplete={(id) => completeTask.mutate(id)}
            />
            <TaskSection
              title="Upcoming"
              tasks={upcomingTasks}
              icon={Calendar}
              iconColor="text-blue-400"
              onComplete={(id) => completeTask.mutate(id)}
            />
            <TaskSection
              title="Completed"
              tasks={completedTasks.slice(0, 5)}
              icon={CheckCircle2}
              iconColor="text-green-400"
              onComplete={(id) => completeTask.mutate(id)}
              defaultCollapsed={true}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
