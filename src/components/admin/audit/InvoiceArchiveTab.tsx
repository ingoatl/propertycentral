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
import { RefreshCw, FileText, Download, ExternalLink, Receipt } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ExpenseRecord {
  id: string;
  date: string;
  amount: number;
  vendor: string | null;
  purpose: string | null;
  category: string | null;
  order_number: string | null;
  file_path: string | null;
  property_id: string;
  property_name?: string;
  created_at: string;
}

export function InvoiceArchiveTab() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, [propertyFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties for filter
      const { data: propData } = await supabase
        .from("properties")
        .select("id, name")
        .is("offboarded_at", null)
        .order("name");

      setProperties(propData || []);

      // Load expenses with receipts
      let query = supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .limit(500);

      if (propertyFilter !== "all") {
        query = query.eq("property_id", propertyFilter);
      }

      const { data: expenseData, error } = await query;
      if (error) throw error;

      // Enrich with property names
      const enrichedExpenses = (expenseData || []).map((exp) => ({
        ...exp,
        property_name: propData?.find((p) => p.id === exp.property_id)?.name || "Unknown",
      }));

      setExpenses(enrichedExpenses);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast.error("Failed to load invoice archive");
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

  const downloadReceipt = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Failed to download receipt");
    }
  };

  const filteredExpenses = expenses.filter((exp) =>
    exp.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.property_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: filteredExpenses.length,
    totalAmount: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    withReceipts: filteredExpenses.filter((e) => e.file_path).length,
    withoutReceipts: filteredExpenses.filter((e) => !e.file_path).length,
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
          <div className="text-sm text-muted-foreground">Total Invoices</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Amount</div>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">With Receipts</div>
          <div className="text-2xl font-bold text-green-600">{stats.withReceipts}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Missing Receipts</div>
          <div className="text-2xl font-bold text-amber-600">{stats.withoutReceipts}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder="Search vendor, purpose, order #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((prop) => (
                <SelectItem key={prop.id} value={prop.id}>
                  {prop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {filteredExpenses.length === 0 ? (
        <Card className="p-8 text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
          <p className="text-muted-foreground">
            Expense invoices and receipts will appear here.
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell className="font-medium">
                    {format(new Date(exp.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {exp.property_name}
                  </TableCell>
                  <TableCell>{exp.vendor || "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {exp.purpose || exp.category || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {exp.order_number || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(exp.amount)}
                  </TableCell>
                  <TableCell>
                    {exp.file_path ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadReceipt(exp.file_path!)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        Missing
                      </Badge>
                    )}
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
