import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Building2, Calendar, DollarSign, MapPin, Activity, MessageCircleQuestion, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary, Visit, Expense, OwnerRezBooking } from "@/types";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailInsightsCard } from "@/components/EmailInsightsCard";
import { DashboardFAQTab } from "@/components/dashboard/DashboardFAQTab";
import { UserTasksDashboard } from "@/components/dashboard/UserTasksDashboard";
import { PendingQuestionsCard } from "@/components/admin/PendingQuestionsCard";
import { useAdminCheck } from "@/hooks/useAdminCheck";

const Dashboard = () => {
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<PropertySummary | null>(null);
  const [propertyVisits, setPropertyVisits] = useState<Visit[]>([]);
  const [propertyExpenses, setPropertyExpenses] = useState<Expense[]>([]);
  const [allVisits, setAllVisits] = useState<Record<string, Visit[]>>({});
  const [ownerrezBookings, setOwnerrezBookings] = useState<OwnerRezBooking[]>([]);
  const [syncing, setSyncing] = useState(false);
  const { isAdmin } = useAdminCheck();

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

      
      // Define managed properties with their addresses and management fees
      const managedPropertiesInfo: Record<string, { address: string; managementFee: number }> = {
        // Boho Lux Theme
        'boho lux': { address: '14 Villa Ct SE #14, Smyrna, GA 30080', managementFee: 0.20 },
        'boho lux theme': { address: '14 Villa Ct SE #14, Smyrna, GA 30080', managementFee: 0.20 },
        '14 villa': { address: '14 Villa Ct SE #14, Smyrna, GA 30080', managementFee: 0.20 },
        
        // House of Blues Theme
        'house of blues': { address: '15 Villa Ct SE #15, Smyrna, GA 30080', managementFee: 0.20 },
        'house of blues theme': { address: '15 Villa Ct SE #15, Smyrna, GA 30080', managementFee: 0.20 },
        
        // The Blues & Boho Haven (combined 14 & 15)
        'blues & boho haven': { address: '14 & 15 Villa Ct SE, Smyrna, GA 30080', managementFee: 0.20 },
        'the blues & boho haven': { address: '14 & 15 Villa Ct SE, Smyrna, GA 30080', managementFee: 0.20 },
        '15 villa': { address: '15 Villa Ct SE #15, Smyrna, GA 30080', managementFee: 0.20 },
        
        // Mableton Meadows
        'mableton meadows': { address: '184 Woodland Ln, Mableton, GA 30126', managementFee: 0.25 },
        'woodland': { address: '184 Woodland Ln, Mableton, GA 30126', managementFee: 0.25 },
        
        // Smoke Hollow Retreat
        'smoke hollow': { address: '3419 Smoke Hollow Pl, Roswell, GA 30075', managementFee: 0.18 },
        'smoke hollow retreat': { address: '3419 Smoke Hollow Pl, Roswell, GA 30075', managementFee: 0.18 },
        '3419': { address: '3419 Smoke Hollow Pl, Roswell, GA 30075', managementFee: 0.18 },
        
        // Canadian Way Haven
        'canadian way': { address: '3708 Canadian Way, Tucker, GA 30084', managementFee: 0.20 },
        'canadian way haven': { address: '3708 Canadian Way, Tucker, GA 30084', managementFee: 0.20 },
        '3708': { address: '3708 Canadian Way, Tucker, GA 30084', managementFee: 0.20 },
      };

      // Known unmanaged property addresses
      const unmanagedAddresses: Record<string, string> = {
        'family retreat': '5360 Durham Ridge Ct, Lilburn, GA 30047',
        'lavish living': '3069 Rita Way, Smyrna, GA 30080',
        'luxurious & spacious apartment': '2580 Old Roswell Rd, Roswell, GA 30076',
        'modern + cozy townhome': '169 Willow Stream Ct, Woodstock, GA 30188',
        'scandi chic': '3155 Duvall Pl, Kennesaw, GA 30144',
        'scandinavian retreat': '5198 Laurel Bridge Dr, Smyrna, GA 30082',
        'alpine': '4241 Osburn Ct, Duluth, GA 30096',
      };

      // Helper to check if a property is managed
      const isPropertyManaged = (name: string, address: string): boolean => {
        const lowerName = name.toLowerCase();
        const lowerAddress = address?.toLowerCase() || '';
        
        for (const key of Object.keys(managedPropertiesInfo)) {
          if (lowerName.includes(key) || lowerAddress.includes(key)) {
            return true;
          }
        }
        return false;
      };

      // Helper to get proper address for a property
      const getPropertyAddress = (name: string, currentAddress: string): string => {
        const lowerName = name.toLowerCase();
        
        // Check managed properties
        for (const [key, info] of Object.entries(managedPropertiesInfo)) {
          if (lowerName.includes(key)) {
            return info.address;
          }
        }
        
        // Check unmanaged properties
        for (const [key, address] of Object.entries(unmanagedAddresses)) {
          if (lowerName.includes(key)) {
            return address;
          }
        }
        
        return currentAddress || 'Address not available';
      };

      // Calculate date ranges for metrics
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Create summaries for local properties
      const summaryData = (properties || []).map(property => {
        const propertyVisits = (visits || []).filter(v => v.property_id === property.id);
        const propertyExpenses = (expenses || []).filter(e => e.property_id === property.id);
        const propertyBookings = (bookings || []).filter(b => b.property_id === property.id);
        
        const visitTotal = propertyVisits.reduce((sum, v) => sum + Number(v.price), 0);
        const expenseTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const ownerrezRevenue = propertyBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        const managementFees = propertyBookings.reduce((sum, b) => sum + Number(b.management_fee), 0);

        // Check if property is managed using our mapping
        const isManaged = isPropertyManaged(property.name, property.address);
        
        // Calculate this month's revenue
        const thisMonthBookings = propertyBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= thisMonthStart;
        });
        const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        // Calculate last month's revenue
        const lastMonthBookings = propertyBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= lastMonthStart && checkIn <= lastMonthEnd;
        });
        const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        // Calculate total nights booked
        const totalNights = propertyBookings.reduce((sum, b) => {
          if (!b.check_in || !b.check_out) return sum;
          const checkIn = new Date(b.check_in);
          const checkOut = new Date(b.check_out);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          return sum + nights;
        }, 0);
        
        // Calculate RevPAR (Revenue Per Available Room/Night)
        // Assuming 365 days available per year for simplicity
        const daysInPeriod = 365;
        const revPAR = ownerrezRevenue / daysInPeriod;
        
        // Calculate occupancy rate (total nights booked / days in period)
        const occupancyRate = (totalNights / daysInPeriod) * 100;

        return {
          property: {
            id: property.id,
            name: property.name,
            address: getPropertyAddress(property.name, property.address),
            visitPrice: Number(property.visit_price),
            createdAt: property.created_at,
          },
          visitCount: propertyVisits.length,
          visitTotal,
          expenseTotal,
          ownerrezRevenue,
          managementFees,
          netBalance: visitTotal + managementFees - expenseTotal,
          isManaged,
          bookingCount: propertyBookings.length,
          thisMonthRevenue,
          lastMonthRevenue,
          revPAR,
          occupancyRate,
        };
      });

      // Add virtual properties for OwnerRez bookings without local properties
      const localPropertyIds = (properties || []).map(p => p.id);
      const unmappedBookings = (bookings || []).filter(b => !b.property_id || !localPropertyIds.includes(b.property_id));
      
      // Group unmapped bookings by ownerrez_listing_id
      const bookingsByListing = unmappedBookings.reduce((acc, booking) => {
        const key = booking.ownerrez_listing_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(booking);
        return acc;
      }, {} as Record<string, typeof bookings>);

      // Create virtual property summaries for unmapped listings
      const virtualSummaries = Object.entries(bookingsByListing).map(([listingId, listingBookings]) => {
        const ownerrezRevenue = listingBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        const managementFees = listingBookings.reduce((sum, b) => sum + Number(b.management_fee), 0);
        const propertyName = listingBookings[0].ownerrez_listing_name;
        
        // Check if property is managed using our mapping
        const isManaged = isPropertyManaged(propertyName, '');
        
        // Get proper address for this property
        const propertyAddress = getPropertyAddress(propertyName, '');
        
        // Calculate this month's revenue
        const thisMonthBookings = listingBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= thisMonthStart;
        });
        const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        // Calculate last month's revenue
        const lastMonthBookings = listingBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= lastMonthStart && checkIn <= lastMonthEnd;
        });
        const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        // Calculate total nights booked
        const totalNights = listingBookings.reduce((sum, b) => {
          if (!b.check_in || !b.check_out) return sum;
          const checkIn = new Date(b.check_in);
          const checkOut = new Date(b.check_out);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          return sum + nights;
        }, 0);
        
        const daysInPeriod = 365;
        const revPAR = ownerrezRevenue / daysInPeriod;
        const occupancyRate = (totalNights / daysInPeriod) * 100;

        return {
          property: {
            id: `ownerrez-${listingId}`,
            name: propertyName,
            address: propertyAddress,
            visitPrice: 0,
            createdAt: listingBookings[0].created_at,
          },
          visitCount: 0,
          visitTotal: 0,
          expenseTotal: 0,
          ownerrezRevenue,
          managementFees,
          netBalance: managementFees,
          isManaged,
          bookingCount: listingBookings.length,
          thisMonthRevenue,
          lastMonthRevenue,
          revPAR,
          occupancyRate,
        };
      });

      // Combine and sort: managed properties first, then unmanaged
      const allSummaries = [...summaryData, ...virtualSummaries].sort((a, b) => {
        if (a.isManaged === b.isManaged) return 0;
        return a.isManaged ? -1 : 1;
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
      setSummaries(allSummaries);
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
      toast.success(`Synced ${data.properties || 0} properties: ${data.summary?.totalBookings || 0} bookings, $${data.summary?.totalRevenue || 0} revenue, $${data.summary?.totalManagementFees || 0} management fees`);
      
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

  const sendOverdueTaskEmails = async () => {
    try {
      toast.loading("Sending overdue task emails...");
      
      const { data, error } = await supabase.functions.invoke("send-overdue-task-emails");
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Sent ${data.emailsSent || 0} email(s) for ${data.overdueTasksFound || 0} overdue task(s)`);
    } catch (error: any) {
      console.error("Send emails error:", error);
      toast.dismiss();
      toast.error("Failed to send overdue task emails");
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
          {isAdmin && (
            <>
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
                    toast.loading("Sending overdue task emails...");
                    const { data, error } = await supabase.functions.invoke("send-overdue-task-emails");
                    toast.dismiss();
                    if (error) {
                      console.error("Email error:", error);
                      toast.error("Failed to send overdue task emails");
                    } else {
                      toast.success(`Sent ${data.emailsSent} overdue task email(s) for ${data.overdueTasksFound} task(s)`);
                    }
                  } catch (error) {
                    console.error("Error:", error);
                    toast.dismiss();
                    toast.error("Failed to send emails");
                  }
                }} 
                className="shadow-warm hover:scale-105 transition-transform gap-2"
                variant="outline"
              >
                Send Overdue Emails
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
            </>
          )}
          <Button onClick={exportToCSV} className="shadow-warm hover:scale-105 transition-transform gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue={isAdmin ? "overview" : "tasks"} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {isAdmin && (
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
          )}
          <TabsTrigger value="tasks" className="gap-2">
            <Calendar className="h-4 w-4" />
            My Tasks
          </TabsTrigger>
          <TabsTrigger value="faqs" className="gap-2">
            <MessageCircleQuestion className="h-4 w-4" />
            FAQs
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="overview" className="space-y-8 mt-6">
          {/* Pending Questions */}
          <PendingQuestionsCard />
          
          {/* Email Insights Card */}
          <EmailInsightsCard showHeader={true} />

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


      {/* Managed Properties */}
      <Card className="shadow-card border-border/50 border-l-4 border-l-green-500">
        <CardHeader className="bg-green-50 dark:bg-green-950/30 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-xl">
            <span className="text-2xl">✅</span>
            <span className="font-bold">UNDER MANAGEMENT</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{summaries.filter(s => s.isManaged).length} properties actively managed by PeachHaus</p>
        </CardHeader>
        <CardContent className="pt-6">
          {summaries.filter(s => s.isManaged).length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No managed properties yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.filter(s => s.isManaged).map((summary, index) => {
                const visits = allVisits[summary.property.id] || [];
                return (
                   <div 
                    key={summary.property.id} 
                    onClick={() => handlePropertyClick(summary)}
                    className="group p-5 border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/20 rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Property Header */}
                    <div className="mb-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl group-hover:text-primary transition-colors mb-1">
                            {summary.property.name}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            {summary.property.address}
                          </p>
                        </div>
                        <div className="flex-shrink-0 px-4 py-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-0.5 text-center">Mgmt Fee</p>
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 text-center">
                            {summary.ownerrezRevenue > 0 ? `${((summary.managementFees / summary.ownerrezRevenue) * 100).toFixed(0)}%` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics - Simplified */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Revenue</p>
                        <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                          ${summary.ownerrezRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Mgmt Fees</p>
                        <p className="font-bold text-lg text-purple-600 dark:text-purple-400">
                          ${summary.managementFees.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">This Month</p>
                        <p className="font-bold text-lg text-green-600 dark:text-green-400">
                          ${summary.thisMonthRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Last Month</p>
                        <p className="font-bold text-lg">
                          ${summary.lastMonthRevenue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Bookings</p>
                        <p className="font-semibold">{summary.bookingCount}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">RevPAR</p>
                        <p className="font-semibold">${summary.revPAR.toFixed(0)}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Occupancy</p>
                        <p className="font-semibold">{summary.occupancyRate.toFixed(0)}%</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Visits</p>
                        <p className="font-semibold">{summary.visitCount}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Visit Rev</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">${summary.visitTotal.toFixed(0)}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Expenses</p>
                        <p className="font-semibold text-red-600 dark:text-red-400">${summary.expenseTotal.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unmanaged Properties */}
      {summaries.filter(s => !s.isManaged).length > 0 && (
        <Card className="shadow-card border-border/50 border-l-4 border-l-orange-500">
          <CardHeader className="bg-orange-50 dark:bg-orange-950/30 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <span className="text-2xl">❌</span>
              <span className="font-bold">UNMANAGED PROPERTIES</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{summaries.filter(s => !s.isManaged).length} properties without active management</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {summaries.filter(s => !s.isManaged).map((summary, index) => {
                const visits = allVisits[summary.property.id] || [];
                return (
                  <div 
                    key={summary.property.id} 
                    onClick={() => handlePropertyClick(summary)}
                    className="group p-5 border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/30 to-transparent dark:from-orange-950/10 rounded-lg hover:shadow-lg transition-all duration-300 hover:scale-[1.01] cursor-pointer opacity-90"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* Property Header */}
                    <div className="mb-4">
                      <h3 className="font-bold text-xl group-hover:text-primary transition-colors mb-1">
                        {summary.property.name}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        {summary.property.address}
                      </p>
                    </div>

                    {/* Key Metrics - No Management Fee */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Revenue</p>
                        <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                          ${summary.ownerrezRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">This Month</p>
                        <p className="font-bold text-lg text-green-600 dark:text-green-400">
                          ${summary.thisMonthRevenue.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg border border-border/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Last Month</p>
                        <p className="font-bold text-lg">
                          ${summary.lastMonthRevenue.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-center">
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Bookings</p>
                        <p className="font-semibold">{summary.bookingCount}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">RevPAR</p>
                        <p className="font-semibold">${summary.revPAR.toFixed(0)}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Occupancy</p>
                        <p className="font-semibold">{summary.occupancyRate.toFixed(0)}%</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Visits</p>
                        <p className="font-semibold">{summary.visitCount}</p>
                      </div>
                      <div className="bg-muted/50 p-2 rounded">
                        <p className="text-xs text-muted-foreground">Expenses</p>
                        <p className="font-semibold text-red-600 dark:text-red-400">${summary.expenseTotal.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}


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
          </TabsContent>
        )}

        <TabsContent value="tasks" className="mt-6">
          <UserTasksDashboard />
        </TabsContent>

        <TabsContent value="faqs" className="mt-6">
          <DashboardFAQTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
