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
  Building2,
  Wrench,
  Phone,
  Loader2,
  Mail,
  Mic,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { PDFViewerDialog } from "@/components/documents/PDFViewerDialog";
import { SendVoicemailDialog } from "@/components/communications/SendVoicemailDialog";

interface TaxEntity {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: "owner" | "vendor";
  service_type?: string;
  specialty?: string[];
  payments_ytd: number;
  w9_status: "received" | "requested" | "sent" | "missing";
  w9_date: string | null;
  w9_file_path: string | null;
  tax_year_1099_generated: boolean;
  tax_year_1099_generated_at: string | null;
  tax_classification: string | null;
  taxpayer_name: string | null;
  taxpayer_address: string | null;
  requires_1099: boolean;
  is_1099_ready: boolean;
}

const TAX_THRESHOLD = 600;
const IRS_DEADLINE = new Date(new Date().getFullYear() + 1, 0, 31);

// Pre-drafted W-9 follow-up script
const getW9FollowUpScript = (firstName: string) => `Hi ${firstName}, this is Ingo from PeachHaus Property Management. I'm reaching out because we still need your W-9 form for tax reporting purposes. The IRS requires us to have this on file before we can issue your 1099. I've sent you an email with a secure link to upload it - it only takes about 2 minutes. If you have any questions, please don't hesitate to call me back at 404-800-5932. Thank you, and I hope you have a great day!`;

