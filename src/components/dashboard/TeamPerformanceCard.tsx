import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, Clock } from "lucide-react";

interface TeamMember {
  name: string;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
}

interface TeamPerformanceCardProps {
  teamMembers: TeamMember[];
  totalTasks: number;
  completedTasks: number;
}

export const TeamPerformanceCard = ({ teamMembers, totalTasks, completedTasks }: TeamPerformanceCardProps) => {
  const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Completed</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{completedTasks}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-xs">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalTasks - completedTasks}</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Overall Completion</span>
            <span className="text-sm font-bold text-primary">{overallCompletionRate.toFixed(0)}%</span>
          </div>
          <Progress value={overallCompletionRate} className="h-2" />
        </div>

        {/* Team Members */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Team Members</h4>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No team data available</p>
          ) : (
            teamMembers.slice(0, 5).map((member, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.tasksCompleted}/{member.tasksTotal}
                  </span>
                </div>
                <Progress value={member.completionRate} className="h-1.5" />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
