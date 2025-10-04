import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { storage } from "@/lib/storage";
import { PropertySummary } from "@/types";
import { toast } from "sonner";

const Dashboard = () => {
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const properties = storage.getProperties();
    const visits = storage.getVisits();
    const expenses = storage.getExpenses();

    const summaries: PropertySummary[] = properties.map((property) => {
      const propertyVisits = visits.filter((v) => v.propertyId === property.id);
      const propertyExpenses = expenses.filter((e) => e.propertyId === property.id);

      const visitTotal = propertyVisits.reduce((sum, v) => sum + v.price, 0);
      const expenseTotal = propertyExpenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        property,
        visitCount: propertyVisits.length,
        visitTotal,
        expenseTotal,
        netBalance: visitTotal - expenseTotal,
      };
    });

    setSummaries(summaries);
  };

  const exportToCSV = () => {
    const properties = storage.getProperties();
    const visits = storage.getVisits();
    const expenses = storage.getExpenses();

    let csv = "Type,Property,Date,Amount,Notes\n";

    visits.forEach((visit) => {
      const property = properties.find((p) => p.id === visit.propertyId);
      csv += `Visit,"${property?.name}","${visit.date}",${visit.price},"${visit.notes || ""}"\n`;
    });

    expenses.forEach((expense) => {
      const property = properties.find((p) => p.id === expense.propertyId);
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
  };

  const totalVisits = summaries.reduce((sum, s) => sum + s.visitCount, 0);
  const totalRevenue = summaries.reduce((sum, s) => sum + s.visitTotal, 0);
  const totalExpenses = summaries.reduce((sum, s) => sum + s.expenseTotal, 0);
  const totalNet = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of all properties and activities</p>
        </div>
        <Button onClick={exportToCSV} className="gap-2 shadow-warm">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Total Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{summaries.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalVisits}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Net Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalNet >= 0 ? "text-primary" : "text-destructive"}`}>
              ${totalNet.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Properties Breakdown</h2>
        {summaries.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No properties yet. Add your first property to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summaries.map((summary) => (
              <Card key={summary.property.id} className="shadow-card hover:shadow-warm transition-shadow">
                <CardHeader>
                  <CardTitle className="text-foreground">{summary.property.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">{summary.property.address}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Visit Price</p>
                      <p className="font-semibold text-foreground">${summary.property.visitPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Visits</p>
                      <p className="font-semibold text-foreground">{summary.visitCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Visit Revenue</p>
                      <p className="font-semibold text-primary">${summary.visitTotal.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expenses</p>
                      <p className="font-semibold text-foreground">${summary.expenseTotal.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">Net Balance</p>
                    <p className={`text-xl font-bold ${summary.netBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                      ${summary.netBalance.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
