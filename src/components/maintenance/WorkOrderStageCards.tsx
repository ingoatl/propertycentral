import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, URGENCY_CONFIG } from "@/types/maintenance";

interface WorkOrder {
  id: string;
  title: string;
  status: string;
  urgency: string;
  category: string | null;
  quoted_cost: number | null;
  created_at: string;
  property: { name: string | null; address: string | null } | null;
  assigned_vendor: { name: string; company_name: string | null } | null;
}

interface WorkOrderStageCardsProps {
  workOrders: WorkOrder[];
  onViewDetails: (workOrder: WorkOrder) => void;
  isLoading?: boolean;
}

// Work order stages in order
const STAGES = [
  { key: "new", label: "New", step: 1 },
  { key: "dispatched", label: "Dispatched", step: 2 },
  { key: "scheduled", label: "Scheduled", step: 3 },
  { key: "in_progress", label: "In Progress", step: 4 },
  { key: "pending_verification", label: "Verify", step: 5 },
  { key: "completed", label: "Done", step: 6 },
];

const getStageIndex = (status: string): number => {
  const index = STAGES.findIndex((s) => s.key === status);
  return index >= 0 ? index : 0;
};

const StageIndicator = ({ currentStatus }: { currentStatus: string }) => {
  const currentIndex = getStageIndex(currentStatus);
  
  return (
    <div className="flex items-center justify-between mt-4">
      {STAGES.slice(0, 5).map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;
        
        return (
          <div key={stage.key} className="flex items-center flex-1">
            {/* Stage circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  isPending && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  stage.step
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1 text-center leading-tight",
                  isCurrent && "font-semibold text-primary",
                  isPending && "text-muted-foreground",
                  isCompleted && "text-green-600"
                )}
              >
                {stage.label}
              </span>
            </div>
            
            {/* Connector line */}
            {index < 4 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1",
                  index < currentIndex ? "bg-green-500" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export const WorkOrderStageCards = ({
  workOrders,
  onViewDetails,
  isLoading,
}: WorkOrderStageCardsProps) => {
  // Filter to only show active work orders (not completed/cancelled)
  const activeWorkOrders = workOrders.filter(
    (wo) => !["completed", "cancelled"].includes(wo.status)
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-48" />
          </Card>
        ))}
      </div>
    );
  }

  if (activeWorkOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Active Work Orders</h3>
          <p className="text-muted-foreground mt-1">
            All work orders have been completed
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Work Orders</h2>
        <Badge variant="secondary">{activeWorkOrders.length} active</Badge>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeWorkOrders.map((workOrder) => {
          const urgencyConfig = URGENCY_CONFIG[workOrder.urgency as keyof typeof URGENCY_CONFIG];
          const statusConfig = STATUS_CONFIG[workOrder.status as keyof typeof STATUS_CONFIG];
          
          return (
            <Card
              key={workOrder.id}
              className="cursor-pointer hover:shadow-md transition-shadow border"
              onClick={() => onViewDetails(workOrder)}
            >
              <CardContent className="p-4">
                {/* Header with title and status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{workOrder.title}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {workOrder.property?.name || workOrder.property?.address || "Unknown Property"}
                      </span>
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0",
                      statusConfig?.bgColor,
                      statusConfig?.color
                    )}
                  >
                    {statusConfig?.label || workOrder.status}
                  </Badge>
                </div>
                
                {/* Vendor info */}
                <div className="text-sm text-muted-foreground mt-2">
                  {workOrder.assigned_vendor ? (
                    <span>
                      Vendor: <span className="font-medium text-foreground">{workOrder.assigned_vendor.name}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Unassigned
                    </span>
                  )}
                </div>

                {/* Urgency indicator */}
                {workOrder.urgency === "high" || workOrder.urgency === "emergency" ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-2 text-xs",
                      urgencyConfig?.color,
                      "border-current"
                    )}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {urgencyConfig?.label}
                  </Badge>
                ) : null}
                
                {/* Stage indicator */}
                <StageIndicator currentStatus={workOrder.status} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
