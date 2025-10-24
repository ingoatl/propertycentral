import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary } from "@/types";
import { KPICard } from "./KPICard";
import { PropertyPerformanceGrid } from "./PropertyPerformanceGrid";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { EnhancedTeamPerformance } from "./EnhancedTeamPerformance";
import { OwnedPropertiesPerformance } from "./OwnedPropertiesPerformance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Building2, DollarSign, TrendingUp, AlertCircle, MessageCircleQuestion, Bug } from "lucide-react";
import { toast } from "sonner";
import { OverdueTasksCard } from "./OverdueTasksCard";
import { PendingQuestionsCard } from "@/components/admin/PendingQuestionsCard";
import { DashboardBugReportsCard } from "@/components/admin/DashboardBugReportsCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const totalManagementFees = managedProperties.reduce((sum, s) => sum + (s.managementFees || 0), 0);
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
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select(`
          assigned_to, 
          status,
          project_id,
          onboarding_projects (
            property_address
          )
        `);

      if (tasks) {
        const memberStats = tasks.reduce((acc, task) => {
          const name = task.assigned_to || "Unassigned";
          if (!acc[name]) {
            acc[name] = { 
              name, 
              tasksCompleted: 0, 
              tasksTotal: 0, 
              completionRate: 0,
              properties: new Set<string>()
            };
          }
          acc[name].tasksTotal++;
          if (task.status === "completed") {
            acc[name].tasksCompleted++;
          }
          // Add property address if available
          if (task.onboarding_projects?.property_address) {
            acc[name].properties.add(task.onboarding_projects.property_address);
          }
          return acc;
        }, {} as Record<string, any>);

        const members = Object.values(memberStats).map((m: any) => ({
          name: m.name,
          tasksCompleted: m.tasksCompleted,
          tasksTotal: m.tasksTotal,
          completionRate: m.tasksTotal > 0 ? (m.tasksCompleted / m.tasksTotal) * 100 : 0,
          properties: Array.from(m.properties),
        }));

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === "completed").length;

        setTeamData({ members, totalTasks, completedTasks });
      }
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

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                PeachHaus Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Comprehensive property management overview
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={onSendOverdueEmails} variant="outline" size="sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                Send Overdue Emails
              </Button>
              <Button onClick={onExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={onSync} disabled={syncing} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Data"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Alert Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OverdueTasksCard />
          </div>
          <div>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircleQuestion className="h-5 w-5 text-primary" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Pending Questions</span>
                  <span className="text-lg font-bold text-foreground">--</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Open Bug Reports</span>
                  <span className="text-lg font-bold text-foreground">--</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <KPICard
            title="Total Properties"
            value={totalProperties}
            icon={Building2}
            subtitle="Under management"
          />
          <KPICard
            title="Owned Properties"
            value={ownedProperties.length}
            icon={Building2}
            subtitle={`$${ownedRevenue.toLocaleString()} revenue`}
            className="bg-gradient-to-br from-primary/5 to-primary/10"
          />
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
          <KPICard
            title="Management Fees"
            value={`$${totalManagementFees.toLocaleString()}`}
            icon={TrendingUp}
            subtitle="From managed properties"
          />
          <KPICard
            title="Avg Occupancy"
            value={`${avgOccupancy.toFixed(1)}%`}
            icon={Building2}
            subtitle="All properties"
          />
        </div>

        {/* OWNED PROPERTIES PERFORMANCE - Prominent Section */}
        {ownedProperties.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                PeachHaus Portfolio Performance
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Company-owned short-term rental properties
              </p>
            </div>
            <OwnedPropertiesPerformance ownedProperties={ownedProperties} />
          </div>
        )}

        {/* Managed Properties Performance Grid */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Client-Managed Properties</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Properties under management for clients</p>
          </CardHeader>
          <CardContent>
            <PropertyPerformanceGrid
              properties={managedProperties}
              onPropertyClick={handlePropertyClick}
            />
          </CardContent>
        </Card>

        {/* Activity and Enhanced Team Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityFeed activities={activities} />
          <EnhancedTeamPerformance
            teamMembers={teamData.members}
            totalTasks={teamData.totalTasks}
            completedTasks={teamData.completedTasks}
          />
        </div>

        {/* Admin Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingQuestionsCard />
          <DashboardBugReportsCard />
        </div>
      </div>

      {/* Property Detail Modal */}
      <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProperty?.property.name}</DialogTitle>
          </DialogHeader>
          
          {selectedProperty && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold">${selectedProperty.ownerrezRevenue.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Occupancy</p>
                  <p className="text-xl font-bold">{selectedProperty.occupancyRate.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-xl font-bold">${selectedProperty.expenseTotal.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Net Balance</p>
                  <p className="text-xl font-bold">${selectedProperty.netBalance.toLocaleString()}</p>
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
