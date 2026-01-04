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
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, CheckCircle, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TrustReconciliation {
  id: string;
  reconciliation_date: string;
  bank_statement_date: string;
  statement_balance: number;
  ledger_balance: number;
  difference: number;
  is_reconciled: boolean;
  notes: string | null;
  document_path: string | null;
  created_at: string;
}

export function TrustAccountTab() {
  const [reconciliations, setReconciliations] = useState<TrustReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadReconciliations();
  }, []);

  const loadReconciliations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trust_account_reconciliations")
        .select("*")
        .order("reconciliation_date", { ascending: false });

      if (error) throw error;
      setReconciliations(data || []);
    } catch (error) {
      console.error("Error loading trust reconciliations:", error);
      toast.error("Failed to load trust account records");
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

  const filteredReconciliations = reconciliations.filter((rec) =>
    rec.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    format(new Date(rec.reconciliation_date), "MMMM yyyy").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: reconciliations.length,
    reconciled: reconciliations.filter((r) => r.is_reconciled).length,
    unreconciled: reconciliations.filter((r) => !r.is_reconciled).length,
    currentBalance: reconciliations[0]?.ledger_balance || 0,
  };

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
          <div className="text-sm text-muted-foreground">Total Records</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Reconciled</div>
          <div className="text-2xl font-bold text-green-600">{stats.reconciled}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{stats.unreconciled}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Current Balance</div>
          <div className="text-2xl font-bold">{formatCurrency(stats.currentBalance)}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Input
          placeholder="Search by month or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReconciliations}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {filteredReconciliations.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Trust Account Records</h3>
          <p className="text-muted-foreground">
            Trust account reconciliation records will appear here once added.
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bank Statement Date</TableHead>
                <TableHead className="text-right">Statement Balance</TableHead>
                <TableHead className="text-right">Ledger Balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReconciliations.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-medium">
                    {format(new Date(rec.reconciliation_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(new Date(rec.bank_statement_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(rec.statement_balance)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(rec.ledger_balance)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${rec.difference !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(rec.difference)}
                  </TableCell>
                  <TableCell>
                    {rec.is_reconciled ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Reconciled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {rec.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">GREC Trust Account Requirements</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Monthly reconciliation of trust account required</li>
          <li>• Bank statement balance must match ledger balance</li>
          <li>• All discrepancies must be documented and resolved</li>
          <li>• Records must be retained for minimum 3 years</li>
        </ul>
      </Card>
    </div>
  );
}
