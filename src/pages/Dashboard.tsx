import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Building2, Calendar, DollarSign, MapPin, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary, Visit, Expense, OwnerRezBooking } from "@/types";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Dashboard = () => {
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<PropertySummary | null>(null);
  const [propertyVisits, setPropertyVisits] = useState<Visit[]>([]);
  const [propertyExpenses, setPropertyExpenses] = useState<Expense[]>([]);
  const [allVisits, setAllVisits] = useState<Record<string, Visit[]>>({});
  const [ownerrezBookings, setOwnerrezBookings] = useState<OwnerRezBooking[]>([]);
  const [syncing, setSyncing] = useState(false);

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

      const { data: bookings, error: bookingsError } = await supabase
        .from("ownerrez_bookings")
        .select("*");

      if (bookingsError) throw bookingsError;

      setOwnerrezBookings((bookings || []).map(b => ({
        id: b.id,
        propertyId: b.property_id,
        ownerrezListingId: b.ownerrez_listing_id,
        ownerrezListingName: b.ownerrez_listing_name,
        bookingId: b.booking_id,
        guestName: b.guest_name,
        checkIn: b.check_in,
        checkOut: b.check_out,
        totalAmount: Number(b.total_amount),
        managementFee: Number(b.management_fee),
        bookingStatus: b.booking_status,
        syncDate: b.sync_date,
        createdAt: b.created_at,
      })));

      const summaryData = (properties || []).map(property => {
        const propertyVisits = (visits || []).filter(v => v.property_id === property.id);
        const propertyExpenses = (expenses || []).filter(e => e.property_id === property.id);
        const propertyBookings = (bookings || []).filter(b => b.property_id === property.id);
        
        const visitTotal = propertyVisits.reduce((sum, v) => sum + Number(v.price), 0);
        const expenseTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const ownerrezRevenue = propertyBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        const managementFees = propertyBookings.reduce((sum, b) => sum + Number(b.management_fee), 0);

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
          ownerrezRevenue,
          managementFees,
          netBalance: visitTotal + managementFees - expenseTotal,
        };
      });

      // Store visits grouped by property
      const visitsGrouped = (visits || []).reduce((acc, visit) => {
        if (!acc[visit.property_id]) acc[visit.property_id] = [];
        acc[visit.property_id].push({
          id: visit.id,
          propertyId: visit.property_id,
          date: visit.date,
          time: visit.time,
          price: Number(visit.price),
          notes: visit.notes,
          createdAt: visit.created_at,
        });
        return acc;
      }, {} as Record<string, Visit[]>);

      setAllVisits(visitsGrouped);
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

  const syncOwnerRez = async () => {
    try {
      setSyncing(true);
      toast.loading("Syncing OwnerRez data...");
      
      const { data, error } = await supabase.functions.invoke("sync-ownerrez");
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Synced ${data.listings?.length || 0} properties from OwnerRez`);
      
      // Reload data to show updated bookings
      await loadData();
    } catch (error: any) {
      console.error("OwnerRez sync error:", error);
      toast.dismiss();
      toast.error("Failed to sync OwnerRez data");
    } finally {
      setSyncing(false);
    }
  };

  const totalVisits = summaries.reduce((sum, s) => sum + s.visitCount, 0);
  const totalRevenue = summaries.reduce((sum, s) => sum + s.visitTotal, 0);
  const totalExpenses = summaries.reduce((sum, s) => sum + s.expenseTotal, 0);
  
  // Calculate OwnerRez totals directly from bookings since they may not be linked to properties
  const totalOwnerRezRevenue = ownerrezBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalManagementFees = ownerrezBookings.reduce((sum, b) => sum + b.managementFee, 0);

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
            onClick={syncOwnerRez}
            disabled={syncing}
            className="shadow-warm hover:scale-105 transition-transform gap-2"
            variant="outline"
          >
            {syncing ? "Syncing..." : "Sync OwnerRez"}
          </Button>
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

        <Card className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OwnerRez Revenue</CardTitle>
            <div className="p-2.5 bg-blue-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-500">
              ${totalOwnerRezRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">From booking platforms</p>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Management Fees</CardTitle>
            <div className="p-2.5 bg-purple-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-500">
              ${totalManagementFees.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">From OwnerRez bookings</p>
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
              {summaries.map((summary, index) => {
                const visits = allVisits[summary.property.id] || [];
                return (
                  <div 
                    key={summary.property.id} 
                    onClick={() => handlePropertyClick(summary)}
                    className="group p-6 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0 flex-shrink">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {summary.property.name}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            {summary.property.address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Visit Rate: <span className="font-semibold text-foreground">${summary.property.visitPrice.toFixed(2)}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-4 sm:gap-6 justify-start sm:justify-end">
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Visits</p>
                            <p className="font-bold text-lg">{summary.visitCount}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Visit Rev</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-500">
                              ${summary.visitTotal.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">OwnerRez</p>
                            <p className="font-bold text-lg text-blue-600 dark:text-blue-500">
                              ${summary.ownerrezRevenue.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Mgmt Fees</p>
                            <p className="font-bold text-lg text-purple-600 dark:text-purple-500">
                              ${summary.managementFees.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Expenses</p>
                            <p className="font-bold text-lg text-red-600 dark:text-red-500">
                              ${summary.expenseTotal.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Visits List */}
                      {visits.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Recent Visits
                          </h4>
                          <div className="space-y-2">
                            {visits.slice(0, 5).map((visit) => (
                              <div key={visit.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground">
                                    {new Date(visit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-muted-foreground text-xs">{visit.time}</span>
                                  {visit.notes && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {visit.notes}
                                    </span>
                                  )}
                                </div>
                                <span className="font-semibold text-green-600 dark:text-green-500">
                                  ${visit.price.toFixed(2)}
                                </span>
                              </div>
                            ))}
                            {visits.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center pt-1">
                                +{visits.length - 5} more visits (click to view all)
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
