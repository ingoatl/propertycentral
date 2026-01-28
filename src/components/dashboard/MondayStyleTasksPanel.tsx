import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle2, 
  Sparkles,
  RefreshCw,
  Loader2,
  Phone,
  Mail,
  ExternalLink,
  Zap,
  Calendar,
  Clock,
  MessageSquare,
  Building2,
  User,
  Search,
  ChevronDown,
  ChevronRight,
  Pin,
  Plus
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTasks, UserTask } from "@/hooks/useUserTasks";
import { useOverdueOnboardingTasks, OverdueOnboardingTask } from "@/hooks/useOverdueOnboardingTasks";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CallDialog } from "@/components/communications/CallDialog";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";
import { format, isToday, isTomorrow, isThisWeek, parseISO, addDays } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface NinjaFocusItem {
  priority: "critical" | "high" | "medium";
  action: string;
  reason: string;
  source: string;
  link?: string;
  actionType?: "call" | "email" | "sms" | "view";
  contactId?: string;
  contactType?: "lead" | "owner" | "vendor" | "guest";
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface NinjaPlan {
  greeting: string;
  topPriorities: NinjaFocusItem[];
  quickWins: NinjaFocusItem[];
  proactiveSuggestions: string[];
}

// Source badge colors and icons
const sourceConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  meeting: { color: "bg-purple-100 text-purple-700", icon: MessageSquare, label: "Meeting" },
  ninja: { color: "bg-amber-100 text-amber-700", icon: Sparkles, label: "AI Priority" },
  onboarding: { color: "bg-blue-100 text-blue-700", icon: Building2, label: "Onboarding" },
  manual: { color: "bg-gray-100 text-gray-700", icon: User, label: "Manual" },
  ai: { color: "bg-green-100 text-green-700", icon: Zap, label: "AI" },
};

// Unified task item for display
interface UnifiedTask {
  id: string;
  title: string;
  description?: string;
  priority: "urgent" | "critical" | "high" | "medium" | "low";
  dueDate?: Date;
  source: string;
  sourceLabel: string;
  isPinned?: boolean;
  estimatedMinutes?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactType?: string;
  contactId?: string;
  propertyId?: string;
  propertyName?: string;
  link?: string;
  actionType?: "call" | "email" | "sms" | "view";
  rawTask?: UserTask | OverdueOnboardingTask | NinjaFocusItem;
  taskType: "user" | "ninja" | "onboarding";
}

function TaskRow({ 
  task, 
  onComplete, 
  onAction,
  onPin 
}: { 
  task: UnifiedTask;
  onComplete?: () => void;
  onAction: (task: UnifiedTask) => void;
  onPin?: () => void;
}) {
  const sourceInfo = sourceConfig[task.source] || sourceConfig.manual;
  const SourceIcon = sourceInfo.icon;

  const priorityColors = {
    urgent: "bg-red-500",
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-gray-400",
  };

  return (
    <div 
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-all cursor-pointer",
        task.isPinned && "border-primary/30 bg-primary/5"
      )}
      onClick={() => onAction(task)}
    >
      {/* Checkbox for user tasks */}
      {task.taskType === "user" && onComplete && (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            className="h-5 w-5" 
            onCheckedChange={onComplete}
          />
        </div>
      )}

      {/* Priority indicator */}
      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityColors[task.priority])} />

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{task.title}</p>
          {task.isPinned && <Pin className="w-3 h-3 text-primary" />}
        </div>
        {(task.description || task.contactName || task.propertyName) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.contactName && <span>{task.contactName}</span>}
            {task.propertyName && <span> • {task.propertyName}</span>}
            {!task.contactName && !task.propertyName && task.description}
          </p>
        )}
      </div>

      {/* Source badge */}
      <Badge variant="secondary" className={cn("text-xs flex-shrink-0 gap-1", sourceInfo.color)}>
        <SourceIcon className="w-3 h-3" />
        {task.sourceLabel}
      </Badge>

      {/* Action indicators */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {task.actionType === "call" && <Phone className="w-4 h-4 text-muted-foreground" />}
        {task.actionType === "email" && <Mail className="w-4 h-4 text-muted-foreground" />}
        <ExternalLink className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Estimated time */}
      {task.estimatedMinutes && (
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {task.estimatedMinutes}m
        </Badge>
      )}
    </div>
  );
}

