import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users,
  Star,
  Percent,
  Building2,
  Info,
  ChevronRight,
  CalendarDays,
  Home,
  Clock,
  ArrowRight,
  Gauge,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

interface PerformanceMetrics {
  totalRevenue: number;
  strRevenue: number;
  mtrRevenue: number;
  totalBookings: number;
  strBookings: number;
  mtrBookings: number;
  occupancyRate: number;
  averageRating: number | null;
  reviewCount: number;
  rentalType?: string; // "hybrid" | "mid_term" | "long_term"
}

interface MtrBreakdownItem {
  month: string;
  tenant: string;
  amount: number;
  source: string;
  days?: number;
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
}

interface StrBreakdownItem {
  guest: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  source: string;
  nights?: number;
}

interface RevenueBreakdown {
  mtr: MtrBreakdownItem[];
  str: StrBreakdownItem[];
  summary: {
    mtrFromStatements: number;
    mtrFromFutureBookings: number;
    strFromReconciliation: number;
    strFromBookings: number;
  };
}

interface PeachHausData {
  listingHealth?: { score: number; status: string; summary?: string };
  pricingIntelligence?: { 
    current_base_rate: number; 
    recommended_rate: number; 
    mpi_7_day?: number;
  };
  syncedAt?: string;
}

interface OwnerPerformanceOverviewProps {
  metrics: PerformanceMetrics;
  propertyName?: string;
  revenueBreakdown?: RevenueBreakdown;
  rentalType?: string;
  peachHausData?: PeachHausData | null;
}

