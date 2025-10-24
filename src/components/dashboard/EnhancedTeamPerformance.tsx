import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, Clock, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  name: string;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  overdueTasks?: number;
  avgResponseTime?: number;
}

interface EnhancedTeamPerformanceProps {
  teamMembers: TeamMember[];
  totalTasks: number;
  completedTasks: number;
}

export const EnhancedTeamPerformance = ({ teamMembers, totalTasks, completedTasks }: EnhancedTeamPerformanceProps) => {
  const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Sort by completion rate and get top performers
  const sortedMembers = [...teamMembers].sort((a, b) => b.completionRate - a.completionRate);
  const topPerformer = sortedMembers[0];

  const getPerformanceBadge = (rate: number) => {
    if (rate >= 90) return { label: "Excellent", variant: "default" as const, color: "text-green-600" };
    if (rate >= 70) return { label: "Good", variant: "secondary" as const, color: "text-blue-600" };
    if (rate >= 50) return { label: "Average", variant: "outline" as const, color: "text-yellow-600" };
    return { label: "Needs Improvement", variant: "destructive" as const, color: "text-red-600" };
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Performance Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Completed</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{completedTasks}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalTasks - completedTasks}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Rate</span>
            </div>
            <p className="text-2xl font-bold text-primary">{overallCompletionRate.toFixed(0)}%</p>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Overall Team Completion</span>
            <span className="text-sm font-bold text-primary">{overallCompletionRate.toFixed(1)}%</span>
          </div>
          <Progress value={overallCompletionRate} className="h-3" />
        </div>

        {/* Top Performer Highlight */}
        {topPerformer && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/20 p-2">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Top Performer</p>
                <p className="text-lg font-bold">{topPerformer.name}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{topPerformer.completionRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">{topPerformer.tasksCompleted}/{topPerformer.tasksTotal} tasks</p>
              </div>
            </div>
          </div>
        )}

        {/* Team Members Detailed List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Team Members</h4>
            <Badge variant="outline" className="text-xs">{teamMembers.length} members</Badge>
          </div>
          
          {teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No team data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedMembers.map((member, index) => {
                const badge = getPerformanceBadge(member.completionRate);
                return (
                  <div key={index} className="space-y-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{member.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={badge.variant} className="text-xs">
                              {badge.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {member.tasksCompleted}/{member.tasksTotal} tasks
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${badge.color}`}>
                          {member.completionRate.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <Progress value={member.completionRate} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/50">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Avg Completion</p>
            <p className="text-lg font-bold">
              {teamMembers.length > 0 
                ? (teamMembers.reduce((sum, m) => sum + m.completionRate, 0) / teamMembers.length).toFixed(0)
                : 0}%
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">High Performers</p>
            <p className="text-lg font-bold">
              {teamMembers.filter(m => m.completionRate >= 90).length}/{teamMembers.length}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
