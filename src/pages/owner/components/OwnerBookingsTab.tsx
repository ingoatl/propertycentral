import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Users,
  DollarSign,
  Clock,
  Home,
  Building2,
  CalendarDays,
} from "lucide-react";
import { format, differenceInDays, isAfter, isBefore, addDays } from "date-fns";
import { BookingCalendarView } from "./BookingCalendarView";

interface OwnerrezBooking {
  id: string;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  total_amount: number;
  booking_status: string | null;
}

interface MidTermBooking {
  id: string;
  tenant_name: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
}

interface OwnerBookingsTabProps {
  propertyId: string;
  bookings?: {
    str: OwnerrezBooking[];
    mtr: MidTermBooking[];
  };
}

type CombinedBooking = {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  amount: number;
  status: string;
  type: "short_term" | "mid_term";
  nights: number;
};

export function OwnerBookingsTab({ propertyId, bookings }: OwnerBookingsTabProps) {
  const [activeTab, setActiveTab] = useState("all");

  const ownerrezBookings = bookings?.str || [];
  const midTermBookings = bookings?.mtr || [];

  // Combine and normalize bookings - filter out canceled and owner blocks
  const allBookings = useMemo<CombinedBooking[]>(() => {
    const combined: CombinedBooking[] = [];

    ownerrezBookings.forEach((b) => {
      if (b.check_in && b.check_out) {
        // Skip canceled bookings and owner blocks (zero amount)
        const status = (b.booking_status || "confirmed").toLowerCase();
        if (status === "canceled" || status === "cancelled") return;
        
        const checkIn = new Date(b.check_in);
        const checkOut = new Date(b.check_out);
        combined.push({
          id: b.id,
          guestName: b.guest_name || "Guest",
          checkIn,
          checkOut,
          amount: b.total_amount,
          status: b.booking_status || "confirmed",
          type: "short_term",
          nights: differenceInDays(checkOut, checkIn),
        });
      }
    });

    midTermBookings.forEach((b) => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      combined.push({
        id: b.id,
        guestName: b.tenant_name,
        checkIn: startDate,
        checkOut: endDate,
        amount: b.monthly_rent,
        status: b.status,
        type: "mid_term",
        nights: differenceInDays(endDate, startDate),
      });
    });

    return combined.sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
  }, [ownerrezBookings, midTermBookings]);

  // Filter bookings based on tab
  const filteredBookings = useMemo(() => {
    if (activeTab === "all") return allBookings;
    if (activeTab === "short_term") return allBookings.filter(b => b.type === "short_term");
    if (activeTab === "mid_term") return allBookings.filter(b => b.type === "mid_term");
    return allBookings;
  }, [allBookings, activeTab]);

  // Calculate stats - exclude zero-amount bookings from revenue
  const stats = useMemo(() => {
    const now = new Date();
    const next30Days = addDays(now, 30);
    
    const upcoming = allBookings.filter(b => 
      isAfter(b.checkIn, now) && isBefore(b.checkIn, next30Days)
    );
    
    // Only count revenue from paid bookings
    const paidBookings = allBookings.filter(b => b.amount > 0);
    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.amount, 0);
    const totalNights = paidBookings.reduce((sum, b) => sum + b.nights, 0);
    const avgNightly = totalNights > 0 ? totalRevenue / totalNights : 0;

    return {
      totalBookings: allBookings.length,
      upcomingCount: upcoming.length,
      totalRevenue,
      avgNightly,
      totalNights,
      shortTermCount: allBookings.filter(b => b.type === "short_term").length,
      midTermCount: allBookings.filter(b => b.type === "mid_term").length,
    };
  }, [allBookings]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "cancelled":
      case "completed":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  if (!bookings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Calendar className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Bookings</p>
                <p className="text-3xl font-bold tracking-tight">{stats.totalBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Upcoming (30d)</p>
                <p className="text-3xl font-bold tracking-tight">{stats.upcomingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Nights</p>
                <p className="text-3xl font-bold tracking-tight">{stats.totalNights}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <BookingCalendarView bookings={allBookings} />

      {/* Bookings List */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-background border-b pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Booking History
            </CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="text-xs">
                  All ({allBookings.length})
                </TabsTrigger>
                <TabsTrigger value="short_term" className="text-xs">
                  <Home className="h-3 w-3 mr-1" />
                  STR ({stats.shortTermCount})
                </TabsTrigger>
                <TabsTrigger value="mid_term" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  MTR ({stats.midTermCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No bookings found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredBookings.map((booking) => (
                <div
                  key={`${booking.type}-${booking.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      booking.type === "short_term" 
                        ? "bg-blue-100 text-blue-600" 
                        : "bg-purple-100 text-purple-600"
                    }`}>
                      {booking.type === "short_term" ? (
                        <Home className="h-5 w-5" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{booking.guestName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{format(booking.checkIn, "MMM d")} - {format(booking.checkOut, "MMM d, yyyy")}</span>
                        <span>•</span>
                        <span>{booking.nights} nights</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      {booking.type === "mid_term" ? "/mo" : ""}
                      {formatCurrency(booking.amount)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}