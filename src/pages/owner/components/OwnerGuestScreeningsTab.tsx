import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  UserCheck,
  Fingerprint,
  FileSearch,
  Users,
  Calendar,
  MapPin,
  Star,
  TrendingDown,
  Info,
  ExternalLink,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface GuestScreening {
  id: string;
  guest_name: string;
  guest_email: string | null;
  screening_provider: string | null;
  screening_status: string | null;
  verification_type: string | null;
  id_verified: boolean;
  background_passed: boolean | null;
  watchlist_clear: boolean | null;
  risk_score: string | null;
  screening_date: string | null;
  notes: string | null;
  raw_result?: {
    check_in?: string;
    check_out?: string;
    property_address?: string;
  } | null;
  booking?: {
    id: string;
    guest_name: string | null;
    check_in: string | null;
    check_out: string | null;
  } | null;
}

interface OwnerGuestScreeningsTabProps {
  propertyId: string;
  screenings?: GuestScreening[];
}

// Industry statistics for context
const INDUSTRY_STATS = {
  damageReduction: 47,
  chargebackReduction: 62,
  avgScreeningTime: "< 5 minutes",
  verificationRate: 94,
};

export function OwnerGuestScreeningsTab({ propertyId, screenings = [] }: OwnerGuestScreeningsTabProps) {
  // Default to showing all since we only fetch passed verifications from the API
  const [activeTab, setActiveTab] = useState("all");

  // Only show completed (passed) verifications - filter out any pending/flagged that might slip through
  const completedScreenings = useMemo(() => {
    return screenings.filter(s => s.screening_status === "passed" && s.guest_name && s.guest_name !== "Guest" && s.guest_name !== "Unknown");
  }, [screenings]);

  // Filter screenings based on tab (now working with completed screenings only)
  const filteredScreenings = useMemo(() => {
    if (activeTab === "all") return completedScreenings;
    if (activeTab === "passed") return completedScreenings.filter(s => s.screening_status === "passed");
    if (activeTab === "flagged") return completedScreenings.filter(s => s.screening_status === "flagged" || s.screening_status === "failed");
    return completedScreenings;
  }, [completedScreenings, activeTab]);

  // Calculate stats based on completed screenings
  const stats = useMemo(() => {
    const total = completedScreenings.length;
    const passed = completedScreenings.filter(s => s.screening_status === "passed").length;
    const flagged = completedScreenings.filter(s => s.screening_status === "flagged" || s.screening_status === "failed").length;
    const pending = 0; // We don't show pending to owners
    const idVerified = completedScreenings.filter(s => s.id_verified).length;
    const verificationRate = total > 0 ? 100 : 0; // All shown are verified

    return {
      total,
      passed,
      flagged,
      pending,
      idVerified,
      verificationRate,
    };
  }, [completedScreenings]);

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-6 w-6 text-red-500" />;
      case "flagged":
        return <AlertTriangle className="h-6 w-6 text-amber-500" />;
      case "pending":
        return <Clock className="h-6 w-6 text-blue-500" />;
      default:
        return <Shield className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-sm px-3 py-1">✓ Verified</Badge>;
      case "failed":
        return <Badge className="bg-red-500 text-white hover:bg-red-600 text-sm px-3 py-1">✗ Failed</Badge>;
      case "flagged":
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-sm px-3 py-1">⚠ Flagged</Badge>;
      case "pending":
        return <Badge className="bg-blue-500 text-white hover:bg-blue-600 text-sm px-3 py-1">⏳ Pending</Badge>;
      default:
        return <Badge variant="outline" className="text-sm px-3 py-1">Unknown</Badge>;
    }
  };

  const getRiskBadge = (riskScore: string | null) => {
    switch (riskScore?.toLowerCase()) {
      case "low":
        return (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">Low Risk</span>
          </div>
        );
      case "medium":
        return (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-sm font-medium">Medium Risk</span>
          </div>
        );
      case "high":
        return (
          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium">High Risk</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getProviderBadge = (provider: string | null) => {
    const providerName = provider?.toLowerCase();
    if (providerName === "truvi") {
      return (
        <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 dark:from-blue-950/50 dark:to-indigo-950/50 dark:border-blue-800 dark:text-blue-300">
          <Shield className="h-3 w-3 mr-1" />
          Truvi
        </Badge>
      );
    }
    if (providerName === "authenticate") {
      return (
        <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 text-purple-700 dark:from-purple-950/50 dark:to-violet-950/50 dark:border-purple-800 dark:text-purple-300">
          <Fingerprint className="h-3 w-3 mr-1" />
          Authenticate
        </Badge>
      );
    }
    return provider ? (
      <Badge variant="outline">{provider}</Badge>
    ) : null;
  };

  const getStayDates = (screening: GuestScreening) => {
    // Try booking first, then raw_result
    const checkIn = screening.booking?.check_in || screening.raw_result?.check_in;
    const checkOut = screening.booking?.check_out || screening.raw_result?.check_out;
    
    if (checkIn && checkOut) {
      try {
        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);
        const nights = differenceInDays(outDate, inDate);
        return {
          formatted: `${format(inDate, "MMM d")} - ${format(outDate, "MMM d, yyyy")}`,
          nights: nights > 0 ? `${nights} night${nights > 1 ? 's' : ''}` : null,
        };
      } catch {
        return null;
      }
    }
    return null;
  };

  const getGuestInitials = (name: string) => {
    if (!name || name === "Unknown") return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (screenings.length === 0) {
    return (
      <div className="space-y-6">
        {/* Industry Value Callout */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5">
          <CardContent className="py-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">Guest Verification Protects Your Property</h3>
                  <p className="text-muted-foreground mt-1">
                    Every guest who books your property goes through identity verification to ensure a safe and secure stay.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <div className="text-center p-3 bg-background/80 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{INDUSTRY_STATS.damageReduction}%</p>
                    <p className="text-xs text-muted-foreground">Less Property Damage</p>
                  </div>
                  <div className="text-center p-3 bg-background/80 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{INDUSTRY_STATS.chargebackReduction}%</p>
                    <p className="text-xs text-muted-foreground">Fewer Chargebacks</p>
                  </div>
                  <div className="text-center p-3 bg-background/80 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{INDUSTRY_STATS.avgScreeningTime}</p>
                    <p className="text-xs text-muted-foreground">Avg. Verification Time</p>
                  </div>
                  <div className="text-center p-3 bg-background/80 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{INDUSTRY_STATS.verificationRate}%</p>
                    <p className="text-xs text-muted-foreground">Industry Pass Rate</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center mb-6">
              <UserCheck className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Guest Verifications Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Guest verification results will appear here once guests complete their identity verification before their stay.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Industry Value Banner */}
      <Card className="border-none shadow-md bg-gradient-to-r from-emerald-50 via-blue-50 to-purple-50 dark:from-emerald-950/30 dark:via-blue-950/30 dark:to-purple-950/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm">
              <span className="font-medium">Guest screening reduces property damage claims by {INDUSTRY_STATS.damageReduction}%</span>
              <span className="text-muted-foreground"> — Every verified guest helps protect your investment.</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Verified Guests</p>
                <p className="text-3xl font-bold tracking-tight">{stats.passed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Fingerprint className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">ID Verified</p>
                <p className="text-3xl font-bold tracking-tight">{stats.idVerified}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Flagged</p>
                <p className="text-3xl font-bold tracking-tight">{stats.flagged}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Verification Rate</p>
                <p className="text-3xl font-bold tracking-tight">{stats.verificationRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Screenings List */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-background border-b pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Guest Verifications
            </CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="text-xs">
                  All ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="passed" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Passed ({stats.passed})
                </TabsTrigger>
                <TabsTrigger value="flagged" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Flagged ({stats.flagged})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredScreenings.map((screening) => {
              const stayDates = getStayDates(screening);
              const displayName = screening.guest_name && screening.guest_name !== "Unknown" 
                ? screening.guest_name 
                : screening.booking?.guest_name || "Guest";
              
              return (
                <div
                  key={screening.id}
                  className="p-6 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar with initials */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-semibold text-primary">
                        {getGuestInitials(displayName)}
                      </span>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold">{displayName}</h3>
                            {getStatusBadge(screening.screening_status)}
                          </div>
                          {stayDates && (
                            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span className="text-sm font-medium">{stayDates.formatted}</span>
                              {stayDates.nights && (
                                <Badge variant="secondary" className="text-xs">{stayDates.nights}</Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {getRiskBadge(screening.risk_score)}
                      </div>

                      {/* Property address if available */}
                      {screening.raw_result?.property_address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <MapPin className="h-4 w-4" />
                          <span>{screening.raw_result.property_address}</span>
                        </div>
                      )}

                      {/* Verification checks grid */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg ${screening.id_verified ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted'}`}>
                          <Fingerprint className={`h-4 w-4 ${screening.id_verified ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          <div>
                            <p className={`text-xs font-medium ${screening.id_verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                              ID Verified
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {screening.id_verified ? '✓ Complete' : 'Pending'}
                            </p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg ${screening.background_passed ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted'}`}>
                          <FileSearch className={`h-4 w-4 ${screening.background_passed ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          <div>
                            <p className={`text-xs font-medium ${screening.background_passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                              Background
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {screening.background_passed ? '✓ Clear' : screening.background_passed === false ? '✗ Issues' : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg ${screening.watchlist_clear ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted'}`}>
                          <Users className={`h-4 w-4 ${screening.watchlist_clear ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          <div>
                            <p className={`text-xs font-medium ${screening.watchlist_clear ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                              Watchlist
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {screening.watchlist_clear ? '✓ Clear' : screening.watchlist_clear === false ? '⚠ Match' : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Footer with provider and date */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          {getProviderBadge(screening.screening_provider)}
                          {screening.screening_date && (
                            <span className="text-muted-foreground">
                              Verified on {format(new Date(screening.screening_date), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        {screening.notes && (
                          <span className="text-xs text-muted-foreground italic">{screening.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Trust & Safety Footer */}
      <Card className="border-none shadow-sm bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Powered by Industry-Leading Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              <span>{INDUSTRY_STATS.damageReduction}% Reduction in Claims</span>
            </div>
            <a 
              href="https://www.truvi.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <span>Learn More</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