export function Tax1099Dashboard() {
  const [entities, setEntities] = useState<TaxEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"all" | "owner" | "vendor">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "owners" | "vendors">("all");
  
  // W-9 Viewing state
  const [viewingW9, setViewingW9] = useState<{ filePath: string; name: string; type: string } | null>(null);
  
  // Voice modal state
  const [voiceModalEntity, setVoiceModalEntity] = useState<TaxEntity | null>(null);
  
  // Voice reminder state
  const [sendingVoiceReminder, setSendingVoiceReminder] = useState<string | null>(null);

  const loadTaxData = async () => {
    try {
      setLoading(true);
      const allEntities: TaxEntity[] = [];

      // Fetch owners
      const { data: ownersData, error: ownersError } = await supabase
        .from("property_owners")
        .select(`
          id, name, email, phone, service_type, payments_ytd,
          w9_sent_at, owner_w9_requested_at, owner_w9_uploaded_at, owner_w9_file_path,
          tax_year_1099_generated, tax_year_1099_generated_at,
          tax_classification, taxpayer_name, taxpayer_address
        `)
        .order("name");

      if (ownersError) throw ownersError;

      // Fetch vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from("vendors")
        .select(`
          id, name, company_name, email, phone, specialty, payments_ytd,
          w9_on_file, w9_received_at, w9_file_path,
          tax_year_1099_generated, tax_year_1099_generated_at,
          tax_classification, taxpayer_name, taxpayer_address
        `)
        .eq("status", "active")
        .order("name");

      if (vendorsError) throw vendorsError;

      // Calculate YTD payments from distributions for owners
      const startOfYear = `${yearFilter}-01-01`;
      const endOfYear = `${yearFilter}-12-31`;

      const { data: ownerDistributions } = await supabase
        .from("owner_distributions")
        .select("owner_id, amount")
        .gte("distribution_date", startOfYear)
        .lte("distribution_date", endOfYear)
        .eq("status", "confirmed");

      const ownerPayments: Record<string, number> = {};
      ownerDistributions?.forEach((d) => {
        ownerPayments[d.owner_id] = (ownerPayments[d.owner_id] || 0) + (d.amount || 0);
      });

      // Calculate YTD payments from expenses for vendors
      const { data: vendorExpenses } = await supabase
        .from("expenses")
        .select("vendor, amount")
        .gte("date", startOfYear)
        .lte("date", endOfYear)
        .not("vendor", "is", null);

      const vendorPayments: Record<string, number> = {};
      vendorExpenses?.forEach((e) => {
        if (e.vendor) {
          // Match by vendor name
          vendorPayments[e.vendor.toLowerCase()] = (vendorPayments[e.vendor.toLowerCase()] || 0) + (e.amount || 0);
        }
      });

      // Process owners
      (ownersData || []).forEach((owner) => {
        const ytdPayments = ownerPayments[owner.id] || owner.payments_ytd || 0;
        let w9Status: TaxEntity["w9_status"] = "missing";
        let w9Date: string | null = null;

        if (owner.service_type === "co-hosting") {
          // We send W-9 TO co-hosting owners
          if (owner.w9_sent_at) {
            w9Status = "sent";
            w9Date = owner.w9_sent_at;
          }
        } else {
          // Full-service owners send W-9 TO us
          if (owner.owner_w9_uploaded_at) {
            w9Status = "received";
            w9Date = owner.owner_w9_uploaded_at;
          } else if (owner.owner_w9_requested_at) {
            w9Status = "requested";
            w9Date = owner.owner_w9_requested_at;
          }
        }

        const hasW9 = w9Status === "received" || w9Status === "sent";

        allEntities.push({
          id: owner.id,
          name: owner.name,
          email: owner.email || "",
          phone: owner.phone || undefined,
          type: "owner",
          service_type: owner.service_type,
          payments_ytd: ytdPayments,
          w9_status: w9Status,
          w9_date: w9Date,
          w9_file_path: owner.owner_w9_file_path,
          tax_year_1099_generated: owner.tax_year_1099_generated || false,
          tax_year_1099_generated_at: owner.tax_year_1099_generated_at,
          tax_classification: owner.tax_classification,
          taxpayer_name: owner.taxpayer_name,
          taxpayer_address: owner.taxpayer_address,
          requires_1099: ytdPayments >= TAX_THRESHOLD,
          is_1099_ready: ytdPayments >= TAX_THRESHOLD && hasW9 && !!owner.taxpayer_name,
        });
      });

      // Process vendors
      (vendorsData || []).forEach((vendor) => {
        const vendorName = vendor.company_name || vendor.name;
        const ytdPayments = vendorPayments[vendorName.toLowerCase()] || vendor.payments_ytd || 0;
        
        let w9Status: TaxEntity["w9_status"] = "missing";
        let w9Date: string | null = null;

        if (vendor.w9_received_at || vendor.w9_on_file) {
          w9Status = "received";
          w9Date = vendor.w9_received_at;
        }

        const hasW9 = w9Status === "received";

        allEntities.push({
          id: vendor.id,
          name: vendorName,
          email: vendor.email || "",
          type: "vendor",
          specialty: vendor.specialty,
          payments_ytd: ytdPayments,
          w9_status: w9Status,
          w9_date: w9Date,
          w9_file_path: vendor.w9_file_path,
          tax_year_1099_generated: vendor.tax_year_1099_generated || false,
          tax_year_1099_generated_at: vendor.tax_year_1099_generated_at,
          tax_classification: vendor.tax_classification,
          taxpayer_name: vendor.taxpayer_name,
          taxpayer_address: vendor.taxpayer_address,
          requires_1099: ytdPayments >= TAX_THRESHOLD,
          is_1099_ready: ytdPayments >= TAX_THRESHOLD && hasW9,
        });
      });

      setEntities(allEntities);
    } catch (error) {
      console.error("Error loading tax data:", error);
      toast.error("Failed to load tax data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxData();
  }, [yearFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTaxData();
    setRefreshing(false);
    toast.success("Tax data refreshed");
  };

  const handleRequestW9 = async (entityId: string, entityType: "owner" | "vendor", entityName: string) => {
    try {
      if (entityType === "owner") {
        const { error } = await supabase.functions.invoke("request-owner-w9", {
          body: { ownerId: entityId },
        });
        if (error) throw error;
        toast.success(`W-9 request sent to ${entityName}`);
      } else {
        const { error } = await supabase.functions.invoke("request-vendor-w9", {
          body: { vendorId: entityId },
        });
        if (error) throw error;
        toast.success(`W-9 request sent to ${entityName}`);
      }
      await loadTaxData();
    } catch (error) {
      console.error("Error requesting W-9:", error);
      toast.error("Failed to send W-9 request");
    }
  };

  const handleViewW9 = (filePath: string, type: string, name: string) => {
    setViewingW9({ filePath, name, type });
  };

  const onOpenVoiceModal = (entity: TaxEntity) => {
    setVoiceModalEntity(entity);
  };

  const handleVoiceReminder = async (entityId: string, entityType: "owner" | "vendor", entityName: string) => {
    try {
      setSendingVoiceReminder(entityId);
      const { error } = await supabase.functions.invoke("send-w9-voice-reminder", {
        body: { type: entityType, id: entityId },
      });
      if (error) throw error;
      toast.success(`Voice reminder sent to ${entityName}`);
    } catch (error) {
      console.error("Error sending voice reminder:", error);
      toast.error("Failed to send voice reminder");
    } finally {
      setSendingVoiceReminder(null);
    }
  };

  const handleSendReminder = async (entityId: string, entityType: "owner" | "vendor", entityName: string, reminderDay: number) => {
    try {
      setSendingVoiceReminder(entityId); // Reuse for loading state
      const { error } = await supabase.functions.invoke("send-w9-reminder", {
        body: { type: entityType, id: entityId, reminderDay },
      });
      if (error) throw error;
      
      const reminderLabels: Record<number, string> = {
        2: "Helpful follow-up",
        3: "Social proof",
        4: "Commitment nudge",
        5: "Urgency (5 days)",
        6: "IRS Authority",
        7: "Personal touch",
        8: "Final countdown",
        9: "Tomorrow deadline",
        10: "Last chance",
      };
      
      toast.success(`"${reminderLabels[reminderDay]}" reminder sent to ${entityName}`);
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("Failed to send reminder");
    } finally {
      setSendingVoiceReminder(null);
    }
  };

  const exportTo1099CSV = (type: "all" | "owners" | "vendors") => {
    let eligibleEntities = entities.filter((e) => e.requires_1099);
    
    if (type === "owners") {
      eligibleEntities = eligibleEntities.filter((e) => e.type === "owner");
    } else if (type === "vendors") {
      eligibleEntities = eligibleEntities.filter((e) => e.type === "vendor");
    }

    if (eligibleEntities.length === 0) {
      toast.error("No entities ready for 1099 export");
      return;
    }

    const headers = [
      "Type",
      "Payee Name",
      "Taxpayer Name",
      "Tax Classification",
      "Address",
      "Email",
      "Total Payments",
      "W-9 Status",
      "1099 Ready",
    ];

    const rows = eligibleEntities.map((entity) => [
      entity.type === "owner" ? "Owner" : "Vendor",
      entity.name,
      entity.taxpayer_name || entity.name,
      entity.tax_classification || "Individual",
      entity.taxpayer_address || "",
      entity.email,
      entity.payments_ytd.toFixed(2),
      entity.w9_status,
      entity.is_1099_ready ? "Yes" : "No",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1099-NEC-${type}-${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${eligibleEntities.length} ${type} for 1099 filing`);
  };

  // Filter entities based on search, status, and type
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      const matchesSearch =
        entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.email.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Filter by active tab
      if (activeTab === "owners" && entity.type !== "owner") return false;
      if (activeTab === "vendors" && entity.type !== "vendor") return false;

      switch (statusFilter) {
        case "needs-w9":
          return entity.requires_1099 && entity.w9_status === "missing";
        case "above-threshold":
          return entity.requires_1099;
        case "ready":
          return entity.is_1099_ready;
        case "generated":
          return entity.tax_year_1099_generated;
        default:
          return true;
      }
    });
  }, [entities, searchTerm, statusFilter, activeTab]);

  // Calculate stats
  const stats = useMemo(() => {
    const currentEntities = activeTab === "all" 
      ? entities 
      : entities.filter((e) => e.type === activeTab.slice(0, -1) as "owner" | "vendor");
    
    const aboveThreshold = currentEntities.filter((e) => e.requires_1099);
    const needsW9 = aboveThreshold.filter((e) => e.w9_status === "missing");
    const ready = currentEntities.filter((e) => e.is_1099_ready);
    const generated = currentEntities.filter((e) => e.tax_year_1099_generated);
    const totalPayments = currentEntities.reduce((sum, e) => sum + e.payments_ytd, 0);
    const daysToDeadline = differenceInDays(IRS_DEADLINE, new Date());

    return {
      totalEntities: currentEntities.length,
      owners: entities.filter((e) => e.type === "owner").length,
      vendors: entities.filter((e) => e.type === "vendor").length,
      aboveThreshold: aboveThreshold.length,
      needsW9: needsW9.length,
      ready: ready.length,
      generated: generated.length,
      totalPayments,
      daysToDeadline,
    };
  }, [entities, activeTab]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getW9StatusBadge = (entity: TaxEntity) => {
    switch (entity.w9_status) {
      case "received":
        return (
          <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Received
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case "requested":
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">
            <Clock className="w-3 h-3 mr-1" />
            Requested
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">
            <AlertCircle className="w-3 h-3 mr-1" />
            Missing
          </Badge>
        );
    }
  };

  const get1099StatusBadge = (entity: TaxEntity) => {
    if (entity.tax_year_1099_generated) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Generated
        </Badge>
      );
    }
    if (entity.is_1099_ready) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <FileCheck className="w-3 h-3 mr-1" />
          Ready
        </Badge>
      );
    }
    if (entity.requires_1099) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Missing Info
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        Below $600
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
        <Card className="border-yellow-400 bg-yellow-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                IRS 1099-NEC Deadline Approaching
              </p>
              <p className="text-sm text-yellow-700">
                {stats.daysToDeadline} days until January 31st deadline. {stats.needsW9} payees still need W-9 collection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Owners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats.owners}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{stats.vendors}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Above $600
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
              <AlertCircle className="w-5 h-5 text-destructive" />
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
              <FileCheck className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.ready}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card with Tabs */}
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
              <Button size="sm" onClick={() => exportTo1099CSV(activeTab)}>
                <Download className="w-4 h-4 mr-2" />
                Export 1099 Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="all" className="gap-2">
                  <Users className="w-4 h-4" />
                  All ({entities.length})
                </TabsTrigger>
                <TabsTrigger value="owners" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Owners ({entities.filter((e) => e.type === "owner").length})
                </TabsTrigger>
                <TabsTrigger value="vendors" className="gap-2">
                  <Wrench className="w-4 h-4" />
                  Vendors ({entities.filter((e) => e.type === "vendor").length})
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-28">
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
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="needs-w9">Needs W-9</SelectItem>
                    <SelectItem value="above-threshold">Above $600</SelectItem>
                    <SelectItem value="ready">1099 Ready</SelectItem>
                    <SelectItem value="generated">Generated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="all" className="m-0">
              <EntityTable
                entities={filteredEntities}
                formatCurrency={formatCurrency}
                getW9StatusBadge={getW9StatusBadge}
                get1099StatusBadge={get1099StatusBadge}
                onRequestW9={handleRequestW9}
                onViewW9={handleViewW9}
                onVoiceReminder={handleVoiceReminder}
                onSendReminder={handleSendReminder}
                onOpenVoiceModal={onOpenVoiceModal}
                sendingVoiceReminder={sendingVoiceReminder}
              />
            </TabsContent>
            <TabsContent value="owners" className="m-0">
              <EntityTable
                entities={filteredEntities}
                formatCurrency={formatCurrency}
                getW9StatusBadge={getW9StatusBadge}
                get1099StatusBadge={get1099StatusBadge}
                onRequestW9={handleRequestW9}
                onViewW9={handleViewW9}
                onVoiceReminder={handleVoiceReminder}
                onSendReminder={handleSendReminder}
                onOpenVoiceModal={onOpenVoiceModal}
                sendingVoiceReminder={sendingVoiceReminder}
              />
            </TabsContent>
            <TabsContent value="vendors" className="m-0">
              <EntityTable
                entities={filteredEntities}
                formatCurrency={formatCurrency}
                getW9StatusBadge={getW9StatusBadge}
                get1099StatusBadge={get1099StatusBadge}
                onRequestW9={handleRequestW9}
                onViewW9={handleViewW9}
                onVoiceReminder={handleVoiceReminder}
                onSendReminder={handleSendReminder}
                onOpenVoiceModal={onOpenVoiceModal}
                sendingVoiceReminder={sendingVoiceReminder}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* W-9 Viewer Dialog */}
      <PDFViewerDialog
        open={!!viewingW9}
        onOpenChange={() => setViewingW9(null)}
        filePath={viewingW9?.filePath || ""}
        title={`W-9 - ${viewingW9?.name}`}
        bucketName="onboarding-documents"
      />

      {/* Voice Follow-up Dialog */}
      {voiceModalEntity && (
        <SendVoicemailDialog
          open={!!voiceModalEntity}
          onOpenChange={(open) => !open && setVoiceModalEntity(null)}
          recipientName={voiceModalEntity.name}
          recipientPhone={voiceModalEntity.phone || ""}
          allowNameEdit={true}
        />
      )}
    </div>
  );
}

interface EntityTableProps {
  entities: TaxEntity[];
  formatCurrency: (amount: number) => string;
  getW9StatusBadge: (entity: TaxEntity) => React.ReactNode;
  get1099StatusBadge: (entity: TaxEntity) => React.ReactNode;
  onRequestW9: (id: string, type: "owner" | "vendor", name: string) => void;
  onViewW9: (filePath: string, type: string, name: string) => void;
  onVoiceReminder: (id: string, type: "owner" | "vendor", name: string) => void;
  onSendReminder: (id: string, type: "owner" | "vendor", name: string, day: number) => void;
  onOpenVoiceModal: (entity: TaxEntity) => void;
  sendingVoiceReminder: string | null;
}

function EntityTable({
  entities,
  formatCurrency,
  getW9StatusBadge,
  get1099StatusBadge,
  onRequestW9,
  onViewW9,
  onVoiceReminder,
  onSendReminder,
  onOpenVoiceModal,
  sendingVoiceReminder,
}: EntityTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">YTD Payments</TableHead>
            <TableHead>W-9 Status</TableHead>
            <TableHead>1099 Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            entities.map((entity) => (
              <TableRow key={`${entity.type}-${entity.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium">{entity.name}</p>
                    <p className="text-sm text-muted-foreground">{entity.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {entity.type === "owner" ? (
                      <>
                        <Building2 className="w-3 h-3 mr-1" />
                        {entity.service_type?.replace("-", " ") || "Owner"}
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3 h-3 mr-1" />
                        Vendor
                      </>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={entity.requires_1099 ? "font-semibold text-amber-700" : ""}>
                    {formatCurrency(entity.payments_ytd)}
                  </span>
                </TableCell>
                <TableCell>{getW9StatusBadge(entity)}</TableCell>
                <TableCell>{get1099StatusBadge(entity)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {entity.w9_status === "missing" && entity.requires_1099 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRequestW9(entity.id, entity.type, entity.name)}
                        title="Request W-9"
                        className="gap-1"
                      >
                        <Send className="w-4 h-4" />
                        Request W-9
                      </Button>
                    )}
                    {entity.w9_status === "requested" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestW9(entity.id, entity.type, entity.name)}
                          title="Resend W-9 Request"
                          className="gap-1 text-muted-foreground"
                        >
                          <Send className="w-4 h-4" />
                          Resend
                        </Button>
                        
                        {/* Follow-up Voice Message Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenVoiceModal(entity)}
                          disabled={!entity.phone}
                          className="gap-1"
                          title={entity.phone ? "Send voice follow-up" : "No phone number on file"}
                        >
                          <Mic className="w-4 h-4" />
                          Follow Up
                        </Button>
                      </>
                    )}
                    {entity.w9_file_path && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="View W-9"
                        onClick={() => onViewW9(entity.w9_file_path!, entity.type, entity.name)}
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
  );
}
