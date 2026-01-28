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
  Plus,
  AlertCircle,
  FileText,
  Lightbulb,
  Eye,
  EyeOff,
  X,
  CheckCircle,
  UserPlus
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserTasks, UserTask } from "@/hooks/useUserTasks";
import { useOverdueOnboardingTasks, OverdueOnboardingTask } from "@/hooks/useOverdueOnboardingTasks";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { CallDialog } from "@/components/communications/CallDialog";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";
import { format, isToday, isTomorrow, isThisWeek, parseISO, isPast, differenceInDays } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
const sourceConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
  meeting: { color: "text-purple-700", bgColor: "bg-purple-100", icon: MessageSquare, label: "Meeting" },
  ninja: { color: "text-amber-700", bgColor: "bg-amber-100", icon: Sparkles, label: "AI" },
  onboarding: { color: "text-blue-700", bgColor: "bg-blue-100", icon: Building2, label: "Onboarding" },
  manual: { color: "text-gray-700", bgColor: "bg-gray-100", icon: User, label: "Manual" },
  ai: { color: "text-green-700", bgColor: "bg-green-100", icon: Zap, label: "AI" },
  email: { color: "text-rose-700", bgColor: "bg-rose-100", icon: Mail, label: "Email" },
  call: { color: "text-indigo-700", bgColor: "bg-indigo-100", icon: Phone, label: "Call" },
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
  propertyAddress?: string;
  ownerName?: string;
  link?: string;
  actionType?: "call" | "email" | "sms" | "view";
  rawTask?: UserTask | OverdueOnboardingTask | NinjaFocusItem;
  taskType: "user" | "ninja" | "onboarding";
  isOverdue?: boolean;
  daysOverdue?: number;
  projectId?: string;
  assignmentComment?: string;
}

// Critical task row with larger, more prominent styling
function CriticalTaskRow({ 
  task, 
  onComplete, 
  onAction 
}: { 
  task: UnifiedTask;
  onComplete?: () => void;
  onAction: (task: UnifiedTask) => void;
}) {
  const sourceInfo = sourceConfig[task.source] || sourceConfig.manual;
  const SourceIcon = sourceInfo.icon;

  return (
    <div 
      className="group flex items-center gap-3 p-4 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-all cursor-pointer"
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
      <div className="w-3 h-3 rounded-full flex-shrink-0 bg-red-500 animate-pulse" />

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-red-900">{task.title}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {task.daysOverdue && task.daysOverdue > 0 && (
            <span className="text-xs font-medium text-red-600">
              {task.daysOverdue} day{task.daysOverdue !== 1 ? 's' : ''} overdue
            </span>
          )}
          {task.contactName && (
            <span className="text-xs text-red-700">{task.contactName}</span>
          )}
          {task.propertyName && (
            <span className="text-xs text-red-700">• {task.propertyName}</span>
          )}
        </div>
      </div>

      {/* Source badge - larger */}
      <Badge className={cn("text-xs gap-1.5 px-3 py-1", sourceInfo.bgColor, sourceInfo.color)}>
        <SourceIcon className="w-4 h-4" />
        {task.sourceLabel}
      </Badge>

      {/* Action button */}
      {task.actionType === "call" && (
        <Button size="sm" variant="destructive" className="gap-1">
          <Phone className="w-4 h-4" />
          Call
        </Button>
      )}
      {task.actionType === "email" && (
        <Button size="sm" variant="destructive" className="gap-1">
          <Mail className="w-4 h-4" />
          Email
        </Button>
      )}
    </div>
  );
}

