import { useState, useMemo } from "react";
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
  ChevronRight,
  Pin,
  FileText,
  Users,
  Sparkles
} from "lucide-react";
import { useUserTasks, UserTask, CreateTaskInput } from "@/hooks/useUserTasks";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast, parseISO, isThisWeek, addDays, startOfWeek, endOfWeek } from "date-fns";

// Helper function since date-fns doesn't have isNextWeek
function isNextWeek(date: Date): boolean {
  const nextWeekStart = startOfWeek(addDays(new Date(), 7));
  const nextWeekEnd = endOfWeek(addDays(new Date(), 7));
  return date >= nextWeekStart && date <= nextWeekEnd;
}
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const priorityConfig = {
  urgent: { label: "Urgent", color: "bg-destructive/20 text-destructive border-destructive/30", dot: "bg-destructive" },
  high: { label: "High", color: "bg-warning/20 text-warning border-warning/30", dot: "bg-warning" },
  medium: { label: "Medium", color: "bg-primary/20 text-primary border-primary/30", dot: "bg-primary" },
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};

const sourceConfig: Record<string, { icon: typeof Circle; label: string; color: string }> = {
  meeting: { icon: Users, label: "Meeting", color: "text-purple-500" },
  call: { icon: Phone, label: "Call", color: "text-green-500" },
  email: { icon: Mail, label: "Email", color: "text-blue-500" },
  manual: { icon: Circle, label: "Manual", color: "text-muted-foreground" },
  ai_suggested: { icon: Sparkles, label: "AI", color: "text-amber-500" },
  onboarding: { icon: FileText, label: "Onboarding", color: "text-cyan-500" },
};

interface DateGroup {
  key: string;
  label: string;
  tasks: UserTask[];
  icon: typeof Calendar;
  showDate: boolean;
}

