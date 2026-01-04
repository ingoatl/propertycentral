import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, DollarSign, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DepositRecord {
  id: string;
  original_charge_id: string | null;
  owner_id: string;
  owner_name: string;
  amount: number;
  return_date: string;
  return_method: string;
  notes: string | null;
}

export function SecurityDepositLedger() {
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("security_deposit_returns")
        .select(`
          id,
          original_charge_id,
          owner_id,
          amount,
          return_date,
          return_method,
          notes
        `)
        .order("return_date", { ascending: false });

      if (error) throw error;

      // Enrich with owner names
      const enriched = await Promise.all((data || []).map(async (d) => {
        let ownerName = "Unknown";
        if (d.owner_id) {
          const { data: ownerData } = await supabase
            .from("property_owners")
            .select("name")
            .eq("id", d.owner_id)
            .single();
          ownerName = ownerData?.name || "Unknown";
        }

        return {
          ...d,
          owner_name: ownerName,
        };
      }));

      setDeposits(enriched);
    } catch (error) {
      console.error("Error loading deposits:", error);
      toast({
        title: "Error",
        description: "Failed to load security deposit records",
        variant: "destructive",
      });
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

  const exportLedger = () => {
    const csvContent = [
      ["Owner", "Amount", "Return Date", "Return Method", "Notes"].join(","),
      ...deposits.map(d => [
        `"${d.owner_name}"`,
        d.amount,
        d.return_date,
        d.return_method || "",
        `"${d.notes || ""}"`,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-deposit-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    totalRecords: deposits.length,
    totalReturned: deposits.reduce((sum, d) => sum + (d.amount || 0), 0),
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
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.totalRecords}</div>
          <div className="text-sm text-muted-foreground">Total Returns</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalReturned)}</div>
          <div className="text-sm text-muted-foreground">Total Returned</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Security Deposit Returns</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportLedger}>
            <Download className="h-4 w-4 mr-2" />
            Export Ledger
          </Button>
        </div>
      </div>

      {/* Table */}
      {deposits.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Deposit Records</h3>
          <p className="text-muted-foreground">Security deposit return records will appear here</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Return Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.map((deposit) => (
                <TableRow key={deposit.id}>
                  <TableCell className="font-medium">{deposit.owner_name}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(deposit.amount || 0)}
                  </TableCell>
                  <TableCell>
                    {deposit.return_date
                      ? format(new Date(deposit.return_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="capitalize">{deposit.return_method || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {deposit.notes || "-"}
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