// Standard task row
function TaskRow({ 
  task, 
  onComplete, 
  onAction,
}: { 
  task: UnifiedTask;
  onComplete?: () => void;
  onAction: (task: UnifiedTask) => void;
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
        {(task.contactName || task.propertyAddress || task.propertyName || task.dueDate || task.ownerName) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
            {task.propertyAddress && <span className="font-medium">{task.propertyAddress}</span>}
            {task.propertyAddress && task.ownerName && <span>•</span>}
            {task.ownerName && <span>{task.ownerName}</span>}
            {!task.propertyAddress && task.contactName && <span>{task.contactName}</span>}
            {!task.propertyAddress && task.propertyName && <span>• {task.propertyName}</span>}
            {task.dueDate && !isToday(task.dueDate) && (
              <span className="ml-2">• {format(task.dueDate, "EEE, MMM d")}</span>
            )}
          </p>
        )}
      </div>

      {/* Source badge */}
      <Badge variant="secondary" className={cn("text-xs flex-shrink-0 gap-1", sourceInfo.bgColor, sourceInfo.color)}>
        <SourceIcon className="w-3 h-3" />
        {task.sourceLabel}
      </Badge>

      {/* Action indicators */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {task.actionType === "call" && <Phone className="w-4 h-4 text-primary" />}
        {task.actionType === "email" && <Mail className="w-4 h-4 text-primary" />}
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

// AI Suggestion row - visually distinct
function AISuggestionRow({ 
  task, 
  onAction 
}: { 
  task: UnifiedTask;
  onAction: (task: UnifiedTask) => void;
}) {
  return (
    <div 
      className="group flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 transition-all cursor-pointer"
      onClick={() => onAction(task)}
    >
      <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-amber-900">{task.title}</p>
        {task.description && (
          <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{task.description}</p>
        )}
        {task.contactName && (
          <p className="text-xs text-amber-600 mt-0.5">{task.contactName}</p>
        )}
      </div>

      {/* Action button */}
      {task.actionType === "call" && task.contactPhone && (
        <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-100">
          <Phone className="w-3 h-3" />
          Call
        </Button>
      )}
      {task.actionType === "email" && task.contactEmail && (
        <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-100">
          <Mail className="w-3 h-3" />
          Email
        </Button>
      )}
      {!task.actionType && (
        <ExternalLink className="w-4 h-4 text-amber-600 opacity-0 group-hover:opacity-100" />
      )}
    </div>
  );
}

// Section header component
function SectionHeader({ 
  title, 
  count, 
  icon: Icon, 
  isOpen, 
  onToggle,
  variant = "default"
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  variant?: "default" | "critical" | "ai";
}) {
  const variantStyles = {
    default: "text-foreground",
    critical: "text-red-700",
    ai: "text-amber-700",
  };

  return (
    <button 
      onClick={onToggle}
      className="flex items-center gap-2 w-full py-2 px-2 hover:bg-muted/30 rounded-lg transition-colors"
    >
      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      <Icon className={cn("w-4 h-4", variantStyles[variant])} />
      <span className={cn("font-semibold text-sm", variantStyles[variant])}>{title}</span>
      <Badge variant={variant === "critical" ? "destructive" : "secondary"} className="ml-auto">
        {count}
      </Badge>
    </button>
  );
}

export function MondayStyleTasksPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(true);
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
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [assignmentComment, setAssignmentComment] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  // Section open states
  const [criticalOpen, setCriticalOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);
  const [thisWeekOpen, setThisWeekOpen] = useState(true);
  const [laterOpen, setLaterOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);

  // Fetch all data sources
  const { tasks: userTasks, isLoading: tasksLoading, completeTask, assignTask } = useUserTasks();
  const { data: overdueData, isLoading: overdueLoading } = useOverdueOnboardingTasks();
  
  // Fetch team members for assignment
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, email, job_title")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });
  
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

  // Separate user tasks from AI suggestions
  const { yourTasks, aiSuggestions } = useMemo(() => {
    const yourTasks: UnifiedTask[] = [];
    const aiSuggestions: UnifiedTask[] = [];
    const today = new Date();

    // Add user tasks (including transcript tasks with source_type: meeting)
    userTasks
      .filter(t => t.status !== "completed")
      .forEach(task => {
        const dueDate = task.due_date ? parseISO(task.due_date) : undefined;
        const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
        const daysOverdue = dueDate && isOverdue ? differenceInDays(today, dueDate) : 0;
        
        // Auto-escalate overdue tasks to critical
        let priority = task.priority;
        if (isOverdue && daysOverdue >= 1 && priority !== "urgent") {
          priority = "urgent";
        }

        yourTasks.push({
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          priority,
          dueDate,
          source: task.source_type || "manual",
          sourceLabel: sourceConfig[task.source_type || "manual"]?.label || "Task",
          isPinned: task.is_pinned,
          estimatedMinutes: task.estimated_minutes || undefined,
          propertyId: task.property_id || undefined,
          propertyAddress: task.property_address || undefined,
          ownerName: task.owner_name || undefined,
          taskType: "user",
          rawTask: task,
          isOverdue,
          daysOverdue,
          assignmentComment: task.assignment_comment || undefined,
        });
      });

    // Add urgent onboarding tasks to YOUR TASKS (not AI)
    overdueData?.quickWins?.slice(0, 5).forEach(task => {
      const dueDate = task.due_date ? parseISO(task.due_date) : undefined;
      const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate);
      const daysOverdue = dueDate && isOverdue ? differenceInDays(today, dueDate) : 0;

      yourTasks.push({
        id: task.id,
        title: task.title,
        description: undefined,
        priority: isOverdue ? "urgent" : "high",
        dueDate,
        source: "onboarding",
        sourceLabel: "Onboarding",
        estimatedMinutes: task.estimated_minutes,
        propertyId: task.property_id,
        propertyName: task.property_name,
        propertyAddress: task.property_name, // property_name already contains address from hook
        ownerName: task.owner_name,
        projectId: task.project_id,
        taskType: "onboarding",
        rawTask: task,
        isOverdue,
        daysOverdue,
      });
    });

    // Add ninja priorities as AI SUGGESTIONS (separate section)
    ninjaPlan?.topPriorities?.forEach((item, idx) => {
      aiSuggestions.push({
        id: `ninja-priority-${idx}`,
        title: item.action,
        description: item.reason,
        priority: item.priority === "critical" ? "urgent" : item.priority,
        dueDate: today,
        source: "ninja",
        sourceLabel: "AI",
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

    // Add quick wins as AI suggestions
    ninjaPlan?.quickWins?.forEach((item, idx) => {
      aiSuggestions.push({
        id: `ninja-quickwin-${idx}`,
        title: item.action,
        description: item.reason,
        priority: "medium",
        dueDate: today,
        source: "ninja",
        sourceLabel: "AI",
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

    return { yourTasks, aiSuggestions };
  }, [userTasks, ninjaPlan, overdueData]);

  // Filter tasks by search query
  const filteredYourTasks = useMemo(() => {
    if (!searchQuery.trim()) return yourTasks;
    const query = searchQuery.toLowerCase();
    return yourTasks.filter(task => 
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.contactName?.toLowerCase().includes(query) ||
      task.propertyName?.toLowerCase().includes(query)
    );
  }, [yourTasks, searchQuery]);

  const filteredAISuggestions = useMemo(() => {
    if (!searchQuery.trim()) return aiSuggestions;
    const query = searchQuery.toLowerCase();
    return aiSuggestions.filter(task => 
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.contactName?.toLowerCase().includes(query)
    );
  }, [aiSuggestions, searchQuery]);

  // Group YOUR TASKS by importance and time
  const groupedTasks = useMemo(() => {
    const critical: UnifiedTask[] = [];
    const todayTasks: UnifiedTask[] = [];
    const thisWeekTasks: UnifiedTask[] = [];
    const laterTasks: UnifiedTask[] = [];

    filteredYourTasks.forEach(task => {
      // Critical: overdue or urgent priority
      if (task.isOverdue || task.priority === "urgent" || task.priority === "critical") {
        critical.push(task);
        return;
      }

      // Pinned tasks go to today
      if (task.isPinned) {
        todayTasks.push(task);
        return;
      }

      if (!task.dueDate) {
        laterTasks.push(task);
        return;
      }

      if (isToday(task.dueDate) || isTomorrow(task.dueDate)) {
        todayTasks.push(task);
      } else if (isThisWeek(task.dueDate)) {
        thisWeekTasks.push(task);
      } else {
        laterTasks.push(task);
      }
    });

    // Sort each group by creation date (newest first), then priority for ties
    const sortByRecency = (a: UnifiedTask, b: UnifiedTask) => {
      // Get raw task created_at for proper sorting
      const aCreatedAt = (a.rawTask as any)?.created_at ? new Date((a.rawTask as any).created_at).getTime() : 0;
      const bCreatedAt = (b.rawTask as any)?.created_at ? new Date((b.rawTask as any).created_at).getTime() : 0;
      
      // Newest first
      if (bCreatedAt !== aCreatedAt) {
        return bCreatedAt - aCreatedAt;
      }
      
      // For ties, sort by priority
      const priorityOrder = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    };

    return {
      critical: critical.sort(sortByRecency),
      today: todayTasks.sort(sortByRecency),
      thisWeek: thisWeekTasks.sort(sortByRecency),
      later: laterTasks.sort(sortByRecency),
    };
  }, [filteredYourTasks]);

  const handleTaskAction = (task: UnifiedTask) => {
    // DIRECT NAVIGATION: Navigate directly to the right location instead of modal
    
    // If it's an onboarding task, go to the Properties page with openWorkflow param
    if (task.taskType === "onboarding" && task.projectId) {
      navigate(`/properties?openWorkflow=${task.projectId}&taskId=${task.id}`);
      return;
    }
    
    // If task has a specific link, navigate there
    if (task.link) {
      navigate(task.link);
      return;
    }
    
    // If task has a property, go to property details with onboarding context
    if (task.propertyId) {
      // Check if this might be an onboarding-related task based on title/source
      const isOnboardingRelated = task.source === "onboarding" || 
        task.title.toLowerCase().includes("wifi") ||
        task.title.toLowerCase().includes("setup") ||
        task.title.toLowerCase().includes("onboarding") ||
        task.title.toLowerCase().includes("lawncare") ||
        task.title.toLowerCase().includes("owner onboarding");
      
      if (isOnboardingRelated && task.projectId) {
        navigate(`/properties?openWorkflow=${task.projectId}&taskId=${task.id}`);
      } else {
        navigate(`/properties?property=${task.propertyId}&tab=details`);
      }
      return;
    }
    
    // If task has contact info, go to communications
    if (task.contactPhone || task.contactEmail) {
      const params = new URLSearchParams();
      if (task.contactPhone) params.set("phone", task.contactPhone);
      if (task.contactId) params.set(task.contactType === "owner" ? "ownerId" : "leadId", task.contactId);
      if (task.contactName) params.set("name", task.contactName);
      navigate(`/communications?${params.toString()}`);
      return;
    }
    
    // Fallback: show modal for context
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const executeTaskAction = (task: UnifiedTask, action: "call" | "email" | "navigate") => {
    setShowTaskModal(false);
    
    if (action === "call" && task.contactPhone) {
      setSelectedContact({
        name: task.contactName || "Unknown",
        phone: task.contactPhone,
        email: task.contactEmail,
        leadId: task.contactType === "lead" ? task.contactId : undefined,
        ownerId: task.contactType === "owner" ? task.contactId : undefined,
        contactType: task.contactType as "lead" | "owner" | "vendor",
      });
      setShowCallDialog(true);
    } else if (action === "email" && task.contactEmail) {
      setSelectedContact({
        name: task.contactName || "Unknown",
        email: task.contactEmail,
        phone: task.contactPhone,
        leadId: task.contactType === "lead" ? task.contactId : undefined,
        ownerId: task.contactType === "owner" ? task.contactId : undefined,
        contactType: task.contactType as "lead" | "owner" | "vendor",
      });
      setShowEmailDialog(true);
    } else if (action === "navigate") {
      // Use same logic as handleTaskAction
      handleTaskAction(task);
    }
  };

  const handleCompleteTask = (task: UnifiedTask) => {
    if (task.taskType === "user") {
      completeTask.mutate(task.id);
    }
  };

  const isLoading = tasksLoading || ninjaLoading || overdueLoading;
  const totalYourTasks = filteredYourTasks.length;
  const totalAISuggestions = filteredAISuggestions.length;

  return (
    <>
      <Card className="col-span-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Your Tasks
              {totalYourTasks > 0 && (
                <Badge variant="secondary">{totalYourTasks}</Badge>
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
                size="sm"
                onClick={() => setShowAISuggestions(!showAISuggestions)}
                className="gap-1 text-xs"
              >
                {showAISuggestions ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showAISuggestions ? "Hide AI" : "Show AI"}
              </Button>
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
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalYourTasks === 0 && totalAISuggestions === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">All caught up!</p>
              <p className="text-xs">No tasks to show</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {/* ===== YOUR TASKS SECTION ===== */}
              
              {/* TODAY + AI SUGGESTIONS - Show first as requested */}
              {(groupedTasks.today.length > 0 || (showAISuggestions && filteredAISuggestions.length > 0)) && (
                <div className="space-y-2">
                  <SectionHeader
                    title={`TODAY - ${format(new Date(), "MMM d")}`}
                    count={groupedTasks.today.length + (showAISuggestions ? filteredAISuggestions.length : 0)}
                    icon={Zap}
                    isOpen={todayOpen}
                    onToggle={() => setTodayOpen(!todayOpen)}
                  />
                  {todayOpen && (
                    <div className="space-y-1 pl-2">
                      {/* Regular today tasks */}
                      {groupedTasks.today.map((task) => (
                        <TaskRow 
                          key={task.id} 
                          task={task}
                          onComplete={task.taskType === "user" ? () => handleCompleteTask(task) : undefined}
                          onAction={handleTaskAction}
                        />
                      ))}
                      {/* AI Suggestions merged into today */}
                      {showAISuggestions && filteredAISuggestions.map((task) => (
                        <AISuggestionRow 
                          key={task.id} 
                          task={task}
                          onAction={handleTaskAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* THIS WEEK */}
              {groupedTasks.thisWeek.length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    title="THIS WEEK"
                    count={groupedTasks.thisWeek.length}
                    icon={Calendar}
                    isOpen={thisWeekOpen}
                    onToggle={() => setThisWeekOpen(!thisWeekOpen)}
                  />
                  {thisWeekOpen && (
                    <div className="space-y-1 pl-2">
                      {groupedTasks.thisWeek.map((task) => (
                        <TaskRow 
                          key={task.id} 
                          task={task}
                          onComplete={task.taskType === "user" ? () => handleCompleteTask(task) : undefined}
                          onAction={handleTaskAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LATER */}
              {groupedTasks.later.length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    title="LATER"
                    count={groupedTasks.later.length}
                    icon={Clock}
                    isOpen={laterOpen}
                    onToggle={() => setLaterOpen(!laterOpen)}
                  />
                  {laterOpen && (
                    <div className="space-y-1 pl-2">
                      {groupedTasks.later.map((task) => (
                        <TaskRow 
                          key={task.id} 
                          task={task}
                          onComplete={task.taskType === "user" ? () => handleCompleteTask(task) : undefined}
                          onAction={handleTaskAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CRITICAL - Moved to bottom as requested */}
              {groupedTasks.critical.length > 0 && (
                <div className="space-y-2">
                  <SectionHeader
                    title="CRITICAL - Needs Attention"
                    count={groupedTasks.critical.length}
                    icon={AlertCircle}
                    isOpen={criticalOpen}
                    onToggle={() => setCriticalOpen(!criticalOpen)}
                    variant="critical"
                  />
                  {criticalOpen && (
                    <div className="space-y-2 pl-2">
                      {groupedTasks.critical.map((task) => (
                        <CriticalTaskRow 
                          key={task.id} 
                          task={task}
                          onComplete={task.taskType === "user" ? () => handleCompleteTask(task) : undefined}
                          onAction={handleTaskAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
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

      {/* Task Execution Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {selectedTask?.title}
            </DialogTitle>
            {selectedTask?.description && (
              <DialogDescription className="mt-2">
                {selectedTask.description}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {/* Task Details */}
              <div className="flex flex-wrap gap-2">
                {selectedTask.source && (
                  <Badge variant="secondary" className="capitalize">
                    {sourceConfig[selectedTask.source]?.label || selectedTask.source}
                  </Badge>
                )}
                {selectedTask.priority && (
                  <Badge 
                    variant={selectedTask.priority === "urgent" || selectedTask.priority === "critical" ? "destructive" : "outline"}
                    className="capitalize"
                  >
                    {selectedTask.priority}
                  </Badge>
                )}
                {selectedTask.dueDate && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(selectedTask.dueDate, "MMM d, yyyy")}
                  </Badge>
                )}
              </div>

              {/* Contact Info */}
              {(selectedTask.contactName || selectedTask.propertyName) && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                  {selectedTask.contactName && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedTask.contactName}</span>
                    </div>
                  )}
                  {selectedTask.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedTask.contactPhone}</span>
                    </div>
                  )}
                  {selectedTask.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedTask.contactEmail}</span>
                    </div>
                  )}
                  {selectedTask.propertyName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedTask.propertyName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedTask.contactPhone && (
                  <Button 
                    onClick={() => executeTaskAction(selectedTask, "call")}
                    className="gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </Button>
                )}
                {selectedTask.contactEmail && (
                  <Button 
                    variant="secondary"
                    onClick={() => executeTaskAction(selectedTask, "email")}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </Button>
                )}
                {(selectedTask.link || selectedTask.propertyId) && (
                  <Button 
                    variant="outline"
                    onClick={() => executeTaskAction(selectedTask, "navigate")}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </Button>
                )}
                {selectedTask.taskType === "user" && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      completeTask.mutate(selectedTask.id);
                      setShowTaskModal(false);
                    }}
                    className="gap-2 ml-auto text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </Button>
                )}
              </div>

              {/* Assign to Team Member with Comment */}
              {selectedTask.taskType === "user" && teamMembers.length > 0 && (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-3">
                    <UserPlus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Assign to:</span>
                    <Select
                      value={selectedAssignee || ""}
                      onValueChange={(userId) => setSelectedAssignee(userId)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.first_name || member.email}
                            {member.job_title && (
                              <span className="text-muted-foreground ml-1">
                                ({member.job_title})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedAssignee && (
                    <>
                      <Input
                        placeholder="Add a comment for the assignee (optional)..."
                        value={assignmentComment}
                        onChange={(e) => setAssignmentComment(e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        onClick={() => {
                          if (selectedAssignee && selectedTask.id) {
                            assignTask.mutate({ 
                              taskId: selectedTask.id, 
                              assignToUserId: selectedAssignee,
                              comment: assignmentComment || undefined
                            });
                            setShowTaskModal(false);
                            setSelectedAssignee(null);
                            setAssignmentComment("");
                          }
                        }}
                        className="w-full"
                      >
                        Assign Task
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
