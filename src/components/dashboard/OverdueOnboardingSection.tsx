import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Clock, 
  Building2, 
  ChevronDown, 
  ChevronRight,
  Target,
  Loader2,
  ExternalLink,
  Zap
} from "lucide-react";
import { useOverdueOnboardingTasks, OverdueOnboardingTask } from "@/hooks/useOverdueOnboardingTasks";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";

const urgencyConfig = {
  critical: { label: "Critical", color: "bg-destructive/20 text-destructive border-destructive/30", icon: AlertTriangle },
  high: { label: "High", color: "bg-warning/20 text-warning border-warning/30", icon: Clock },
  standard: { label: "Standard", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

function QuickWinItem({ task, onClick }: { task: OverdueOnboardingTask; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-all w-full text-left group"
    >
      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground truncate">{task.property_name}</p>
      </div>
      <Badge variant="outline" className="text-xs flex-shrink-0">
        {task.estimated_minutes} min
      </Badge>
      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function PropertyGroup({ 
  propertyName, 
  tasks,
  onTaskClick 
}: { 
  propertyName: string; 
  tasks: OverdueOnboardingTask[];
  onTaskClick: (task: OverdueOnboardingTask) => void;
}) {
  const [open, setOpen] = useState(false);
  
  const criticalCount = tasks.filter(t => t.urgency === "critical").length;
  const highCount = tasks.filter(t => t.urgency === "high").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 hover:bg-muted/50 rounded-lg">
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 truncate">{propertyName}</span>
        <div className="flex items-center gap-1">
          {criticalCount > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">
              {criticalCount}
            </Badge>
          )}
          {highCount > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning text-xs">
              {highCount}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1 pl-6">
          {tasks.slice(0, 5).map((task) => {
            const config = urgencyConfig[task.urgency];
            return (
              <button
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 w-full text-left text-sm"
              >
                <div className={cn("w-2 h-2 rounded-full", 
                  task.urgency === "critical" ? "bg-destructive" : 
                  task.urgency === "high" ? "bg-warning" : "bg-muted-foreground"
                )} />
                <span className="truncate flex-1">{task.title}</span>
                <span className="text-xs text-muted-foreground">{task.days_overdue}d</span>
              </button>
            );
          })}
          {tasks.length > 5 && (
            <p className="text-xs text-muted-foreground pl-4">
              +{tasks.length - 5} more tasks
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface OverdueOnboardingSectionProps {
  userId?: string;
  maxHeight?: string;
}

export function OverdueOnboardingSection({ userId, maxHeight = "400px" }: OverdueOnboardingSectionProps) {
  const { data, isLoading, error } = useOverdueOnboardingTasks(userId);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"quick-wins" | "property" | "urgency">("quick-wins");

  const handleTaskClick = (task: OverdueOnboardingTask) => {
    // Navigate to the onboarding workflow for this project
    navigate(`/onboarding/${task.project_id}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.totalCount === 0) {
    return null; // Don't show if no overdue tasks
  }

  const totalMinutes = data.quickWins.reduce((acc, t) => acc + t.estimated_minutes, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Overdue Onboarding
            <Badge variant="destructive">{data.totalCount}</Badge>
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.totalCount} tasks across {data.propertyCount} properties need attention
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View Mode Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === "quick-wins" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setViewMode("quick-wins")}
          >
            <Target className="w-3 h-3 mr-1" />
            Quick Wins
          </Button>
          <Button
            variant={viewMode === "property" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setViewMode("property")}
          >
            <Building2 className="w-3 h-3 mr-1" />
            By Property
          </Button>
          <Button
            variant={viewMode === "urgency" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setViewMode("urgency")}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            By Urgency
          </Button>
        </div>

        <div className={cn("overflow-y-auto", `max-h-[${maxHeight}]`)}>
          {/* Quick Wins View */}
          {viewMode === "quick-wins" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="w-4 h-4 text-amber-500" />
                <span>Complete these {data.quickWins.length} tasks in ~{totalMinutes} minutes</span>
              </div>
              <div className="space-y-2">
                {data.quickWins.map((task) => (
                  <QuickWinItem 
                    key={task.id} 
                    task={task} 
                    onClick={() => handleTaskClick(task)}
                  />
                ))}
              </div>
              {data.totalCount > data.quickWins.length && (
                <Button 
                  variant="outline" 
                  className="w-full text-sm"
                  onClick={() => setViewMode("property")}
                >
                  View all {data.totalCount} tasks by property
                </Button>
              )}
            </div>
          )}

          {/* By Property View */}
          {viewMode === "property" && (
            <div className="space-y-1">
              {Object.entries(data.byProperty)
                .sort(([, a], [, b]) => b.length - a.length)
                .map(([propertyName, tasks]) => (
                  <PropertyGroup
                    key={propertyName}
                    propertyName={propertyName}
                    tasks={tasks}
                    onTaskClick={handleTaskClick}
                  />
                ))}
            </div>
          )}

          {/* By Urgency View */}
          {viewMode === "urgency" && (
            <div className="space-y-4">
              {data.byUrgency.critical.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-destructive/10 text-destructive">
                      Critical ({data.byUrgency.critical.length})
                    </Badge>
                    <span className="text-xs text-muted-foreground">Owner info, insurance, legal</span>
                  </div>
                  <div className="space-y-1 pl-2">
                    {data.byUrgency.critical.slice(0, 5).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 w-full text-left text-sm"
                      >
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                        <span className="truncate flex-1">{task.title}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{task.property_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {data.byUrgency.high.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-warning/10 text-warning">
                      High ({data.byUrgency.high.length})
                    </Badge>
                    <span className="text-xs text-muted-foreground">Access, WiFi, property setup</span>
                  </div>
                  <div className="space-y-1 pl-2">
                    {data.byUrgency.high.slice(0, 5).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 w-full text-left text-sm"
                      >
                        <Clock className="w-3 h-3 text-warning" />
                        <span className="truncate flex-1">{task.title}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{task.property_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {data.byUrgency.standard.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Standard ({data.byUrgency.standard.length})
                    </Badge>
                    <span className="text-xs text-muted-foreground">Remaining setup items</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-2">
                    {data.byUrgency.standard.length} remaining tasks - view by property for details
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
