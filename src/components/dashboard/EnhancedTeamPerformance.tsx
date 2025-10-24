import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, Clock, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TeamMember {
  name: string;
  roleName?: string;
  phases?: number[];
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  overdueTasks?: number;
  avgResponseTime?: number;
  properties?: string[]; // Property addresses
}

interface EnhancedTeamPerformanceProps {
  teamMembers: TeamMember[];
  totalTasks: number;
  completedTasks: number;
}

export const EnhancedTeamPerformance = ({ teamMembers, totalTasks, completedTasks }: EnhancedTeamPerformanceProps) => {
  const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Filter out Unassigned and sort by tasks completed first
  const filteredMembers = teamMembers.filter(m => m.name !== "Unassigned");
  const sortedMembers = [...filteredMembers].sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  const topPerformer = sortedMembers[0];

  // Calculate tasks per week (assuming 4 weeks tracking period)
  const getTasksPerWeek = (completed: number) => (completed / 4).toFixed(1);

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
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-full bg-primary/20 p-2">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Best Performer - Most Tasks Completed</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{topPerformer.name}</p>
                  {topPerformer.roleName && (
                    <Badge variant="secondary" className="text-xs">
                      {topPerformer.roleName}
                    </Badge>
                  )}
                </div>
                {topPerformer.phases && topPerformer.phases.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Owns Phases: {topPerformer.phases.sort((a, b) => a - b).join(", ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{topPerformer.tasksCompleted}</p>
                <p className="text-xs text-muted-foreground">tasks completed</p>
              </div>
            </div>
            {topPerformer.properties && topPerformer.properties.length > 0 && (
              <div className="mt-2 pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Working on:</p>
                <div className="flex flex-wrap gap-1">
                  {topPerformer.properties.slice(0, 3).map((property, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {property}
                    </Badge>
                  ))}
                  {topPerformer.properties.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{topPerformer.properties.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
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
                const tasksPerWeek = getTasksPerWeek(member.tasksCompleted);
                return (
                  <div key={index} className="space-y-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{member.name}</span>
                            {member.roleName && (
                              <Badge variant="secondary" className="text-xs">
                                {member.roleName}
                              </Badge>
                            )}
                          </div>
                          {member.phases && member.phases.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Phases: {member.phases.sort((a, b) => a - b).join(", ")}
                            </p>
                          )}
                          {member.properties && member.properties.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {member.properties.slice(0, 2).map((property, idx) => (
                                <span key={idx} className="text-xs text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                                  {property}
                                </span>
                              ))}
                              {member.properties.length > 2 && (
                                <span className="text-xs text-muted-foreground/80">
                                  +{member.properties.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {member.tasksCompleted}
                        </p>
                        <p className="text-xs text-muted-foreground">tasks completed</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tasksPerWeek}/week
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>Total: {member.tasksTotal} tasks</span>
                      <span className="font-medium">{member.completionRate.toFixed(0)}% complete</span>
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
            <p className="text-xs text-muted-foreground mb-1">Total Completed</p>
            <p className="text-lg font-bold">
              {filteredMembers.reduce((sum, m) => sum + m.tasksCompleted, 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">tasks</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Avg Per Week</p>
            <p className="text-lg font-bold">
              {filteredMembers.length > 0 
                ? (filteredMembers.reduce((sum, m) => sum + m.tasksCompleted, 0) / filteredMembers.length / 4).toFixed(1)
                : 0}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">tasks/member</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