export function OwnerPerformanceOverview({ metrics, propertyName, revenueBreakdown, rentalType, peachHausData }: OwnerPerformanceOverviewProps) {
  const [showTotalRevenueModal, setShowTotalRevenueModal] = useState(false);
  const [showOccupancyModal, setShowOccupancyModal] = useState(false);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showMtrModal, setShowMtrModal] = useState(false);
  const [showStrModal, setShowStrModal] = useState(false);

  // Determine if property is mid-term only (no STR section needed)
  const effectiveRentalType = rentalType || metrics.rentalType;
  const isMidTermOnly = effectiveRentalType === 'mid_term' || effectiveRentalType === 'long_term';
  const isHybrid = effectiveRentalType === 'hybrid' || !effectiveRentalType;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDetailed = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatMonth = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM yyyy');
    } catch {
      return monthStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Revenue Card */}
        <Card 
          className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowTotalRevenueModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {formatCurrency(metrics.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  All-time earnings
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Card */}
        <Card 
          className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowOccupancyModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Occupancy Rate</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {metrics.occupancyRate}%
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  This year
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Card */}
        <Card 
          className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowBookingsModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Bookings</p>
                <p className="text-3xl font-bold tracking-tight mt-1">
                  {metrics.totalBookings}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {metrics.strBookings} STR · {metrics.mtrBookings} MTR
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Card */}
        <Card 
          className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20 cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => setShowRatingModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Guest Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                  <p className="text-3xl font-bold tracking-tight">
                    {metrics.averageRating?.toFixed(1) || "—"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {metrics.reviewCount} review{metrics.reviewCount !== 1 ? "s" : ""}
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listing Health Card from PeachHaus Listing Boost - only for hybrid/STR */}
      {peachHausData?.listingHealth && (rentalType === 'hybrid' || rentalType === 'str' || !rentalType) && (
        <Card className="bg-gradient-to-br from-orange-50 to-amber-100/50 border-none shadow-lg dark:from-orange-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Listing Health</p>
                  <p className="text-xs text-muted-foreground">
                    Powered by PeachHaus Listing Boost
                  </p>
                </div>
              </div>
              <Badge className={
                peachHausData.listingHealth.status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                peachHausData.listingHealth.status === 'good' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }>
                {peachHausData.listingHealth.status}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {/* Health Score */}
              <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-xl">
                <div className={`text-3xl font-bold ${
                  peachHausData.listingHealth.score >= 80 ? 'text-emerald-600' :
                  peachHausData.listingHealth.score >= 60 ? 'text-blue-600' : 'text-amber-600'
                }`}>
                  {peachHausData.listingHealth.score}
                </div>
                <p className="text-xs text-muted-foreground">Health Score</p>
              </div>
              {/* Current Rate */}
              {peachHausData.pricingIntelligence?.current_base_rate && (
                <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-xl">
                  <div className="text-3xl font-bold">${peachHausData.pricingIntelligence.current_base_rate}</div>
                  <p className="text-xs text-muted-foreground">Current Rate</p>
                </div>
              )}
              {/* Recommended Rate */}
              {peachHausData.pricingIntelligence?.recommended_rate && (
                <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-xl">
                  <div className="text-3xl font-bold text-emerald-600">${peachHausData.pricingIntelligence.recommended_rate}</div>
                  <p className="text-xs text-muted-foreground">Recommended</p>
                </div>
              )}
            </div>
            {peachHausData.pricingIntelligence?.mpi_7_day && (
              <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Market Performance Index</span>
                </div>
                <Badge variant="outline" className={
                  peachHausData.pricingIntelligence.mpi_7_day >= 1 ? 'text-emerald-600' : 'text-amber-600'
                }>
                  {peachHausData.pricingIntelligence.mpi_7_day.toFixed(1)}x
                  {peachHausData.pricingIntelligence.mpi_7_day >= 1 ? ' Beating Market' : ' Below Market'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revenue Breakdown - Conditional based on rental type */}
      <div className={`grid grid-cols-1 ${isHybrid ? 'md:grid-cols-2' : ''} gap-4`}>
        {/* STR Card - Only show for hybrid properties */}
        {isHybrid && (
          <Card 
            className="border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow group"
            onClick={() => setShowStrModal(true)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Short-Term Rental Revenue</p>
                  <p className="text-xs text-muted-foreground">Nightly bookings via Airbnb, VRBO, etc.</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total STR Revenue</span>
                  <span className="font-semibold font-mono">{formatCurrency(metrics.strRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">STR Bookings</span>
                  <span className="font-semibold">{metrics.strBookings}</span>
                </div>
                {metrics.strBookings > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg per Booking</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(metrics.strRevenue / metrics.strBookings)}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> Click for detailed breakdown
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MTR Card - Always show, but with different label for mid-term only properties */}
        <Card 
          className="border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow group"
          onClick={() => setShowMtrModal(true)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {isMidTermOnly ? 'Total Rental Revenue' : 'Mid-Term Rental Revenue'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isMidTermOnly ? 'All bookings (30+ day stays)' : 'Monthly stays (30+ nights)'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {isMidTermOnly ? 'Total Revenue' : 'Total MTR Revenue'}
                </span>
                <span className="font-semibold font-mono">{formatCurrency(metrics.mtrRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {isMidTermOnly ? 'Total Bookings' : 'MTR Bookings'}
                </span>
                <span className="font-semibold">{metrics.mtrBookings}</span>
              </div>
              {metrics.mtrBookings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg per Booking</span>
                  <span className="font-semibold font-mono">
                    {formatCurrency(metrics.mtrRevenue / metrics.mtrBookings)}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Click for detailed breakdown
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Revenue Modal */}
      <Dialog open={showTotalRevenueModal} onOpenChange={setShowTotalRevenueModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              Total Revenue Breakdown
            </DialogTitle>
            <DialogDescription>
              Your complete earnings from all rental activity
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">All-Time Total Revenue</p>
                  <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(metrics.totalRevenue)}</p>
                </div>
                <Separator className="my-4" />
                {isMidTermOnly ? (
                  // Mid-term only properties: Show single revenue card
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <Calendar className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                    <p className="text-xs text-muted-foreground">All Rental Revenue</p>
                    <p className="font-bold text-lg">{formatCurrency(metrics.mtrRevenue)}</p>
                  </div>
                ) : (
                  // Hybrid properties: Show STR and MTR separately
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                      <Building2 className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Short-Term Rentals</p>
                      <p className="font-bold text-lg">{formatCurrency(metrics.strRevenue)}</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                      <Calendar className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                      <p className="text-xs text-muted-foreground">Mid-Term Rentals</p>
                      <p className="font-bold text-lg">{formatCurrency(metrics.mtrRevenue)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Calculation Explanation */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How We Calculate This
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                  {isMidTermOnly ? (
                    // Mid-term only explanation
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-indigo-600">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Total Rental Revenue = {formatCurrency(metrics.mtrRevenue)}</p>
                        <p className="text-muted-foreground">Sum of {metrics.mtrBookings} booking(s) from all platforms (30+ day stays)</p>
                      </div>
                    </div>
                  ) : (
                    // Hybrid explanation
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-orange-600">1</span>
                        </div>
                        <div>
                          <p className="font-medium">Short-Term Rental Revenue = {formatCurrency(metrics.strRevenue)}</p>
                          <p className="text-muted-foreground">Sum of {metrics.strBookings} bookings from platforms like Airbnb and VRBO</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-indigo-600">2</span>
                        </div>
                        <div>
                          <p className="font-medium">Mid-Term Rental Revenue = {formatCurrency(metrics.mtrRevenue)}</p>
                          <p className="text-muted-foreground">Monthly rent from {metrics.mtrBookings} long-term tenant(s)</p>
                        </div>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between font-semibold text-base pt-1">
                    <span>Total Revenue</span>
                    <span className="text-emerald-600">{formatCurrency(metrics.totalRevenue)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Occupancy Modal */}
      <Dialog open={showOccupancyModal} onOpenChange={setShowOccupancyModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Percent className="h-5 w-5 text-blue-600" />
              </div>
              Occupancy Rate Breakdown
            </DialogTitle>
            <DialogDescription>
              How much of the year your property has been booked
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Current Year Occupancy</p>
                  <p className="text-5xl font-bold text-blue-700 dark:text-blue-400">{metrics.occupancyRate}%</p>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="mt-4">
                  <div className="h-4 bg-blue-200/50 dark:bg-blue-900/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.occupancyRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Calculation Explanation */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How We Calculate This
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">We count all booked nights this year</p>
                      <p className="text-muted-foreground">
                        This includes both short-term bookings (nightly stays) and mid-term rentals (monthly tenants).
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                    <p className="text-center text-muted-foreground text-xs mb-2">Formula</p>
                    <p className="text-center font-mono text-sm">
                      (Booked Nights ÷ Days So Far This Year) × 100
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    <strong>Note:</strong> An occupancy rate above 70% is considered excellent for short-term rentals. 
                    Properties with mid-term tenants often see higher occupancy due to longer stays.
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Bookings Modal */}
      <Dialog open={showBookingsModal} onOpenChange={setShowBookingsModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              Bookings Breakdown
            </DialogTitle>
            <DialogDescription>
              All reservations for your property
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-5xl font-bold text-purple-700 dark:text-purple-400">{metrics.totalBookings}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <Building2 className="h-5 w-5 mx-auto text-orange-600 mb-1" />
                    <p className="text-xs text-muted-foreground">Short-Term Bookings</p>
                    <p className="font-bold text-2xl">{metrics.strBookings}</p>
                    <p className="text-xs text-muted-foreground">nightly guests</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <Home className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
                    <p className="text-xs text-muted-foreground">Mid-Term Bookings</p>
                    <p className="font-bold text-2xl">{metrics.mtrBookings}</p>
                    <p className="text-xs text-muted-foreground">monthly tenants</p>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Booking Types Explained
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Short-Term Rentals (STR)</p>
                      <p className="text-muted-foreground">
                        Nightly bookings through platforms like Airbnb, VRBO, or direct bookings. 
                        Typically 1-29 nights per stay.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Home className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">Mid-Term Rentals (MTR)</p>
                      <p className="text-muted-foreground">
                        Monthly tenants with stays of 30+ nights. Often traveling professionals, 
                        relocating families, or extended business travelers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              Guest Rating Breakdown
            </DialogTitle>
            <DialogDescription>
              How guests rate their experience at your property
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 rounded-xl p-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Average Rating</p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star}
                          className={`h-8 w-8 ${
                            metrics.averageRating && star <= metrics.averageRating 
                              ? 'fill-amber-400 text-amber-400' 
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-4xl font-bold text-amber-700 dark:text-amber-400">
                      {metrics.averageRating?.toFixed(1) || "—"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Based on {metrics.reviewCount} review{metrics.reviewCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  About Your Rating
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Your rating is the average of all guest reviews from platforms like Airbnb, VRBO, 
                    and direct bookings. Reviews are synced automatically from your booking channels.
                  </p>
                  {metrics.averageRating && metrics.averageRating >= 4.8 && (
                    <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Excellent! Your property is highly rated by guests.
                      </p>
                    </div>
                  )}
                  {metrics.reviewCount === 0 && (
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-muted-foreground text-center">
                        No reviews yet. Reviews will appear here once guests leave feedback.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* MTR Revenue Breakdown Modal */}
      <Dialog open={showMtrModal} onOpenChange={setShowMtrModal}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              Mid-Term Rental Revenue Details
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of your monthly tenant revenue
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Total MTR Revenue</p>
                  <p className="text-4xl font-bold text-indigo-700 dark:text-indigo-400">{formatCurrency(metrics.mtrRevenue)}</p>
                </div>
                {revenueBreakdown?.summary && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                      <p className="text-xs text-muted-foreground">From Statements</p>
                      <p className="font-bold text-lg">{formatCurrency(revenueBreakdown.summary.mtrFromStatements)}</p>
                      <p className="text-xs text-muted-foreground">verified amounts</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                      <p className="text-xs text-muted-foreground">Projected</p>
                      <p className="font-bold text-lg">{formatCurrency(revenueBreakdown.summary.mtrFromFutureBookings)}</p>
                      <p className="text-xs text-muted-foreground">future bookings</p>
                    </div>
                  </div>
                )}
              </div>

              {/* How it's calculated */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  How MTR Revenue is Calculated
                </h4>
                <p className="text-sm text-muted-foreground">
                  Mid-term rental revenue is based on your monthly statements (which may include manual adjustments) 
                  plus projected revenue from future bookings. Rent is prorated when a tenant's stay spans partial months.
                </p>
              </div>

              {/* Detailed Breakdown */}
              {revenueBreakdown?.mtr && revenueBreakdown.mtr.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Monthly Revenue by Tenant</h4>
                  <div className="space-y-3">
                    {revenueBreakdown.mtr.map((item, idx) => (
                      <div key={idx} className="bg-white dark:bg-muted/30 border rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-lg">{formatMonth(item.month)}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={item.source === 'statement' ? 'default' : 'secondary'}>
                                {item.source === 'statement' ? '✓ Verified' : '📅 Projected'}
                              </Badge>
                            </div>
                          </div>
                          <p className="font-bold text-xl text-indigo-600 dark:text-indigo-400">
                            {formatCurrencyDetailed(item.amount)}
                          </p>
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Tenant</p>
                            <p className="font-medium">{item.tenant}</p>
                          </div>
                          {item.days && (
                            <div>
                              <p className="text-muted-foreground">Days Occupied</p>
                              <p className="font-medium">{item.days} days</p>
                            </div>
                          )}
                          {item.monthlyRent && (
                            <div>
                              <p className="text-muted-foreground">Monthly Rate</p>
                              <p className="font-medium">{formatCurrency(item.monthlyRent)}/month</p>
                            </div>
                          )}
                          {item.startDate && item.endDate && (
                            <div>
                              <p className="text-muted-foreground">Lease Period</p>
                              <p className="font-medium text-xs">
                                {formatDate(item.startDate)} <ArrowRight className="h-3 w-3 inline mx-1" /> {formatDate(item.endDate)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No MTR revenue data available</p>
                </div>
              )}

              {/* Total */}
              <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">Total MTR Revenue</span>
                  <span className="font-bold text-2xl text-indigo-700 dark:text-indigo-400">{formatCurrency(metrics.mtrRevenue)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* STR Revenue Breakdown Modal */}
      <Dialog open={showStrModal} onOpenChange={setShowStrModal}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              Short-Term Rental Revenue Details
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of your nightly booking revenue
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 rounded-xl p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Total STR Revenue</p>
                  <p className="text-4xl font-bold text-orange-700 dark:text-orange-400">{formatCurrency(metrics.strRevenue)}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Bookings</p>
                    <p className="font-bold text-xl">{metrics.strBookings}</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Avg/Booking</p>
                    <p className="font-bold text-xl">
                      {metrics.strBookings > 0 ? formatCurrency(metrics.strRevenue / metrics.strBookings) : '$0'}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Avg/Night</p>
                    <p className="font-bold text-xl">
                      {revenueBreakdown?.str && revenueBreakdown.str.length > 0 
                        ? formatCurrency(metrics.strRevenue / revenueBreakdown.str.reduce((sum, b) => sum + (b.nights || 1), 0))
                        : '$0'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* How it's calculated */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  How STR Revenue is Calculated
                </h4>
                <p className="text-sm text-muted-foreground">
                  Short-term rental revenue is aggregated from your owner statements. Each booking total includes 
                  the nightly rate and any additional fees collected from guests (cleaning fees, service fees, etc.).
                </p>
              </div>

              {/* Detailed Breakdown */}
              {revenueBreakdown?.str && revenueBreakdown.str.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">All Bookings ({revenueBreakdown.str.length})</h4>
                  <div className="space-y-2">
                    {revenueBreakdown.str.slice(0, 30).map((item, idx) => (
                      <div key={idx} className="bg-white dark:bg-muted/30 border rounded-lg p-3 shadow-sm flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{item.guest}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDateShort(item.checkIn)} - {formatDateShort(item.checkOut)}
                            </span>
                            {item.nights && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.nights} night{item.nights !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-bold text-lg font-mono">{formatCurrencyDetailed(item.amount)}</p>
                      </div>
                    ))}
                    {revenueBreakdown.str.length > 30 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        + {revenueBreakdown.str.length - 30} more bookings
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No STR bookings found</p>
                </div>
              )}

              {/* Total */}
              <div className="bg-orange-100 dark:bg-orange-900/30 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">Total STR Revenue</span>
                  <span className="font-bold text-2xl text-orange-700 dark:text-orange-400">{formatCurrency(metrics.strRevenue)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}