function TaskItem({ 
  task, 
  onComplete,
  onTogglePin,
  showSource = true 
}: { 
  task: UserTask & { is_pinned?: boolean }; 
  onComplete: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  showSource?: boolean;
}) {
  const config = priorityConfig[task.priority];
  const sourceInfo = sourceConfig[task.source_type || "manual"] || sourceConfig.manual;
  const SourceIcon = sourceInfo.icon;
  
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
  const isDueToday = task.due_date && isToday(parseISO(task.due_date));

  return (
    <div className={cn(
      "group flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-muted/50",
      task.status === "completed" && "opacity-60",
      task.priority === "urgent" && "border-destructive/30 bg-destructive/5"
    )}>
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={() => onComplete(task.id)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn("w-2 h-2 rounded-full", config.dot)} />
          <span className={cn(
            "font-medium text-sm",
            task.status === "completed" && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>
          {(task as any).is_pinned && (
            <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
          {showSource && task.source_type && task.source_type !== "manual" && (
            <span className={cn("flex items-center gap-1", sourceInfo.color)}>
              <SourceIcon className="w-3 h-3" />
              {sourceInfo.label}
            </span>
          )}
          {task.due_date && (
            <span className={cn(
              "flex items-center gap-1",
              isOverdue && "text-destructive font-medium",
              isDueToday && "text-warning font-medium"
            )}>
              <Clock className="w-3 h-3" />
              {isDueToday ? "Today" : isOverdue ? `${Math.floor((new Date().getTime() - parseISO(task.due_date).getTime()) / (1000 * 60 * 60 * 24))}d overdue` : format(parseISO(task.due_date), "MMM d")}
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {task.description}
          </p>
        )}
      </div>
      {onTogglePin && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onTogglePin(task.id, !(task as any).is_pinned)}
        >
          <Pin className={cn("w-3 h-3", (task as any).is_pinned && "fill-current")} />
        </Button>
      )}
    </div>
  );
}

function AddTaskDialog({ onAdd }: { onAdd: (input: CreateTaskInput) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("general");

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
    setCategory("general");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="w-4 h-4" />
          Add
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

function DateGroupSection({ 
  group, 
  onComplete,
  onTogglePin,
  defaultOpen = true 
}: { 
  group: DateGroup;
  onComplete: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = group.icon;

  if (group.tasks.length === 0) return null;

  const completedCount = group.tasks.filter(t => t.status === "completed").length;
  const progress = group.tasks.length > 0 ? Math.round((completedCount / group.tasks.length) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2">
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{group.label}</span>
        <Badge variant="secondary" className="ml-1 text-xs">
          {completedCount}/{group.tasks.length}
        </Badge>
        {progress > 0 && progress < 100 && (
          <div className="flex-1 max-w-[60px] h-1 bg-muted rounded-full overflow-hidden ml-2">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        )}
        {progress === 100 && (
          <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-2 pl-6">
          {group.tasks.map((task) => (
            <TaskItem 
              key={task.id} 
              task={task} 
              onComplete={onComplete}
              onTogglePin={onTogglePin}
              showSource={true}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function EnhancedUserTasksPanel() {
  const { 
    tasks, 
    isLoading, 
    createTask,
    completeTask,
    updateTask,
  } = useUserTasks();

  // Group tasks by date
  const dateGroups = useMemo((): DateGroup[] => {
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const tomorrowStr = format(addDays(now, 1), "yyyy-MM-dd");

    // Separate pinned/urgent tasks
    const pinnedTasks = tasks.filter(t => (t as any).is_pinned && t.status !== "completed");
    const nonPinnedTasks = tasks.filter(t => !(t as any).is_pinned);

    // Today's tasks
    const todayTasks = nonPinnedTasks.filter(t => 
      t.due_date === todayStr && t.status !== "completed"
    );

    // Tomorrow's tasks
    const tomorrowTasks = nonPinnedTasks.filter(t => 
      t.due_date === tomorrowStr && t.status !== "completed"
    );

    // This week (excluding today/tomorrow)
    const thisWeekTasks = nonPinnedTasks.filter(t => {
      if (!t.due_date || t.status === "completed") return false;
      const date = parseISO(t.due_date);
      return isThisWeek(date) && t.due_date !== todayStr && t.due_date !== tomorrowStr && !isPast(date);
    });

    // Next week
    const nextWeekTasks = nonPinnedTasks.filter(t => {
      if (!t.due_date || t.status === "completed") return false;
      const date = parseISO(t.due_date);
      return isNextWeek(date);
    });

    // Later (no due date or beyond next week)
    const laterTasks = nonPinnedTasks.filter(t => {
      if (t.status === "completed") return false;
      if (!t.due_date) return true;
      const date = parseISO(t.due_date);
      return !isPast(date) && !isThisWeek(date) && !isNextWeek(date);
    });

    // Overdue
    const overdueTasks = nonPinnedTasks.filter(t => {
      if (!t.due_date || t.status === "completed") return false;
      const date = parseISO(t.due_date);
      return isPast(date) && !isToday(date);
    });

    // Completed (recent)
    const completedTasks = tasks.filter(t => t.status === "completed").slice(0, 5);

    const groups: DateGroup[] = [];

    if (pinnedTasks.length > 0) {
      groups.push({
        key: "pinned",
        label: "📌 Pinned",
        tasks: pinnedTasks,
        icon: Pin,
        showDate: true,
      });
    }

    if (overdueTasks.length > 0) {
      groups.push({
        key: "overdue",
        label: "⚠️ Overdue",
        tasks: overdueTasks.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
        icon: AlertTriangle,
        showDate: true,
      });
    }

    if (todayTasks.length > 0 || true) { // Always show today
      groups.push({
        key: "today",
        label: `📅 Today - ${format(now, "MMM d")}`,
        tasks: todayTasks,
        icon: Calendar,
        showDate: false,
      });
    }

    if (tomorrowTasks.length > 0) {
      groups.push({
        key: "tomorrow",
        label: `📅 Tomorrow - ${format(addDays(now, 1), "MMM d")}`,
        tasks: tomorrowTasks,
        icon: Calendar,
        showDate: false,
      });
    }

    if (thisWeekTasks.length > 0) {
      groups.push({
        key: "this-week",
        label: "This Week",
        tasks: thisWeekTasks.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
        icon: Calendar,
        showDate: true,
      });
    }

    if (nextWeekTasks.length > 0) {
      groups.push({
        key: "next-week",
        label: "Next Week",
        tasks: nextWeekTasks.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()),
        icon: Calendar,
        showDate: true,
      });
    }

    if (laterTasks.length > 0) {
      groups.push({
        key: "later",
        label: "Later / No Date",
        tasks: laterTasks,
        icon: Circle,
        showDate: true,
      });
    }

    if (completedTasks.length > 0) {
      groups.push({
        key: "completed",
        label: "✅ Completed",
        tasks: completedTasks,
        icon: CheckCircle2,
        showDate: false,
      });
    }

    return groups;
  }, [tasks]);

  const handleTogglePin = (id: string, pinned: boolean) => {
    updateTask.mutate({ id, is_pinned: pinned } as any);
  };

  const totalPending = tasks.filter(t => t.status !== "completed").length;

  return (
    <Card className="h-full">
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
      <CardContent className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : dateGroups.length === 0 || (dateGroups.length === 1 && dateGroups[0].tasks.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs">Add a task to get started</p>
          </div>
        ) : (
          dateGroups.map((group) => (
            <DateGroupSection
              key={group.key}
              group={group}
              onComplete={(id) => completeTask.mutate(id)}
              onTogglePin={handleTogglePin}
              defaultOpen={group.key !== "completed" && group.key !== "later"}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
