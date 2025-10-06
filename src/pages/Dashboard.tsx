import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Building2, Calendar, DollarSign, MapPin, Activity, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary, Visit, Expense } from "@/types";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, startOfMonth } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const Dashboard = () => {
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<PropertySummary | null>(null);
  const [propertyVisits, setPropertyVisits] = useState<Visit[]>([]);
  const [propertyExpenses, setPropertyExpenses] = useState<Expense[]>([]);
  const [monthlyVisits, setMonthlyVisits] = useState<{ month: string; visits: number }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (propertiesError) throw propertiesError;

      const { data: visits, error: visitsError } = await supabase
        .from("visits")
        .select("*");

      if (visitsError) throw visitsError;

      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*");

      if (expensesError) throw expensesError;

      const summaryData = (properties || []).map(property => {
        const propertyVisits = (visits || []).filter(v => v.property_id === property.id);
        const propertyExpenses = (expenses || []).filter(e => e.property_id === property.id);
        
        const visitTotal = propertyVisits.reduce((sum, v) => sum + Number(v.price), 0);
        const expenseTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        return {
          property: {
            id: property.id,
            name: property.name,
            address: property.address,
            visitPrice: Number(property.visit_price),
            createdAt: property.created_at,
          },
          visitCount: propertyVisits.length,
          visitTotal,
          expenseTotal,
          netBalance: visitTotal - expenseTotal,
        };
      });

      // Group visits by month
      const visitsGrouped = (visits || []).reduce((acc, visit) => {
        const monthKey = format(startOfMonth(parseISO(visit.date)), 'MMM yyyy');
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const monthlyData = Object.entries(visitsGrouped)
        .map(([month, count]) => ({ month, visits: count }))
        .sort((a, b) => {
          const dateA = parseISO(`01 ${a.month}`);
          const dateB = parseISO(`01 ${b.month}`);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(-6); // Last 6 months

      setMonthlyVisits(monthlyData);
      setSummaries(summaryData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      const { data: properties } = await supabase.from("properties").select("*");
      const { data: visits } = await supabase.from("visits").select("*");
      const { data: expenses } = await supabase.from("expenses").select("*");

      let csv = "Type,Property,Date,Amount,Notes\n";

      (visits || []).forEach((visit) => {
        const property = (properties || []).find((p) => p.id === visit.property_id);
        csv += `Visit,"${property?.name}","${visit.date}",${visit.price},"${visit.notes || ""}"\n`;
      });

      (expenses || []).forEach((expense) => {
        const property = (properties || []).find((p) => p.id === expense.property_id);
        csv += `Expense,"${property?.name}","${expense.date}",${expense.amount},"${expense.purpose || ""}"\n`;
      });

      const fileName = `peachhaus-report-${new Date().toISOString().split("T")[0]}.csv`;

      // Download locally
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);

      // Send via email
      const { error: emailError } = await supabase.functions.invoke("send-report-email", {
        body: { csvData: csv, fileName }
      });

      if (emailError) {
        console.error("Email error:", emailError);
        toast.success("Report exported! Email sending failed.");
      } else {
        toast.success("Report exported and emailed to anja@peachhausgroup.com!");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    }
  };

  const totalVisits = summaries.reduce((sum, s) => sum + s.visitCount, 0);
  const totalRevenue = summaries.reduce((sum, s) => sum + s.visitTotal, 0);
  const totalExpenses = summaries.reduce((sum, s) => sum + s.expenseTotal, 0);

  const handlePropertyClick = async (summary: PropertySummary) => {
    setSelectedProperty(summary);
    
    const { data: visits } = await supabase
      .from("visits")
      .select("*")
      .eq("property_id", summary.property.id)
      .order("date", { ascending: false });
    
    const { data: expenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("property_id", summary.property.id)
      .order("date", { ascending: false });
    
    setPropertyVisits((visits || []).map(v => ({
      id: v.id,
      propertyId: v.property_id,
      date: v.date,
      time: v.time,
      price: Number(v.price),
      notes: v.notes,
      createdAt: v.created_at,
    })));
    
    setPropertyExpenses((expenses || []).map(e => ({
      id: e.id,
      propertyId: e.property_id,
      amount: Number(e.amount),
      date: e.date,
      purpose: e.purpose,
      filePath: e.file_path,
      createdAt: e.created_at,
    })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Activity className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/50">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Overview of all PeachHaus properties</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              try {
                const { error } = await supabase.functions.invoke("send-monthly-report");
                if (error) {
                  console.error("Email error:", error);
                  toast.error("Failed to send test email");
                } else {
                  toast.success("Test email sent to anja@peachhausgroup.com!");
                }
              } catch (error) {
                console.error("Test email error:", error);
                toast.error("Failed to send test email");
              }
            }} 
            className="shadow-warm hover:scale-105 transition-transform gap-2"
            variant="outline"
          >
            Send Test Email
          </Button>
          <Button onClick={exportToCSV} className="shadow-warm hover:scale-105 transition-transform gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Properties</CardTitle>
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summaries.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active properties</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Visits</CardTitle>
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalVisits}</div>
            <p className="text-xs text-muted-foreground mt-1">Property visits logged</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="p-2.5 bg-green-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">
              ${totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">From all visits</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <div className="p-2.5 bg-red-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-red-600 dark:text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-500">
              ${totalExpenses.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All property expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Visits Chart */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
            Visits Per Month
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {monthlyVisits.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No visits recorded yet</p>
            </div>
          ) : (
            <ChartContainer
              config={{
                visits: {
                  label: "Visits",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyVisits}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="visits" 
                    fill="hsl(var(--primary))" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-5 w-5 text-primary" />
            Property Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {summaries.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No properties yet. Add your first property to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map((summary, index) => (
                <div 
                  key={summary.property.id} 
                  onClick={() => handlePropertyClick(summary)}
                  className="group p-6 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle cursor-pointer"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {summary.property.name}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {summary.property.address}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Visit Rate: <span className="font-semibold text-foreground">${summary.property.visitPrice.toFixed(2)}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Visits</p>
                        <p className="font-bold text-lg">{summary.visitCount}</p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Revenue</p>
                        <p className="font-bold text-lg text-green-600 dark:text-green-500">
                          ${summary.visitTotal.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Expenses</p>
                        <p className="font-bold text-lg text-red-600 dark:text-red-500">
                          ${summary.expenseTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Property Details Modal */}
      <Dialog open={!!selectedProperty} onOpenChange={() => setSelectedProperty(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedProperty?.property.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {selectedProperty?.property.address}
            </p>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Visits</p>
                    <p className="text-2xl font-bold">{selectedProperty?.visitCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                      ${selectedProperty?.visitTotal.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Expenses</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                      ${selectedProperty?.expenseTotal.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Visits Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Visits
              </h3>
              {propertyVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No visits recorded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyVisits.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>{new Date(visit.date).toLocaleDateString()}</TableCell>
                        <TableCell>{visit.time}</TableCell>
                        <TableCell className="text-muted-foreground">{visit.notes || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600 dark:text-green-500">
                          ${Number(visit.price).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Expenses Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Expenses
              </h3>
              {propertyExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses recorded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propertyExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground">{expense.purpose || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-500">
                          ${Number(expense.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
