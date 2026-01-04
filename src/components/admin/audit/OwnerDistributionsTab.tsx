import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { RefreshCw, DollarSign, Download, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Distribution {
  id: string;
  owner_id: string;
  property_id: string;
  reconciliation_id: string | null;
  amount: number;
  distribution_date: string;
  payment_method: string | null;
  reference_number: string | null;
  status: string;
  created_at: string;
  owner_name?: string;
  property_name?: string;
}

export function OwnerDistributionsTab() {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    loadDistributions();
  }, [yearFilter]);

  const loadDistributions = async () => {
    setLoading(true);
    try {
      const startOfYear = `${yearFilter}-01-01`;
      const endOfYear = `${yearFilter}-12-31`;

      const { data, error } = await supabase
        .from("owner_distributions")
        .select(`
          *,
          property_owners(name),
          properties(name)
        `)
        .gte("distribution_date", startOfYear)
        .lte("distribution_date", endOfYear)
        .order("distribution_date", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((d: any) => ({
        ...d,
        owner_name: d.property_owners?.name || "Unknown Owner",
        property_name: d.properties?.name || "Unknown Property",
      }));

      setDistributions(enriched);
    } catch (error) {
      console.error("Error loading distributions:", error);
      toast.error("Failed to load distributions");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const exportTo1099 = () => {
    // Group by owner and sum amounts
    const ownerTotals = new Map<string, { name: string; total: number }>();
    
    distributions.forEach((d) => {
      const existing = ownerTotals.get(d.owner_id) || { name: d.owner_name!, total: 0 };
      existing.total += d.amount;
      ownerTotals.set(d.owner_id, existing);
    });

    const rows = [["Owner Name", "Owner ID", "Total Distributions"]];
    ownerTotals.forEach((data, id) => {
      rows.push([data.name, id, data.total.toFixed(2)]);
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1099-Summary-${yearFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("1099 summary exported");
  };

  const filteredDistributions = distributions.filter((d) =>
    d.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: filteredDistributions.length,
    totalAmount: filteredDistributions.reduce((sum, d) => sum + d.amount, 0),
    confirmed: filteredDistributions.filter((d) => d.status === "confirmed").length,
    pending: filteredDistributions.filter((d) => d.status === "pending").length,
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Distributions</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Paid</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalAmount)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Confirmed</div>
          <div className="text-2xl font-bold">{stats.confirmed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder="Search owner, property, reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportTo1099}>
            <Download className="h-4 w-4 mr-2" />
            Export 1099 Summary
          </Button>
          <Button variant="outline" onClick={loadDistributions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {filteredDistributions.length === 0 ? (
        <Card className="p-8 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Distributions Found</h3>
          <p className="text-muted-foreground">
            Owner payment distributions for {yearFilter} will appear here.
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDistributions.map((dist) => (
                <TableRow key={dist.id}>
                  <TableCell className="font-medium">
                    {format(new Date(dist.distribution_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>{dist.owner_name}</TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {dist.property_name}
                  </TableCell>
                  <TableCell className="capitalize">
                    {dist.payment_method || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {dist.reference_number || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(dist.amount)}
                  </TableCell>
                  <TableCell>
                    {dist.status === "confirmed" ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confirmed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">1099 Reporting</h4>
        <p className="text-sm text-blue-800">
          Property owners receiving over $600 in distributions require a 1099-MISC form.
          Use the export button to generate a summary for tax preparation.
        </p>
      </Card>
    </div>
  );
}
