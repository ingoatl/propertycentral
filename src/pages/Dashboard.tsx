import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PropertySummary, Visit, Expense, OwnerRezBooking } from "@/types";
import { toast } from "sonner";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { UserTasksDashboard } from "@/components/dashboard/UserTasksDashboard";
import { DashboardFAQTab } from "@/components/dashboard/DashboardFAQTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const Dashboard = () => {
  const [summaries, setSummaries] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { isAdmin, loading: adminLoading } = useAdminCheck();

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

      const { data: bookings, error: bookingsError} = await supabase
        .from("ownerrez_bookings")
        .select("*");

      if (bookingsError) throw bookingsError;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const managedPropertiesInfo: Record<string, { address: string; managementFee: number }> = {
        'boho lux': { address: '14 Villa Ct SE #14, Smyrna, GA 30080', managementFee: 0.20 },
        'boho lux theme': { address: '14 Villa Ct SE #14, Smyrna, GA 30080', managementFee: 0.20 },
        '14 villa': { address: '14 Villa Ct SE #14, Smyrna, GA 30080', managementFee: 0.20 },
        'house of blues': { address: '15 Villa Ct SE #15, Smyrna, GA 30080', managementFee: 0.20 },
        'house of blues theme': { address: '15 Villa Ct SE #15, Smyrna, GA 30080', managementFee: 0.20 },
        'blues & boho haven': { address: '14 & 15 Villa Ct SE, Smyrna, GA 30080', managementFee: 0.20 },
        'the blues & boho haven': { address: '14 & 15 Villa Ct SE, Smyrna, GA 30080', managementFee: 0.20 },
        '15 villa': { address: '15 Villa Ct SE #15, Smyrna, GA 30080', managementFee: 0.20 },
        'mableton meadows': { address: '184 Woodland Ln, Mableton, GA 30126', managementFee: 0.25 },
        'woodland': { address: '184 Woodland Ln, Mableton, GA 30126', managementFee: 0.25 },
        'smoke hollow': { address: '3419 Smoke Hollow Pl, Roswell, GA 30075', managementFee: 0.18 },
        'smoke hollow retreat': { address: '3419 Smoke Hollow Pl, Roswell, GA 30075', managementFee: 0.18 },
        '3419': { address: '3419 Smoke Hollow Pl, Roswell, GA 30075', managementFee: 0.18 },
        'canadian way': { address: '3708 Canadian Way, Tucker, GA 30084', managementFee: 0.20 },
        'canadian way haven': { address: '3708 Canadian Way, Tucker, GA 30084', managementFee: 0.20 },
        '3708': { address: '3708 Canadian Way, Tucker, GA 30084', managementFee: 0.20 },
        'muirfield': { address: 'Muirfield Address', managementFee: 0.20 },
        'timberlake': { address: 'Timberlake Address', managementFee: 0.20 },
      };

      const unmanagedAddresses: Record<string, string> = {
        'family retreat': '5360 Durham Ridge Ct, Lilburn, GA 30047',
        'lavish living': '3069 Rita Way, Smyrna, GA 30080',
        'luxurious & spacious apartment': '2580 Old Roswell Rd, Roswell, GA 30076',
        'modern + cozy townhome': '169 Willow Stream Ct, Woodstock, GA 30188',
        'scandi chic': '3155 Duvall Pl, Kennesaw, GA 30144',
        'scandinavian retreat': '5198 Laurel Bridge Dr, Smyrna, GA 30082',
        'alpine': '4241 Osburn Ct, Duluth, GA 30096',
      };

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

      const getPropertyAddress = (name: string, currentAddress: string): string => {
        const lowerName = name.toLowerCase();
        
        for (const [key, info] of Object.entries(managedPropertiesInfo)) {
          if (lowerName.includes(key)) {
            return info.address;
          }
        }
        
        for (const [key, address] of Object.entries(unmanagedAddresses)) {
          if (lowerName.includes(key)) {
            return address;
          }
        }
        
        return currentAddress || 'Address not available';
      };

      const summaryData = (properties || []).map(property => {
        const propertyVisits = (visits || []).filter(v => v.property_id === property.id);
        const propertyExpenses = (expenses || []).filter(e => e.property_id === property.id);
        const propertyBookings = (bookings || []).filter(b => b.property_id === property.id);
        
        const visitTotal = propertyVisits.reduce((sum, v) => sum + Number(v.price), 0);
        const expenseTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const ownerrezRevenue = propertyBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        const managementFees = propertyBookings.reduce((sum, b) => sum + Number(b.management_fee), 0);

        const isManaged = isPropertyManaged(property.name, property.address);
        
        const thisMonthBookings = propertyBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= thisMonthStart;
        });
        const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        const lastMonthBookings = propertyBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= lastMonthStart && checkIn <= lastMonthEnd;
        });
        const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        const totalNights = propertyBookings.reduce((sum, b) => {
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

      const localPropertyIds = (properties || []).map(p => p.id);
      const unmappedBookings = (bookings || []).filter(b => !b.property_id || !localPropertyIds.includes(b.property_id));
      
      const bookingsByListing = unmappedBookings.reduce((acc, booking) => {
        const key = booking.ownerrez_listing_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(booking);
        return acc;
      }, {} as Record<string, typeof bookings>);

      const virtualSummaries = Object.entries(bookingsByListing).map(([listingId, listingBookings]) => {
        const ownerrezRevenue = listingBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        const managementFees = listingBookings.reduce((sum, b) => sum + Number(b.management_fee), 0);
        const propertyName = listingBookings[0].ownerrez_listing_name;
        
        const isManaged = isPropertyManaged(propertyName, '');
        const propertyAddress = getPropertyAddress(propertyName, '');
        
        const thisMonthBookings = listingBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= thisMonthStart;
        });
        const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
        const lastMonthBookings = listingBookings.filter(b => {
          if (!b.check_in) return false;
          const checkIn = new Date(b.check_in);
          return checkIn >= lastMonthStart && checkIn <= lastMonthEnd;
        });
        const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        
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

      const allSummaries = [...summaryData, ...virtualSummaries].sort((a, b) => {
        if (a.isManaged === b.isManaged) return 0;
        return a.isManaged ? -1 : 1;
      });

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

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);

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
      toast.success(`Emails sent successfully to ${data.emailsSent || 0} recipients`);
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast.dismiss();
      toast.error("Failed to send overdue task emails");
    }
  };

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  // Admin gets the unified dashboard
  if (isAdmin) {
    return (
      <AdminDashboard
        summaries={summaries}
        onExport={exportToCSV}
        onSync={syncOwnerRez}
        syncing={syncing}
        onSendOverdueEmails={sendOverdueTaskEmails}
      />
    );
  }

  // Non-admin users get simplified view
  return (
    <div className="p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList>
              <TabsTrigger value="tasks">My Tasks</TabsTrigger>
              <TabsTrigger value="faqs">FAQs</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <UserTasksDashboard />
            </TabsContent>

            <TabsContent value="faqs">
              <DashboardFAQTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