function TaskGroup({ 
  title, 
  tasks, 
  icon: Icon,
  defaultOpen = true,
  onComplete,
  onAction,
  onPin
}: {
  title: string;
  tasks: UnifiedTask[];
  icon: React.ElementType;
  defaultOpen?: boolean;
  onComplete: (task: UnifiedTask) => void;
  onAction: (task: UnifiedTask) => void;
  onPin?: (task: UnifiedTask) => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/30 rounded-lg px-2 transition-colors">
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="secondary" className="ml-auto">{tasks.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {tasks.map((task) => (
          <TaskRow 
            key={task.id} 
            task={task}
            onComplete={task.taskType === "user" ? () => onComplete(task) : undefined}
            onAction={onAction}
            onPin={onPin ? () => onPin(task) : undefined}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MondayStyleTasksPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{
    name: string;
    phone?: string;
    email?: string;
    leadId?: string;
    ownerId?: string;
    contactType?: "lead" | "owner" | "vendor";
  } | null>(null);

  // Fetch all data sources
  const { tasks: userTasks, isLoading: tasksLoading, completeTask } = useUserTasks();
  const { data: overdueData, isLoading: overdueLoading } = useOverdueOnboardingTasks();
  
  const { data: ninjaPlan, isLoading: ninjaLoading, refetch: refetchNinja, isFetching } = useQuery({
    queryKey: ["ninja-plan"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-ninja-plan");
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to generate plan");
      return data.plan as NinjaPlan;
    },
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // Combine all tasks into unified format
  const unifiedTasks = useMemo(() => {
    const tasks: UnifiedTask[] = [];
    const today = new Date();

    // Add user tasks (including transcript tasks with source_type: meeting)
    userTasks
      .filter(t => t.status !== "completed")
      .forEach(task => {
        tasks.push({
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          priority: task.priority,
          dueDate: task.due_date ? parseISO(task.due_date) : undefined,
          source: task.source_type || "manual",
          sourceLabel: sourceConfig[task.source_type || "manual"]?.label || "Task",
          isPinned: task.is_pinned,
          estimatedMinutes: task.estimated_minutes || undefined,
          propertyId: task.property_id || undefined,
          taskType: "user",
          rawTask: task,
        });
      });

    // Add ninja priorities
    ninjaPlan?.topPriorities?.forEach((item, idx) => {
      tasks.push({
        id: `ninja-priority-${idx}`,
        title: item.action,
        description: item.reason,
        priority: item.priority === "critical" ? "urgent" : item.priority,
        dueDate: today, // AI priorities are for today
        source: "ninja",
        sourceLabel: "AI Priority",
        contactName: item.contactName,
        contactPhone: item.contactPhone,
        contactEmail: item.contactEmail,
        contactType: item.contactType,
        contactId: item.contactId,
        link: item.link,
        actionType: item.actionType,
        taskType: "ninja",
        rawTask: item,
      });
    });

    // Add quick onboarding tasks
    overdueData?.quickWins?.slice(0, 5).forEach(task => {
      tasks.push({
        id: task.id,
        title: task.title,
        description: undefined,
        priority: "high",
        dueDate: task.due_date ? parseISO(task.due_date) : undefined,
        source: "onboarding",
        sourceLabel: "Onboarding",
        estimatedMinutes: task.estimated_minutes,
        propertyId: task.property_id,
        propertyName: task.property_name,
        taskType: "onboarding",
        rawTask: task,
      });
    });

    return tasks;
  }, [userTasks, ninjaPlan, overdueData]);

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return unifiedTasks;
    const query = searchQuery.toLowerCase();
    return unifiedTasks.filter(task => 
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.contactName?.toLowerCase().includes(query) ||
      task.propertyName?.toLowerCase().includes(query)
    );
  }, [unifiedTasks, searchQuery]);

  // Group tasks by time period (Monday.com style)
  const groupedTasks = useMemo(() => {
    const pinnedTasks: UnifiedTask[] = [];
    const todayTasks: UnifiedTask[] = [];
    const tomorrowTasks: UnifiedTask[] = [];
    const thisWeekTasks: UnifiedTask[] = [];
    const laterTasks: UnifiedTask[] = [];
    const noDueDateTasks: UnifiedTask[] = [];

    filteredTasks.forEach(task => {
      if (task.isPinned) {
        pinnedTasks.push(task);
        return;
      }

      if (!task.dueDate) {
        noDueDateTasks.push(task);
        return;
      }

      if (isToday(task.dueDate)) {
        todayTasks.push(task);
      } else if (isTomorrow(task.dueDate)) {
        tomorrowTasks.push(task);
      } else if (isThisWeek(task.dueDate)) {
        thisWeekTasks.push(task);
      } else {
        laterTasks.push(task);
      }
    });

    // Sort each group by priority
    const sortByPriority = (a: UnifiedTask, b: UnifiedTask) => {
      const priorityOrder = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    };

    return {
      pinned: pinnedTasks.sort(sortByPriority),
      today: todayTasks.sort(sortByPriority),
      tomorrow: tomorrowTasks.sort(sortByPriority),
      thisWeek: thisWeekTasks.sort(sortByPriority),
      later: laterTasks.sort(sortByPriority),
      noDueDate: noDueDateTasks.sort(sortByPriority),
    };
  }, [filteredTasks]);

  const handleTaskAction = (task: UnifiedTask) => {
    if (task.actionType === "call" && task.contactPhone) {
      setSelectedContact({
        name: task.contactName || "Unknown",
        phone: task.contactPhone,
        email: task.contactEmail,
        leadId: task.contactType === "lead" ? task.contactId : undefined,
        ownerId: task.contactType === "owner" ? task.contactId : undefined,
        contactType: task.contactType as "lead" | "owner" | "vendor",
      });
      setShowCallDialog(true);
    } else if (task.actionType === "email" && task.contactEmail) {
      setSelectedContact({
        name: task.contactName || "Unknown",
        email: task.contactEmail,
        phone: task.contactPhone,
        leadId: task.contactType === "lead" ? task.contactId : undefined,
        ownerId: task.contactType === "owner" ? task.contactId : undefined,
        contactType: task.contactType as "lead" | "owner" | "vendor",
      });
      setShowEmailDialog(true);
    } else if (task.link) {
      navigate(task.link);
    } else if (task.propertyId) {
      navigate(`/properties?property=${task.propertyId}&task=${task.id}`);
    } else {
      navigate("/communications");
    }
  };

  const handleCompleteTask = (task: UnifiedTask) => {
    if (task.taskType === "user") {
      completeTask.mutate(task.id);
    }
  };

  const isLoading = tasksLoading || ninjaLoading || overdueLoading;
  const totalTasks = filteredTasks.length;

  return (
    <>
      <Card className="col-span-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              My Tasks
              {totalTasks > 0 && (
                <Badge variant="secondary">{totalTasks}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-48"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetchNinja()}
                disabled={isFetching}
              >
                <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>
          {ninjaPlan?.greeting && (
            <p className="text-sm text-muted-foreground">{ninjaPlan.greeting}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalTasks === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">All caught up!</p>
              <p className="text-xs">No tasks to show</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <TaskGroup
                title="Pinned"
                tasks={groupedTasks.pinned}
                icon={Pin}
                onComplete={handleCompleteTask}
                onAction={handleTaskAction}
              />
              <TaskGroup
                title="Today"
                tasks={groupedTasks.today}
                icon={Zap}
                onComplete={handleCompleteTask}
                onAction={handleTaskAction}
              />
              <TaskGroup
                title="Tomorrow"
                tasks={groupedTasks.tomorrow}
                icon={Calendar}
                onComplete={handleCompleteTask}
                onAction={handleTaskAction}
              />
              <TaskGroup
                title="This Week"
                tasks={groupedTasks.thisWeek}
                icon={Clock}
                defaultOpen={false}
                onComplete={handleCompleteTask}
                onAction={handleTaskAction}
              />
              <TaskGroup
                title="Later"
                tasks={groupedTasks.later}
                icon={Calendar}
                defaultOpen={false}
                onComplete={handleCompleteTask}
                onAction={handleTaskAction}
              />
              <TaskGroup
                title="No Due Date"
                tasks={groupedTasks.noDueDate}
                icon={Clock}
                defaultOpen={false}
                onComplete={handleCompleteTask}
                onAction={handleTaskAction}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Dialog */}
      {selectedContact && showCallDialog && (
        <CallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          contactName={selectedContact.name}
          contactPhone={selectedContact.phone || ""}
          leadId={selectedContact.leadId}
          ownerId={selectedContact.ownerId}
          contactType={selectedContact.contactType}
        />
      )}

      {/* Email Dialog */}
      {selectedContact && showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contactEmail={selectedContact.email || ""}
          contactName={selectedContact.name}
          contactId={selectedContact.leadId || selectedContact.ownerId || ""}
          contactType={selectedContact.contactType === "vendor" ? "lead" : selectedContact.contactType || "lead"}
        />
      )}
    </>
  );
}
