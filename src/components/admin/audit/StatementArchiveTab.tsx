import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Download, RefreshCw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StatementRecord {
  id: string;
  reconciliation_id: string;
  statement_number: string;
  statement_date: string;
  statement_month: string;
  property_name: string;
  owner_name: string;
  net_owner_result: number;
  total_revenue: number;
  total_expenses: number;
  management_fee: number;
  statement_pdf_path: string | null;
  recipient_emails: string[];
}

export function StatementArchiveTab() {
  const [statements, setStatements] = useState<StatementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [propertyFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties for filter
      const { data: propsData } = await supabase
        .from("properties")
        .select("id, name")
        .order("name");
      
      if (propsData) setProperties(propsData);

      // First try to get from owner_statement_archive
      let query = supabase
        .from("owner_statement_archive")
        .select(`
          id,
          reconciliation_id,
          statement_number,
          statement_date,
          statement_month,
          net_owner_result,
          total_revenue,
          total_expenses,
          management_fee,
          statement_pdf_path,
          recipient_emails,
          property_id,
          owner_id
        `)
        .order("statement_date", { ascending: false });

      if (propertyFilter && propertyFilter !== "all") {
        query = query.eq("property_id", propertyFilter);
      }

      const { data: archiveData, error } = await query;

      if (error) throw error;

      // Enrich with property and owner names
      const enrichedStatements: StatementRecord[] = [];
      
      for (const stmt of archiveData || []) {
        // Get property name
        const { data: propData } = await supabase
          .from("properties")
          .select("name")
          .eq("id", stmt.property_id)
          .single();

        // Get owner name
        const { data: ownerData } = await supabase
          .from("property_owners")
          .select("name")
          .eq("id", stmt.owner_id)
          .single();

        enrichedStatements.push({
          ...stmt,
          property_name: propData?.name || "Unknown",
          owner_name: ownerData?.name || "Unknown",
        });
      }

      setStatements(enrichedStatements);
    } catch (error) {
      console.error("Error loading statements:", error);
      toast({
        title: "Error",
        description: "Failed to load statement archive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async (statement: StatementRecord) => {
    setDownloading(statement.id);
    try {
      // Generate proper filename: "December 2025 Statement - Owner Name - Property Name.pdf"
      const monthDate = new Date(statement.statement_month);
      const monthName = format(monthDate, "MMMM yyyy");
      const filenameParts = [monthName, "Statement"];
      if (statement.owner_name && statement.owner_name !== "Unknown") {
        filenameParts.push(statement.owner_name);
      }
      if (statement.property_name && statement.property_name !== "Unknown") {
        filenameParts.push(statement.property_name);
      }
      const properFilename = filenameParts.join(" - ").replace(/[^a-zA-Z0-9\s\-]/g, "").replace(/\s+/g, " ").trim() + ".pdf";

      if (statement.statement_pdf_path) {
        // Download from storage
        const { data, error } = await supabase.storage
          .from("statement-pdfs")
          .download(statement.statement_pdf_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = properFilename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Generate PDF on demand using reconciliation_id
        const { data, error } = await supabase.functions.invoke("generate-statement-pdf", {
          body: { reconciliation_id: statement.reconciliation_id },
        });

        if (error) throw error;

        // Download generated PDF
        const pdfBytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = properFilename;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({ title: "Downloaded", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Download Failed",
        description: "Could not download the PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const exportAllStatements = () => {
    const csvContent = [
      ["Statement #", "Date", "Month", "Property", "Owner", "Revenue", "Expenses", "Mgmt Fee", "Net to Owner"].join(","),
      ...filteredStatements.map(s => [
        s.statement_number,
        s.statement_date,
        s.statement_month,
        `"${s.property_name}"`,
        `"${s.owner_name}"`,
        s.total_revenue,
        s.total_expenses,
        s.management_fee,
        s.net_owner_result,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-archive-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const filteredStatements = statements.filter(s =>
    s.statement_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.owner_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalStatements: statements.length,
    totalRevenue: statements.reduce((sum, s) => sum + (s.total_revenue || 0), 0),
    totalExpenses: statements.reduce((sum, s) => sum + (s.total_expenses || 0), 0),
    totalNetToOwner: statements.reduce((sum, s) => sum + (s.net_owner_result || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.totalStatements}</div>
          <div className="text-sm text-muted-foreground">Total Statements</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
          <div className="text-sm text-muted-foreground">Total Revenue</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpenses)}</div>
          <div className="text-sm text-muted-foreground">Total Expenses</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalNetToOwner)}</div>
          <div className="text-sm text-muted-foreground">Net to Owners</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search statements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button onClick={exportAllStatements}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Statements Table */}
      {filteredStatements.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Statements Found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Try adjusting your search" : "No statements have been archived yet"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statement #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Net Result</TableHead>
                <TableHead className="text-center">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStatements.map((statement) => (
                <TableRow key={statement.id}>
                  <TableCell className="font-mono text-sm">
                    {statement.statement_number}
                  </TableCell>
                  <TableCell>
                    {statement.statement_date 
                      ? format(new Date(statement.statement_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {statement.statement_month
                      ? format(new Date(statement.statement_month), "MMM yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>{statement.property_name}</TableCell>
                  <TableCell>{statement.owner_name}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(statement.total_revenue || 0)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${
                    (statement.net_owner_result || 0) >= 0 ? "text-blue-600" : "text-red-600"
                  }`}>
                    {formatCurrency(statement.net_owner_result || 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadPdf(statement)}
                      disabled={downloading === statement.id}
                    >
                      {downloading === statement.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
