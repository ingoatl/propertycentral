import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Calendar,
  Wrench,
  CheckCircle2,
  Clock,
  User,
  DollarSign,
  Loader2,
  CalendarDays,
  Shield,
} from "lucide-react";

interface OwnerScheduledMaintenanceTabProps {
  ownerId: string;
  propertyId?: string;
}

interface ScheduledTask {
  id: string;
  scheduled_date: string;
  status: string;
  auto_assigned: boolean;
  assignment_reason: string | null;
  completed_at: string | null;
  created_at: string;
  schedule: {
    id: string;
    next_due_at: string | null;
    is_enabled: boolean;
    custom_frequency_months: number | null;
    preferred_vendor_id: string | null;
  } | null;
  template: {
    id: string;
    name: string;
    category: string;
    frequency_months: number;
    estimated_cost_low: number | null;
    estimated_cost_high: number | null;
    description: string | null;
  } | null;
  vendor: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  property: {
    id: string;
    name: string;
    address: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800", icon: CalendarDays },
  dispatched: { label: "Dispatched", color: "bg-purple-100 text-purple-800", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-orange-100 text-orange-800", icon: Wrench },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: Clock },
};

const CATEGORY_ICONS: Record<string, string> = {
  hvac: "❄️",
  plumbing: "🔧",
  electrical: "⚡",
  appliances: "🔌",
  general: "🛠️",
  exterior: "🌳",
  cleaning: "🧹",
  pest_control: "🐛",
  safety: "🔒",
  pool_spa: "🏊",
};

export function OwnerScheduledMaintenanceTab({ ownerId, propertyId }: OwnerScheduledMaintenanceTabProps) {
  // Fetch scheduled maintenance tasks
  const { data: scheduledTasks = [], isLoading } = useQuery({
    queryKey: ["owner-scheduled-maintenance", ownerId, propertyId],
    queryFn: async () => {
      // First get properties owned by this owner
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerId);

      if (!properties?.length) return [];

      const propertyIds = propertyId ? [propertyId] : properties.map(p => p.id);

      const { data, error } = await supabase
        .from("scheduled_maintenance_tasks")
        .select(`
          id,
          scheduled_date,
          status,
          auto_assigned,
          assignment_reason,
          completed_at,
          created_at,
          schedule:property_maintenance_schedules(id, next_due_at, is_enabled, custom_frequency_months, preferred_vendor_id),
          template:preventive_maintenance_templates(id, name, category, frequency_months, estimated_cost_low, estimated_cost_high, description),
          vendor:vendors(id, name, phone),
          property:properties(id, name, address)
        `)
        .in("property_id", propertyIds)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return data as ScheduledTask[];
    },
  });

  // Group tasks by status
  const upcomingTasks = scheduledTasks.filter(t => 
    t.status === "scheduled" || t.status === "dispatched"
  );
  const inProgressTasks = scheduledTasks.filter(t => t.status === "in_progress");
  const completedTasks = scheduledTasks.filter(t => t.status === "completed");

  // Calculate stats
  const totalEstimatedCost = scheduledTasks.reduce((sum, task) => {
    const low = task.template?.estimated_cost_low || 0;
    const high = task.template?.estimated_cost_high || 0;
    return sum + ((low + high) / 2);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scheduledTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Scheduled Maintenance</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your property doesn't have any preventive maintenance scheduled yet. 
            PeachHaus will schedule routine maintenance to protect your investment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderTaskCard = (task: ScheduledTask) => {
    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.scheduled;
    const StatusIcon = statusConfig.icon;
    const categoryIcon = CATEGORY_ICONS[task.template?.category || "general"] || "🔧";
    const costRange = task.template?.estimated_cost_low && task.template?.estimated_cost_high
      ? `$${task.template.estimated_cost_low} - $${task.template.estimated_cost_high}`
      : null;

    return (
      <Card key={task.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
              {categoryIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={statusConfig.color} variant="secondary">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {task.auto_assigned && (
                  <Badge variant="outline" className="text-xs">
                    Auto-assigned
                  </Badge>
                )}
              </div>
              <h4 className="font-semibold text-sm">{task.template?.name || "Maintenance Task"}</h4>
              {task.template?.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {task.template.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(new Date(task.scheduled_date), "MMM d, yyyy")}
                </span>
                {task.vendor && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {task.vendor.name}
                  </span>
                )}
                {costRange && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {costRange}
                  </span>
                )}
              </div>
              {task.property && (
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  📍 {task.property.address || task.property.name}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{scheduledTasks.length}</div>
            <div className="text-xs text-muted-foreground">Total Scheduled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{upcomingTasks.length}</div>
            <div className="text-xs text-muted-foreground">Upcoming</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">${Math.round(totalEstimatedCost).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Est. Annual Cost</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium text-sm text-primary">Proactive Property Protection</h4>
              <p className="text-xs text-muted-foreground mt-1">
                PeachHaus schedules preventive maintenance to protect your investment, extend equipment life, 
                and prevent costly emergency repairs. You'll be notified before each service.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Upcoming Maintenance
          </h3>
          <div className="grid gap-3">
            {upcomingTasks.map(renderTaskCard)}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgressTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            In Progress
          </h3>
          <div className="grid gap-3">
            {inProgressTasks.map(renderTaskCard)}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </h3>
          <div className="grid gap-3">
            {completedTasks.slice(0, 5).map(renderTaskCard)}
          </div>
          {completedTasks.length > 5 && (
            <p className="text-xs text-center text-muted-foreground">
              + {completedTasks.length - 5} more completed tasks
            </p>
          )}
        </div>
      )}
    </div>
  );
}
