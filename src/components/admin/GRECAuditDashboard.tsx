import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileText, Search, Filter, RefreshCw, Archive, DollarSign, Building2, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

interface StatementArchive {
  id: string;
  reconciliation_id: string;
  property_id: string;
  owner_id: string;
  statement_number: string;
  statement_date: string;
  statement_month: string;
  recipient_emails: string[];
  statement_pdf_path: string | null;
  net_owner_result: number;
  total_revenue: number;
  total_expenses: number;
  management_fee: number;
  is_revision: boolean;
  revision_number: number;
  created_at: string;
  properties?: { name: string; address: string };
  property_owners?: { name: string; email: string };
}

interface AuditStats {
  totalStatements: number;
  totalRevenue: number;
  totalExpenses: number;
  totalManagementFees: number;
  propertiesDocumented: number;
}

export function GRECAuditDashboard() {
  const [statements, setStatements] = useState<StatementArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalStatements: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalManagementFees: 0,
    propertiesDocumented: 0,
  });
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadStatements();
    loadProperties();
  }, [propertyFilter]);

  const loadProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setProperties(data);
    }
  };

  const loadStatements = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("owner_statement_archive")
        .select("*")
        .order("statement_date", { ascending: false });

      if (propertyFilter !== "all") {
        query = query.eq("property_id", propertyFilter);
      }

      const { data: statementsData, error } = await query;

      if (error) throw error;

      // Fetch properties and owners separately
      const propertyIds = [...new Set((statementsData || []).map((s) => s.property_id).filter(Boolean))];
      const ownerIds = [...new Set((statementsData || []).map((s) => s.owner_id).filter(Boolean))];

      let propertiesMap: Record<string, { name: string; address: string }> = {};
      let ownersMap: Record<string, { name: string; email: string }> = {};

      if (propertyIds.length > 0) {
        const { data: propertiesData } = await supabase
          .from("properties")
          .select("id, name, address")
          .in("id", propertyIds);
        
        propertiesData?.forEach((p) => {
          propertiesMap[p.id] = { name: p.name, address: p.address };
        });
      }

      if (ownerIds.length > 0) {
        const { data: ownersData } = await supabase
          .from("property_owners")
          .select("id, name, email")
          .in("id", ownerIds);
        
        ownersData?.forEach((o) => {
          ownersMap[o.id] = { name: o.name, email: o.email };
        });
      }

      // Merge the data
      const enrichedStatements = (statementsData || []).map((s) => ({
        ...s,
        properties: s.property_id ? propertiesMap[s.property_id] : undefined,
        property_owners: s.owner_id ? ownersMap[s.owner_id] : undefined,
      }));

      setStatements(enrichedStatements);

      // Calculate stats
      const uniqueProperties = new Set((statementsData || []).map((s) => s.property_id));
      setStats({
        totalStatements: statementsData?.length || 0,
        totalRevenue: (statementsData || []).reduce((sum, s) => sum + Number(s.total_revenue || 0), 0),
        totalExpenses: (statementsData || []).reduce((sum, s) => sum + Number(s.total_expenses || 0), 0),
        totalManagementFees: (statementsData || []).reduce((sum, s) => sum + Number(s.management_fee || 0), 0),
        propertiesDocumented: uniqueProperties.size,
      });
    } catch (error: any) {
      console.error("Error loading statements:", error);
      toast.error("Failed to load statement archive");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async (statement: StatementArchive) => {
    setDownloading(statement.id);
    try {
      // If we have a stored PDF path, download from storage
      if (statement.statement_pdf_path) {
        const { data, error } = await supabase.storage
          .from("statement-pdfs")
          .download(statement.statement_pdf_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${statement.statement_number}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded");
      } else {
        // Regenerate PDF on demand
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          toast.error("Please log in to download PDFs");
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-statement-pdf`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.session.access_token}`,
            },
            body: JSON.stringify({ reconciliation_id: statement.reconciliation_id }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to generate PDF");
        }

        const result = await response.json();
        
        if (result.pdfBase64) {
          // Convert base64 to blob and download
          const binaryString = atob(result.pdfBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = result.fileName || `${statement.statement_number}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("PDF downloaded");
        }
      }
    } catch (error: any) {
      console.error("Error downloading PDF:", error);
      toast.error("Failed to download PDF");
    } finally {
      setDownloading(null);
    }
  };

  const exportAllStatements = async () => {
    toast.info("Preparing export...");
    
    // Export as CSV for now (simpler than zip of PDFs)
    const headers = ["Statement ID", "Property", "Owner", "Period", "Revenue", "Expenses", "Management Fee", "Net Result", "Date Sent"];
    const rows = statements.map((s) => [
      s.statement_number,
      s.properties?.name || "",
      s.property_owners?.name || "",
      s.statement_month ? format(parseISO(s.statement_month), "MMMM yyyy") : "",
      s.total_revenue?.toFixed(2) || "0.00",
      s.total_expenses?.toFixed(2) || "0.00",
      s.management_fee?.toFixed(2) || "0.00",
      s.net_owner_result?.toFixed(2) || "0.00",
      s.statement_date ? format(parseISO(s.statement_date), "MM/dd/yyyy") : "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GREC-Audit-Export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export complete");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredStatements = statements.filter((s) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.statement_number.toLowerCase().includes(search) ||
      s.properties?.name?.toLowerCase().includes(search) ||
      s.property_owners?.name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">GREC Audit Compliance Dashboard</h2>
          <p className="text-muted-foreground">
            Georgia Real Estate Commission compliant statement archive
          </p>
        </div>
        <Button onClick={exportAllStatements} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Statements</p>
                <p className="text-2xl font-bold">{stats.totalStatements}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <Archive className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Management Fees</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalManagementFees)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Properties Documented</p>
                <p className="text-2xl font-bold">{stats.propertiesDocumented}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search statements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadStatements}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Statement Archive</CardTitle>
          <CardDescription>
            All owner statements sent, stored for 3+ year retention per GREC requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStatements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No statements found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statement ID</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Net Result</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatements.map((statement) => (
                  <TableRow key={statement.id}>
                    <TableCell className="font-mono text-sm">
                      {statement.statement_number}
                      {statement.is_revision && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          R{statement.revision_number}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{statement.properties?.name || "—"}</TableCell>
                    <TableCell>{statement.property_owners?.name || "—"}</TableCell>
                    <TableCell>
                      {statement.statement_month
                        ? format(parseISO(statement.statement_month), "MMMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={statement.net_owner_result >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(statement.net_owner_result || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {statement.statement_date
                        ? format(parseISO(statement.statement_date), "MM/dd/yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadPdf(statement)}
                        disabled={downloading === statement.id}
                      >
                        {downloading === statement.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
