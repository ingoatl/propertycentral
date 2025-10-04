import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2, Calendar, DollarSign, TrendingUp, MapPin, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary } from "@/types";
import { toast } from "sonner";

const Dashboard = () => {
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);

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

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `peachhaus-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Report exported successfully!");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const totalVisits = summaries.reduce((sum, s) => sum + s.visitCount, 0);
  const totalRevenue = summaries.reduce((sum, s) => sum + s.visitTotal, 0);
  const totalExpenses = summaries.reduce((sum, s) => sum + s.expenseTotal, 0);
  const totalNet = totalRevenue - totalExpenses;

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
        <Button onClick={exportToCSV} className="shadow-warm hover:scale-105 transition-transform gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
            <div className={`p-2.5 rounded-lg ${totalNet >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <TrendingUp className={`h-5 w-5 ${totalNet >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalNet >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              ${totalNet.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Revenue minus expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Properties Overview */}
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
                  className="group p-6 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle"
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
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
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Net</p>
                        <p className={`font-bold text-lg ${summary.netBalance >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          ${summary.netBalance.toFixed(2)}
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
    </div>
  );
};

export default Dashboard;
