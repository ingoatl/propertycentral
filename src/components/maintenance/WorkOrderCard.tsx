import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WorkOrder, STATUS_CONFIG, URGENCY_CONFIG, WORK_ORDER_CATEGORIES } from "@/types/maintenance";
import { format } from "date-fns";
import { MapPin, User, Clock, DollarSign, Wrench } from "lucide-react";

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  onClick: () => void;
  compact?: boolean;
}

const WorkOrderCard = ({ workOrder, onClick, compact = false }: WorkOrderCardProps) => {
  const statusConfig = STATUS_CONFIG[workOrder.status];
  const urgencyConfig = URGENCY_CONFIG[workOrder.urgency];
  const category = WORK_ORDER_CATEGORIES.find(c => c.value === workOrder.category);

  if (compact) {
    return (
      <div
        className="p-3 bg-background border rounded-lg cursor-pointer hover:shadow-sm transition-shadow"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{workOrder.title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {workOrder.property?.name || workOrder.property?.address}
            </p>
          </div>
          <Badge className={`${urgencyConfig.bgColor} ${urgencyConfig.color} text-xs shrink-0`}>
            {urgencyConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>{category?.icon}</span>
          <span>{category?.label}</span>
          {workOrder.assigned_vendor && (
            <>
              <span>•</span>
              <span className="truncate">{workOrder.assigned_vendor.name}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{category?.icon}</span>
              <h3 className="font-semibold truncate">{workOrder.title}</h3>
            </div>
            
            {/* Property */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">
                {workOrder.property?.name || workOrder.property?.address}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {workOrder.description}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(workOrder.created_at), "MMM d, yyyy")}
              </div>
              {workOrder.assigned_vendor && (
                <div className="flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5" />
                  {workOrder.assigned_vendor.name}
                </div>
              )}
              {workOrder.estimated_cost && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  ${workOrder.estimated_cost}
                </div>
              )}
              {workOrder.reported_by && (
                <div className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {workOrder.reported_by}
                </div>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-2 shrink-0">
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            <Badge className={`${urgencyConfig.bgColor} ${urgencyConfig.color}`}>
              {urgencyConfig.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkOrderCard;
