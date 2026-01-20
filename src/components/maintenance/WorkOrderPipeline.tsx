import { ArrowRight, Circle, Send, Clock, Wrench, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PipelineStage {
  key: string;
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  items: Array<{ id: string; title: string; property: string }>;
}

interface WorkOrderPipelineProps {
  workOrders: Array<{
    id: string;
    title: string;
    status: string;
    property?: { name: string | null; address: string | null } | null;
  }>;
  onStageClick?: (status: string) => void;
}

export function WorkOrderPipeline({ workOrders, onStageClick }: WorkOrderPipelineProps) {
  const getPropertyLabel = (wo: WorkOrderPipelineProps["workOrders"][0]) => {
    return wo.property?.name || wo.property?.address || "Unknown";
  };

  const stages: PipelineStage[] = [
    {
      key: "new",
      label: "New",
      icon: Circle,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
      count: 0,
      items: [],
    },
    {
      key: "dispatched",
      label: "Dispatched",
      icon: Send,
      color: "text-purple-600",
      bgColor: "bg-purple-50 border-purple-200",
      count: 0,
      items: [],
    },
    {
      key: "awaiting_approval",
      label: "Awaiting",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50 border-amber-200",
      count: 0,
      items: [],
    },
    {
      key: "in_progress",
      label: "In Progress",
      icon: Wrench,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
      count: 0,
      items: [],
    },
    {
      key: "pending_verification",
      label: "Verify",
      icon: AlertCircle,
      color: "text-teal-600",
      bgColor: "bg-teal-50 border-teal-200",
      count: 0,
      items: [],
    },
  ];

  // Populate stages with work orders
  workOrders.forEach((wo) => {
    const stage = stages.find((s) => s.key === wo.status);
    if (stage) {
      stage.count++;
      if (stage.items.length < 3) {
        stage.items.push({
          id: wo.id,
          title: wo.title,
          property: getPropertyLabel(wo),
        });
      }
    }
  });

  const totalActive = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="border-2 border-dashed border-muted-foreground/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Work Order Pipeline
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {totalActive} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2 overflow-x-auto pb-2">
          {stages.map((stage, index) => (
            <div key={stage.key} className="flex items-start">
              <button
                onClick={() => onStageClick?.(stage.key)}
                className={cn(
                  "min-w-[140px] rounded-lg border p-3 transition-all hover:shadow-md cursor-pointer",
                  stage.bgColor
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <stage.icon className={cn("h-4 w-4", stage.color)} />
                  <span className="font-medium text-sm">{stage.label}</span>
                  <Badge
                    variant="secondary"
                    className={cn("ml-auto text-xs", stage.count > 0 && stage.color)}
                  >
                    {stage.count}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {stage.items.slice(0, 2).map((item) => (
                    <div
                      key={item.id}
                      className="text-xs text-muted-foreground truncate"
                      title={`${item.title} - ${item.property}`}
                    >
                      • {item.title}
                    </div>
                  ))}
                  {stage.count > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{stage.count - 2} more
                    </div>
                  )}
                  {stage.count === 0 && (
                    <div className="text-xs text-muted-foreground italic">None</div>
                  )}
                </div>
              </button>
              {index < stages.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 mt-6 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
