import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  DollarSign,
  FileCheck,
  RefreshCw,
  Send,
  Eye,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

interface OwnerTaxInfo {
  id: string;
  name: string;
  email: string;
  service_type: string;
  payments_ytd: number;
  w9_sent_at: string | null;
  owner_w9_requested_at: string | null;
  owner_w9_uploaded_at: string | null;
  owner_w9_file_path: string | null;
  tax_year_1099_generated: boolean;
  tax_year_1099_generated_at: string | null;
  tax_classification: string | null;
  taxpayer_name: string | null;
  taxpayer_address: string | null;
  requires_1099: boolean;
  is_1099_ready: boolean;
}

const TAX_THRESHOLD = 600;
const IRS_DEADLINE = new Date(new Date().getFullYear() + 1, 0, 31); // Jan 31 next year

export function Tax1099Dashboard() {
  const [owners, setOwners] = useState<OwnerTaxInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadOwnerTaxData = async () => {
    try {
      setLoading(true);
      
      // Fetch all active owners
      const { data: ownersData, error } = await supabase
        .from("property_owners")
        .select(`
          id,
          name,
          email,
          service_type,
          payments_ytd,
          w9_sent_at,
          owner_w9_requested_at,
          owner_w9_uploaded_at,
          owner_w9_file_path,
          tax_year_1099_generated,
          tax_year_1099_generated_at,
          tax_classification,
          taxpayer_name,
          taxpayer_address
        `)
        .order("name");

      if (error) throw error;

      // Calculate YTD payments from distributions for the selected year
      const startOfYear = `${yearFilter}-01-01`;
      const endOfYear = `${yearFilter}-12-31`;
      
      const { data: distributions } = await supabase
        .from("owner_distributions")
        .select("owner_id, amount")
        .gte("distribution_date", startOfYear)
        .lte("distribution_date", endOfYear)
        .eq("status", "confirmed");

      // Aggregate payments by owner
      const paymentsByOwner: Record<string, number> = {};
      distributions?.forEach((d) => {
        paymentsByOwner[d.owner_id] = (paymentsByOwner[d.owner_id] || 0) + (d.amount || 0);
      });

      // Process owners with tax info
      const processedOwners: OwnerTaxInfo[] = (ownersData || []).map((owner) => {
        const ytdPayments = paymentsByOwner[owner.id] || owner.payments_ytd || 0;
        const requiresW9 = owner.service_type === "full-service"; // Full-service owners send W-9 TO us
        const hasW9 = owner.service_type === "co-hosting" 
          ? !!owner.w9_sent_at // We sent W-9 to co-hosting
          : !!owner.owner_w9_uploaded_at; // Full-service uploaded their W-9
        
        return {
          ...owner,
          payments_ytd: ytdPayments,
          requires_1099: ytdPayments >= TAX_THRESHOLD,
          is_1099_ready: ytdPayments >= TAX_THRESHOLD && hasW9 && !!owner.taxpayer_name,
        };
      });

      setOwners(processedOwners);
    } catch (error) {
      console.error("Error loading tax data:", error);
      toast.error("Failed to load tax data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnerTaxData();
  }, [yearFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOwnerTaxData();
    setRefreshing(false);
    toast.success("Tax data refreshed");
  };

  const handleRequestW9 = async (ownerId: string) => {
    try {
      const { error } = await supabase.functions.invoke("request-owner-w9", {
        body: { ownerId },
      });
      if (error) throw error;
      toast.success("W-9 request sent");
      await loadOwnerTaxData();
    } catch (error) {
      console.error("Error requesting W-9:", error);
      toast.error("Failed to send W-9 request");
    }
  };

  const exportTo1099CSV = () => {
    const eligibleOwners = owners.filter((o) => o.requires_1099 && o.is_1099_ready);
    
    if (eligibleOwners.length === 0) {
      toast.error("No owners ready for 1099 export");
      return;
    }

    const headers = [
      "Payee Name",
      "Taxpayer Name",
      "Tax Classification",
      "Address",
      "Email",
      "Total Payments",
      "W-9 Received",
    ];

    const rows = eligibleOwners.map((owner) => [
      owner.name,
      owner.taxpayer_name || owner.name,
      owner.tax_classification || "Individual",
      owner.taxpayer_address || "",
      owner.email,
      owner.payments_ytd.toFixed(2),
      owner.owner_w9_uploaded_at ? format(new Date(owner.owner_w9_uploaded_at), "MM/dd/yyyy") : "N/A",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1099-NEC-data-${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${eligibleOwners.length} owners for 1099 filing`);
  };

  // Filter owners based on search and status
  const filteredOwners = useMemo(() => {
    return owners.filter((owner) => {
      const matchesSearch = 
        owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        owner.email.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      switch (statusFilter) {
        case "needs-w9":
          return owner.requires_1099 && !owner.owner_w9_uploaded_at;
        case "above-threshold":
          return owner.requires_1099;
        case "ready":
          return owner.is_1099_ready;
        case "generated":
          return owner.tax_year_1099_generated;
        default:
          return true;
      }
    });
  }, [owners, searchTerm, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const aboveThreshold = owners.filter((o) => o.requires_1099);
    const needsW9 = aboveThreshold.filter((o) => !o.owner_w9_uploaded_at);
    const ready = owners.filter((o) => o.is_1099_ready);
    const generated = owners.filter((o) => o.tax_year_1099_generated);
    const totalPayments = owners.reduce((sum, o) => sum + o.payments_ytd, 0);
    const daysToDeadline = differenceInDays(IRS_DEADLINE, new Date());

    return {
      totalOwners: owners.length,
      aboveThreshold: aboveThreshold.length,
      needsW9: needsW9.length,
      ready: ready.length,
      generated: generated.length,
      totalPayments,
      daysToDeadline,
    };
  }, [owners]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getW9Status = (owner: OwnerTaxInfo) => {
    if (owner.service_type === "co-hosting") {
      // For co-hosting, we send W-9 to them
      return owner.w9_sent_at ? (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Sent to Owner
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Not Sent
        </Badge>
      );
    }
    
    // For full-service, they send W-9 to us
    if (owner.owner_w9_uploaded_at) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Received
        </Badge>
      );
    }
    if (owner.owner_w9_requested_at) {
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Clock className="w-3 h-3 mr-1" />
          Requested
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-red-600 border-red-600">
        <AlertCircle className="w-3 h-3 mr-1" />
        Missing
      </Badge>
    );
  };

  const get1099Status = (owner: OwnerTaxInfo) => {
    if (owner.tax_year_1099_generated) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Generated
        </Badge>
      );
    }
    if (owner.is_1099_ready) {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          <FileCheck className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      );
    }
    if (owner.requires_1099) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Missing Info
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        Below Threshold
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deadline Alert */}
      {stats.daysToDeadline <= 30 && stats.daysToDeadline > 0 && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                IRS 1099-NEC Deadline Approaching
              </p>
              <p className="text-sm text-yellow-700">
                {stats.daysToDeadline} days until January 31st deadline. {stats.needsW9} owners still need W-9 collection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Owners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{stats.totalOwners}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Above $600 Threshold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-600" />
              <span className="text-2xl font-bold">{stats.aboveThreshold}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs W-9
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold">{stats.needsW9}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              1099 Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.ready}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              YTD Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{formatCurrency(stats.totalPayments)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>1099 Tax Center</CardTitle>
              <CardDescription>
                Track W-9 collection and 1099 preparation for tax year {yearFilter}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={exportTo1099CSV}>
                <Download className="w-4 h-4 mr-2" />
                Export 1099 Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search owners..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-32">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={(new Date().getFullYear()).toString()}>
                  {new Date().getFullYear()}
                </SelectItem>
                <SelectItem value={(new Date().getFullYear() - 1).toString()}>
                  {new Date().getFullYear() - 1}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                <SelectItem value="needs-w9">Needs W-9</SelectItem>
                <SelectItem value="above-threshold">Above $600</SelectItem>
                <SelectItem value="ready">1099 Ready</SelectItem>
                <SelectItem value="generated">1099 Generated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Owners Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead className="text-right">YTD Payments</TableHead>
                  <TableHead>W-9 Status</TableHead>
                  <TableHead>1099 Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOwners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No owners found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOwners.map((owner) => (
                    <TableRow key={owner.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{owner.name}</p>
                          <p className="text-sm text-muted-foreground">{owner.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {owner.service_type?.replace("-", " ") || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={owner.requires_1099 ? "font-semibold text-yellow-700" : ""}>
                          {formatCurrency(owner.payments_ytd)}
                        </span>
                      </TableCell>
                      <TableCell>{getW9Status(owner)}</TableCell>
                      <TableCell>{get1099Status(owner)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {owner.service_type === "full-service" && !owner.owner_w9_uploaded_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRequestW9(owner.id)}
                              title="Request W-9"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {owner.owner_w9_file_path && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View W-9"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
