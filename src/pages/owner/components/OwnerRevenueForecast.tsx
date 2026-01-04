import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, DollarSign, ArrowRight } from "lucide-react";
import { addDays, differenceInDays, isAfter, isBefore, format } from "date-fns";

interface Booking {
  id: string;
  checkIn: Date;
  checkOut: Date;
  amount: number;
  type: "short_term" | "mid_term";
  guestName: string;
  status: string;
}

interface OwnerRevenueForecastProps {
  bookings: {
    str: Array<{
      id: string;
      guest_name: string | null;
      check_in: string | null;
      check_out: string | null;
      total_amount: number;
      booking_status: string | null;
    }>;
    mtr: Array<{
      id: string;
      tenant_name: string;
      start_date: string;
      end_date: string;
      monthly_rent: number;
      status: string;
    }>;
  } | null;
  propertyName?: string;
}

export function OwnerRevenueForecast({ bookings, propertyName }: OwnerRevenueForecastProps) {
  const forecast = useMemo(() => {
    if (!bookings) return null;

    const now = new Date();
    const next30 = addDays(now, 30);
    const next60 = addDays(now, 60);
    const next90 = addDays(now, 90);

    let revenue30 = 0;
    let revenue60 = 0;
    let revenue90 = 0;
    let bookings30 = 0;
    let bookings60 = 0;
    let bookings90 = 0;

    const upcomingBookings: Booking[] = [];

    // Process STR bookings
    bookings.str.forEach(b => {
      if (!b.check_in || !b.check_out) return;
      const status = (b.booking_status || "").toLowerCase();
      if (status === "canceled" || status === "cancelled") return;
      if (b.total_amount <= 0) return; // Skip owner blocks

      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out);

      // Only include future bookings
      if (isBefore(checkOut, now)) return;

      upcomingBookings.push({
        id: b.id,
        checkIn,
        checkOut,
        amount: b.total_amount,
        type: "short_term",
        guestName: b.guest_name || "Guest",
        status: b.booking_status || "confirmed",
      });

      // Count for each period
      if (isAfter(checkIn, now) && isBefore(checkIn, next30)) {
        revenue30 += b.total_amount;
        bookings30++;
      }
      if (isAfter(checkIn, now) && isBefore(checkIn, next60)) {
        revenue60 += b.total_amount;
        bookings60++;
      }
      if (isAfter(checkIn, now) && isBefore(checkIn, next90)) {
        revenue90 += b.total_amount;
        bookings90++;
      }
    });

    // Process MTR bookings
    bookings.mtr.forEach(b => {
      if (!b.start_date || !b.end_date) return;
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);

      // Only include active/upcoming bookings
      if (isBefore(endDate, now)) return;

      upcomingBookings.push({
        id: b.id,
        checkIn: startDate,
        checkOut: endDate,
        amount: b.monthly_rent,
        type: "mid_term",
        guestName: b.tenant_name,
        status: b.status,
      });

      // Calculate prorated revenue for each period
      const calculateMTRRevenue = (periodEnd: Date) => {
        const effectiveStart = isBefore(startDate, now) ? now : startDate;
        const effectiveEnd = isBefore(endDate, periodEnd) ? endDate : periodEnd;
        
        if (isBefore(effectiveEnd, effectiveStart)) return 0;
        
        const days = differenceInDays(effectiveEnd, effectiveStart);
        const dailyRate = b.monthly_rent / 30;
        return days * dailyRate;
      };

      revenue30 += calculateMTRRevenue(next30);
      revenue60 += calculateMTRRevenue(next60);
      revenue90 += calculateMTRRevenue(next90);

      if (isAfter(startDate, now) && isBefore(startDate, next30)) bookings30++;
      if (isAfter(startDate, now) && isBefore(startDate, next60)) bookings60++;
      if (isAfter(startDate, now) && isBefore(startDate, next90)) bookings90++;
    });

    // Sort upcoming bookings by check-in date
    upcomingBookings.sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());

    return {
      revenue30: Math.round(revenue30),
      revenue60: Math.round(revenue60),
      revenue90: Math.round(revenue90),
      bookings30,
      bookings60,
      bookings90,
      upcomingBookings: upcomingBookings.slice(0, 5), // Show next 5 bookings
    };
  }, [bookings]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!forecast || (forecast.revenue90 === 0 && forecast.upcomingBookings.length === 0)) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Revenue Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Forecast Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-background/80 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Next 30 Days</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(forecast.revenue30)}</p>
            <p className="text-xs text-muted-foreground mt-1">{forecast.bookings30} booking{forecast.bookings30 !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-background/80 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Next 60 Days</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(forecast.revenue60)}</p>
            <p className="text-xs text-muted-foreground mt-1">{forecast.bookings60} booking{forecast.bookings60 !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-background/80 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Next 90 Days</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(forecast.revenue90)}</p>
            <p className="text-xs text-muted-foreground mt-1">{forecast.bookings90} booking{forecast.bookings90 !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Upcoming Bookings */}
        {forecast.upcomingBookings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Reservations</h4>
            <div className="space-y-2">
              {forecast.upcomingBookings.map((booking) => (
                <div
                  key={`${booking.type}-${booking.id}`}
                  className="flex items-center justify-between p-3 bg-background/60 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      booking.type === "short_term" 
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" 
                        : "bg-purple-100 text-purple-600 dark:bg-purple-900/30"
                    }`}>
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{booking.guestName}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{format(booking.checkIn, "MMM d")}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{format(booking.checkOut, "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {booking.type === "mid_term" ? "/mo " : ""}{formatCurrency(booking.amount)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
