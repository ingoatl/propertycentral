import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { format } from "date-fns";

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

export function OwnerGuestScreeningsTab({ propertyId, screenings = [] }: OwnerGuestScreeningsTabProps) {
  const [activeTab, setActiveTab] = useState("all");

  // Filter screenings based on tab
  const filteredScreenings = useMemo(() => {
    if (activeTab === "all") return screenings;
    if (activeTab === "passed") return screenings.filter(s => s.screening_status === "passed");
    if (activeTab === "flagged") return screenings.filter(s => s.screening_status === "flagged" || s.screening_status === "failed");
    return screenings;
  }, [screenings, activeTab]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = screenings.length;
    const passed = screenings.filter(s => s.screening_status === "passed").length;
    const flagged = screenings.filter(s => s.screening_status === "flagged" || s.screening_status === "failed").length;
    const pending = screenings.filter(s => s.screening_status === "pending").length;
    const idVerified = screenings.filter(s => s.id_verified).length;
    const verificationRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return {
      total,
      passed,
      flagged,
      pending,
      idVerified,
      verificationRate,
    };
  }, [screenings]);

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "flagged":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Verified</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Failed</Badge>;
      case "flagged":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Flagged</Badge>;
      case "pending":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRiskIndicator = (riskScore: string | null) => {
    switch (riskScore) {
      case "low":
        return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Low Risk" />;
      case "medium":
        return <span className="inline-block w-2 h-2 rounded-full bg-amber-500" title="Medium Risk" />;
      case "high":
        return <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="High Risk" />;
      default:
        return null;
    }
  };

  const getProviderLogo = (provider: string | null) => {
    switch (provider?.toLowerCase()) {
      case "truvi":
        return "Truvi";
      case "authenticate":
        return "Authenticate";
      case "manual":
        return "Manual";
      default:
        return provider || "Unknown";
    }
  };

  if (screenings.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-none shadow-lg">
          <CardContent className="py-12 text-center">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Guest Verifications Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Guest screening results will appear here once guests complete their verification process through Truvi or Authenticate.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <div className="flex items-center justify-between">
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
            {filteredScreenings.map((screening) => (
              <div
                key={screening.id}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    {getStatusIcon(screening.screening_status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{screening.guest_name}</p>
                      {getRiskIndicator(screening.risk_score)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {screening.screening_date && (
                        <>
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(screening.screening_date), "MMM d, yyyy")}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{getProviderLogo(screening.screening_provider)}</span>
                      {screening.booking?.check_in && (
                        <>
                          <span>•</span>
                          <span>Check-in: {format(new Date(screening.booking.check_in), "MMM d")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {screening.id_verified && (
                      <Badge variant="outline" className="text-xs">
                        <Fingerprint className="h-3 w-3 mr-1" />
                        ID
                      </Badge>
                    )}
                    {screening.background_passed && (
                      <Badge variant="outline" className="text-xs">
                        <FileSearch className="h-3 w-3 mr-1" />
                        BG
                      </Badge>
                    )}
                    {screening.watchlist_clear && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        WL
                      </Badge>
                    )}
                  </div>
                  {getStatusBadge(screening.screening_status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
