import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary } from "@/types";
import { KPICard } from "./KPICard";
import { PropertyPerformanceGrid } from "./PropertyPerformanceGrid";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { EnhancedTeamPerformance } from "./EnhancedTeamPerformance";
import { OwnedPropertiesPerformance } from "./OwnedPropertiesPerformance";
import { DailyPerformanceEntriesList } from "./DailyPerformanceEntriesList";
import { SendTestTeamDigestButton } from "./SendTestTeamDigestButton";
import { DiscoveryCallCalendar } from "./DiscoveryCallCalendar";
import { OnboardingPropertiesTimeline } from "./OnboardingPropertiesTimeline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Presentation, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Building2, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TodaysFocusCard } from "./TodaysFocusCard";
import { NinjaFocusPanel } from "./NinjaFocusPanel";
import { PendingQuestionsCard } from "@/components/admin/PendingQuestionsCard";
import { DashboardBugReportsCard } from "@/components/admin/DashboardBugReportsCard";
import { EmailInsightsCard } from "@/components/EmailInsightsCard";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";
import { SyncStatusBar } from "@/components/admin/SyncStatusBar";
import { RoleFocusSection } from "./RoleFocusSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminDashboardProps {
  summaries: PropertySummary[];
  onExport: () => void;
  onSync: () => void;
  syncing: boolean;
  onSendOverdueEmails: () => void;
}

export const AdminDashboard = ({ summaries, onExport, onSync, syncing, onSendOverdueEmails }: AdminDashboardProps) => {
  const [selectedProperty, setSelectedProperty] = useState<PropertySummary | null>(null);
  const [propertyVisits, setPropertyVisits] = useState<any[]>([]);
  const [propertyExpenses, setPropertyExpenses] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [teamData, setTeamData] = useState<any>({ members: [], totalTasks: 0, completedTasks: 0 });

  // Calculate KPIs - separate managed vs owned
  const managedProperties = summaries.filter(s => s.isManaged);
  const ownedProperties = summaries.filter(s => {
    const propertyType = s.property?.propertyType;
    return propertyType === "Company-Owned";
  });
  const totalProperties = 14; // Fixed total count
  
  const totalRevenue = summaries.reduce((sum, s) => sum + (s.ownerrezRevenue || 0), 0);
  const ownedRevenue = ownedProperties.reduce((sum, s) => sum + (s.ownerrezRevenue || 0), 0);
  const managedRevenue = managedProperties.reduce((sum, s) => sum + (s.ownerrezRevenue || 0), 0);
  const totalManagementFees = summaries.reduce((sum, s) => sum + (s.managementFees || 0), 0);
  const totalExpenses = managedProperties.reduce((sum, s) => sum + (s.expenseTotal || 0), 0);
  const avgOccupancy = summaries.length > 0 
    ? summaries.reduce((sum, s) => sum + (s.occupancyRate || 0), 0) / summaries.length 
    : 0;

  // Calculate trends (comparing this month vs last month)
  const thisMonthRevenue = summaries.reduce((sum, s) => sum + (s.thisMonthRevenue || 0), 0);
  const lastMonthRevenue = summaries.reduce((sum, s) => sum + (s.lastMonthRevenue || 0), 0);
  const revenueTrend = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  useEffect(() => {
    loadActivityFeed();
    loadTeamData();
  }, []);

  const loadActivityFeed = async () => {
    try {
      // Load recent tasks, questions, and insights
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(10);

      const { data: questions } = await supabase
        .from("faq_questions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: insights } = await supabase
        .from("email_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const combinedActivities = [
        ...(tasks || []).map(t => ({
          id: t.id,
          type: "task" as const,
          title: t.title,
          description: t.description || "",
          timestamp: t.updated_at,
          status: t.status === "completed" ? "completed" : "pending",
        })),
        ...(questions || []).map(q => ({
          id: q.id,
          type: "question" as const,
          title: q.question,
          description: q.category || "",
          timestamp: q.created_at,
          status: q.status === "answered" ? "completed" : "pending",
        })),
        ...(insights || []).map(i => ({
          id: i.id,
          type: "insight" as const,
          title: i.subject,
          description: i.summary,
          timestamp: i.created_at,
          status: "new",
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(combinedActivities);
    } catch (error) {
      console.error("Error loading activity feed:", error);
    }
  };

  const loadTeamData = async () => {
    try {
      // Fetch all tasks with role assignments
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select(`
          id,
          status,
          phase_number,
          assigned_role_id,
          assigned_to_uuid,
          project_id,
          onboarding_projects!inner(property_address)
        `);

      // Fetch all approved users
      const { data: users } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .eq("status", "approved");

      // Fetch user-role mappings
      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select(`
          user_id,
          role_id,
          profiles!inner(first_name, id),
          team_roles!inner(role_name)
        `);

      if (!tasks || !userRoles || !users) return;

      // Create user ID to name mapping
      const userIdToName = users.reduce((acc, user: any) => {
        acc[user.id] = user.first_name || user.email.split('@')[0];
        return acc;
      }, {} as Record<string, string>);

      // Create role->users mapping
      const roleToUsers = userRoles.reduce((acc, ur: any) => {
        const roleId = ur.role_id;
        if (!acc[roleId]) {
          acc[roleId] = [];
        }
        acc[roleId].push({
          userId: ur.profiles.id,
          name: ur.profiles.first_name,
          roleName: ur.team_roles.role_name
        });
        return acc;
      }, {} as Record<string, Array<{ userId: string; name: string; roleName: string }>>);

      // Build member stats by aggregating tasks
      const memberStats: Record<string, any> = {};

      tasks.forEach((task: any) => {
        const roleId = task.assigned_role_id;
        const assignedUserId = task.assigned_to_uuid;
        
        // Handle tasks assigned directly to a user (not through a role)
        if (assignedUserId && !roleId) {
          const userName = userIdToName[assignedUserId] || "Unknown User";
          const key = `${userName}-direct`;
          
          if (!memberStats[key]) {
            memberStats[key] = {
              name: userName,
              roleName: "Direct Assignment",
              tasksCompleted: 0,
              tasksTotal: 0,
              properties: new Set<string>(),
              phases: new Set<number>()
            };
          }
          
          memberStats[key].tasksTotal++;
          if (task.status === "completed") {
            memberStats[key].tasksCompleted++;
          }
          if (task.onboarding_projects?.property_address) {
            memberStats[key].properties.add(task.onboarding_projects.property_address);
          }
          if (task.phase_number) {
            memberStats[key].phases.add(task.phase_number);
          }
          return;
        }
        
        if (!roleId) {
          // Handle unassigned tasks
          if (!memberStats["Unassigned"]) {
            memberStats["Unassigned"] = {
              name: "Unassigned",
              roleName: undefined,
              tasksCompleted: 0,
              tasksTotal: 0,
              properties: new Set<string>(),
              phases: new Set<number>()
            };
          }
          memberStats["Unassigned"].tasksTotal++;
          if (task.status === "completed") {
            memberStats["Unassigned"].tasksCompleted++;
          }
          if (task.onboarding_projects?.property_address) {
            memberStats["Unassigned"].properties.add(task.onboarding_projects.property_address);
          }
          if (task.phase_number) {
            memberStats["Unassigned"].phases.add(task.phase_number);
          }
          return;
        }

        const usersForRole = roleToUsers[roleId] || [];
        
        // Split credit among users with this role
        const taskShare = usersForRole.length > 0 ? 1 / usersForRole.length : 0;

        usersForRole.forEach((user) => {
          const key = `${user.name}-${user.roleName}`;
          
          if (!memberStats[key]) {
            memberStats[key] = {
              name: user.name,
              roleName: user.roleName,
              tasksCompleted: 0,
              tasksTotal: 0,
              properties: new Set<string>(),
              phases: new Set<number>()
            };
          }

          memberStats[key].tasksTotal += taskShare;
          if (task.status === "completed") {
            memberStats[key].tasksCompleted += taskShare;
          }
          if (task.onboarding_projects?.property_address) {
            memberStats[key].properties.add(task.onboarding_projects.property_address);
          }
          if (task.phase_number) {
            memberStats[key].phases.add(task.phase_number);
          }
        });
      });

      // Convert to array format
      const members = Object.values(memberStats).map((m: any) => ({
        name: m.name,
        roleName: m.roleName,
        phases: Array.from(m.phases).sort((a: number, b: number) => a - b),
        tasksCompleted: Math.round(m.tasksCompleted),
        tasksTotal: Math.round(m.tasksTotal),
        completionRate: m.tasksTotal > 0 ? (m.tasksCompleted / m.tasksTotal) * 100 : 0,
        properties: Array.from(m.properties),
      }));

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.status === "completed").length;

      setTeamData({ members, totalTasks, completedTasks });
    } catch (error) {
      console.error("Error loading team data:", error);
    }
  };

  const handlePropertyClick = async (property: PropertySummary) => {
    setSelectedProperty(property);
    
    if (!property.property.id.startsWith("ownerrez-")) {
      const { data: visits } = await supabase
        .from("visits")
        .select("*")
        .eq("property_id", property.property.id);

      const { data: expenses } = await supabase
        .from("expenses")
        .select("*")
        .eq("property_id", property.property.id);

      setPropertyVisits(visits || []);
      setPropertyExpenses(expenses || []);
    } else {
      setPropertyVisits([]);
      setPropertyExpenses([]);
    }
  };

  // Onboarding timeline - always visible (no collapsible)
  const OnboardingTimelineSection = () => (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
      <div className="p-4 flex items-center gap-3 border-b border-primary/10">
        <span className="text-2xl">🏗️</span>
        <div>
          <h3 className="font-semibold text-lg">Properties Onboarding</h3>
          <p className="text-sm text-muted-foreground">Track onboarding progress for new properties</p>
        </div>
      </div>
      <OnboardingPropertiesTimeline />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-6 max-md:px-3 py-4 max-md:py-3">
          <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-3">
            <div>
              <h1 className="text-3xl max-md:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                PeachHaus Dashboard
              </h1>
              <p className="text-sm max-md:text-xs text-muted-foreground mt-1">
                Comprehensive property management overview
              </p>
            </div>
            {/* Hide admin action buttons on mobile */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/onboarding-presentation">
                <Button variant="default" size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                  <Presentation className="h-4 w-4 mr-1" />
                  <span>Owner Pitch</span>
                </Button>
              </Link>
              <Link to="/designer-presentation">
                <Button variant="default" size="sm" className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white">
                  <Presentation className="h-4 w-4 mr-1" />
                  <span>Designer Pitch</span>
                </Button>
              </Link>
              <SendTestTeamDigestButton />
              <Button onClick={onSendOverdueEmails} variant="outline" size="sm">
                <AlertCircle className="h-4 w-4" />
                <span>Overdue</span>
              </Button>
              <Button onClick={onExport} variant="outline" size="sm">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </Button>
              <Button onClick={onSync} disabled={syncing} size="sm">
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? "Syncing..." : "Sync Data"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="container mx-auto px-6 max-md:px-3">
          <TabsList className="my-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="system-health">System Health</TabsTrigger>
            <TabsTrigger value="daily-entries">Daily Entries</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0">
        <div className="container mx-auto px-6 max-md:px-3 py-8 max-md:py-4 space-y-8 max-md:space-y-6">
        
        {/* Sync Status Bar - Always visible at top */}
        <SyncStatusBar />
        
        {/* TODAY'S FOCUS - Personalized greeting and daily summary - FIRST */}
        <TodaysFocusCard />
        
        {/* AI-Powered Ninja Focus Plan (Daily Planner) - SECOND */}
        <NinjaFocusPanel />
        
        {/* Discovery Call Calendar - THIRD */}
        <DiscoveryCallCalendar />
        
        {/* Role-Based Focus Section - After calendar */}
        <RoleFocusSection />
        
        {/* ACTION REQUIRED - Questions & Bugs */}
        <div className="p-4 rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-4">
            <AlertTriangle className="h-5 w-5" />
            Action Required
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PendingQuestionsCard />
            <DashboardBugReportsCard />
          </div>
        </div>
        
        {/* Onboarding Properties Timeline - Always visible */}
        <OnboardingTimelineSection />

        {/* Gmail Integration */}
        <EmailInsightsCard />

        {/* KPI Cards - Horizontal scroll on mobile */}
        <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex md:grid md:grid-cols-5 gap-3 md:gap-6 min-w-max md:min-w-0">
            <div className="w-[160px] md:w-auto flex-shrink-0 md:flex-shrink">
              <KPICard
                title="Total Properties"
                value={totalProperties}
                icon={Building2}
                subtitle="Under management"
              />
            </div>
            <div className="w-[160px] md:w-auto flex-shrink-0 md:flex-shrink">
              <KPICard
                title="Owned Properties"
                value={ownedProperties.length}
                icon={Building2}
                subtitle={`$${ownedRevenue.toLocaleString()} revenue`}
                className="bg-gradient-to-br from-primary/5 to-primary/10"
              />
            </div>
            <div className="w-[160px] md:w-auto flex-shrink-0 md:flex-shrink">
              <KPICard
                title="Total Revenue"
                value={`$${totalRevenue.toLocaleString()}`}
                icon={DollarSign}
                trend={{
                  value: Math.abs(revenueTrend),
                  isPositive: revenueTrend >= 0,
                }}
                subtitle="All properties"
              />
            </div>
            <div className="w-[160px] md:w-auto flex-shrink-0 md:flex-shrink">
              <KPICard
                title="Management Fees"
                value={`$${totalManagementFees.toLocaleString()}`}
                icon={TrendingUp}
                subtitle="From managed properties"
              />
            </div>
            <div className="w-[160px] md:w-auto flex-shrink-0 md:flex-shrink">
              <KPICard
                title="Avg Occupancy"
                value={`${avgOccupancy.toFixed(1)}%`}
                icon={Building2}
                subtitle="All properties"
              />
            </div>
          </div>
        </div>

        {/* OWNED PROPERTIES PERFORMANCE - Prominent Section */}
        {ownedProperties.length > 0 && (
          <div>
            <div className="mb-4 max-md:mb-3">
              <h2 className="text-2xl max-md:text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
                PeachHaus Portfolio Performance
              </h2>
              <p className="text-sm max-md:text-xs text-muted-foreground mt-1">
                Company-owned short-term rental properties
              </p>
            </div>
            <OwnedPropertiesPerformance ownedProperties={ownedProperties} />
          </div>
        )}

        {/* Managed Properties Performance Grid */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-xl max-md:text-lg">Client-Managed Properties</CardTitle>
            <p className="text-sm max-md:text-xs text-muted-foreground mt-1">Properties under management for clients</p>
          </CardHeader>
          <CardContent className="max-md:px-3">
            <PropertyPerformanceGrid
              properties={managedProperties}
              onPropertyClick={handlePropertyClick}
            />
          </CardContent>
        </Card>

        {/* Activity and Enhanced Team Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-md:gap-4">
          <RecentActivityFeed activities={activities} />
          <EnhancedTeamPerformance
            teamMembers={teamData.members}
            totalTasks={teamData.totalTasks}
            completedTasks={teamData.completedTasks}
          />
        </div>

      </div>
      </TabsContent>

      <TabsContent value="system-health" className="mt-0">
        <div className="container mx-auto px-6 max-md:px-3 py-8 max-md:py-4">
          <SystemHealthPanel />
        </div>
      </TabsContent>

      <TabsContent value="daily-entries">
        <div className="container mx-auto px-6 max-md:px-3 py-8 max-md:py-4">
          <DailyPerformanceEntriesList 
            startDate={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            endDate={new Date().toISOString().split('T')[0]}
          />
        </div>
      </TabsContent>
      </Tabs>

      {/* Property Detail Modal */}
      <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
        <DialogContent className="max-w-4xl max-md:max-w-full max-md:h-screen max-h-[80vh] max-md:max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="max-md:text-xl">{selectedProperty?.property.name}</DialogTitle>
          </DialogHeader>
          
          {selectedProperty && (
            <div className="space-y-6 max-md:space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-md:gap-3">
                <div className="space-y-1">
                  <p className="text-sm max-md:text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-xl max-md:text-lg font-bold">${selectedProperty.ownerrezRevenue.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm max-md:text-xs text-muted-foreground">Occupancy</p>
                  <p className="text-xl max-md:text-lg font-bold">{selectedProperty.occupancyRate.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm max-md:text-xs text-muted-foreground">Expenses</p>
                  <p className="text-xl max-md:text-lg font-bold">${selectedProperty.expenseTotal.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm max-md:text-xs text-muted-foreground">Net Balance</p>
                  <p className="text-xl max-md:text-lg font-bold">${selectedProperty.netBalance.toLocaleString()}</p>
                </div>
              </div>

              {propertyVisits.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Visits</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propertyVisits.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell>{visit.date}</TableCell>
                          <TableCell>{visit.time}</TableCell>
                          <TableCell>${visit.price}</TableCell>
                          <TableCell>{visit.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {propertyExpenses.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Expenses</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Purpose</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propertyExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{expense.date}</TableCell>
                          <TableCell>${expense.amount}</TableCell>
                          <TableCell>{expense.category || "-"}</TableCell>
                          <TableCell>{expense.purpose || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
