import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { RefreshCw, Receipt, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ReceiptViewer } from "./ReceiptViewer";
import { getExpenseDisplayName, hasReceipt } from "@/lib/expense-utils";

interface ExpenseRecord {
  id: string;
  date: string;
  amount: number;
  vendor: string | null;
  purpose: string | null;
  category: string | null;
  order_number: string | null;
  file_path: string | null;
  email_screenshot_path: string | null;
  original_receipt_path: string | null;
  items_detail: string | null;
  property_id: string;
  property_name?: string;
  property_address?: string;
  property_type?: string;
  created_at: string;
}

interface VisitRecord {
  id: string;
  date: string;
  time: string | null;
  price: number;
  hours: number | null;
  visited_by: string | null;
  notes: string | null;
  receipt_path: string | null;
  property_id: string;
  property_name?: string;
  property_address?: string;
}

export function InvoiceArchiveTab() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [propertyView, setPropertyView] = useState<"managed" | "owned">("managed");
  const [activeTab, setActiveTab] = useState<"expenses" | "visits">("expenses");
  const [properties, setProperties] = useState<{ id: string; name: string; address: string; property_type: string }[]>([]);
  const [generatingReceipts, setGeneratingReceipts] = useState(false);
  const [generatingVisitReceipt, setGeneratingVisitReceipt] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [propertyFilter, propertyView]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties for filter - include address and type
      const { data: propData } = await supabase
        .from("properties")
        .select("id, name, address, property_type")
        .is("offboarded_at", null)
        .order("address");

      setProperties(propData || []);

      // Filter properties by type for the dropdown
      const filteredPropertyIds = (propData || [])
        .filter((p) => {
          if (propertyView === "managed") {
            return p.property_type === "Client-Managed";
          } else {
            return p.property_type === "Company-Owned";
          }
        })
        .map((p) => p.id);

      // Load expenses with receipts
      let expenseQuery = supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .limit(500);

      if (filteredPropertyIds.length > 0) {
        expenseQuery = expenseQuery.in("property_id", filteredPropertyIds);
      } else {
        setExpenses([]);
        setVisits([]);
        setLoading(false);
        return;
      }

      if (propertyFilter !== "all") {
        expenseQuery = expenseQuery.eq("property_id", propertyFilter);
      }

      const { data: expenseData, error } = await expenseQuery;
      if (error) throw error;

      // Load visits
      let visitQuery = supabase
        .from("visits")
        .select("id, date, time, price, hours, visited_by, notes, receipt_path, property_id")
        .order("date", { ascending: false })
        .limit(500);

      if (filteredPropertyIds.length > 0) {
        visitQuery = visitQuery.in("property_id", filteredPropertyIds);
      }

      if (propertyFilter !== "all") {
        visitQuery = visitQuery.eq("property_id", propertyFilter);
      }

      const { data: visitData } = await visitQuery;

      // Enrich with property info
      const enrichedExpenses = (expenseData || []).map((exp) => {
        const prop = propData?.find((p) => p.id === exp.property_id);
        return {
          ...exp,
          property_name: prop?.name || "Unknown",
          property_address: prop?.address || "Unknown",
          property_type: prop?.property_type || "Unknown",
        };
      });

      const enrichedVisits = (visitData || []).map((visit) => {
        const prop = propData?.find((p) => p.id === visit.property_id);
        return {
          ...visit,
          property_name: prop?.name || "Unknown",
          property_address: prop?.address || "Unknown",
        };
      });

      setExpenses(enrichedExpenses);
      setVisits(enrichedVisits);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load invoice archive");
    } finally {
      setLoading(false);
    }
  };

  const generateAllVisitReceipts = async () => {
    setGeneratingReceipts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-generate-visit-receipts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate receipts");
      }

      toast.success(`Generated ${result.generated} visit receipts`);
      loadData(); // Refresh
    } catch (error: unknown) {
      console.error("Error generating receipts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate receipts");
    } finally {
      setGeneratingReceipts(false);
    }
  };

  const generateSingleVisitReceipt = async (visitId: string) => {
    setGeneratingVisitReceipt(visitId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-visit-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ visitId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate receipt");
      }

      toast.success("Visit receipt generated");
      loadData();
    } catch (error: unknown) {
      console.error("Error generating receipt:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate receipt");
    } finally {
      setGeneratingVisitReceipt(null);
    }
  };

  // Get properties filtered by current view for dropdown
  const filteredProperties = properties.filter((p) => {
    if (propertyView === "managed") {
      return p.property_type === "Client-Managed";
    } else {
      return p.property_type === "Company-Owned";
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Stats calculation now includes original receipts - using imported utility
  const filteredExpenses = expenses.filter((exp) =>
    exp.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.property_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVisits = visits.filter((v) =>
    v.visited_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.property_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const expenseStats = {
    total: filteredExpenses.length,
    totalAmount: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    withReceipts: filteredExpenses.filter((e) => hasReceipt(e)).length,
    withoutReceipts: filteredExpenses.filter((e) => !hasReceipt(e)).length,
  };

  const visitStats = {
    total: filteredVisits.length,
    totalAmount: filteredVisits.reduce((sum, v) => sum + v.price, 0),
    withReceipts: filteredVisits.filter((v) => !!v.receipt_path).length,
    withoutReceipts: filteredVisits.filter((v) => !v.receipt_path).length,
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
      {/* Managed/Owned Toggle */}
      <Tabs value={propertyView} onValueChange={(v) => {
        setPropertyView(v as "managed" | "owned");
        setPropertyFilter("all");
      }}>
        <TabsList>
          <TabsTrigger value="managed">Managed Properties</TabsTrigger>
          <TabsTrigger value="owned">Owned Properties</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Expenses / Visits Toggle */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "expenses" | "visits")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="h-4 w-4" />
              Expenses ({expenseStats.total})
            </TabsTrigger>
            <TabsTrigger value="visits" className="gap-2">
              <FileText className="h-4 w-4" />
              Visits ({visitStats.total})
            </TabsTrigger>
          </TabsList>
          {activeTab === "visits" && visitStats.withoutReceipts > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={generateAllVisitReceipts}
              disabled={generatingReceipts}
            >
              {generatingReceipts ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate All Missing ({visitStats.withoutReceipts})
            </Button>
          )}
        </div>

        <TabsContent value="expenses" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Invoices</div>
              <div className="text-2xl font-bold">{expenseStats.total}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="text-2xl font-bold">{formatCurrency(expenseStats.totalAmount)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">With Receipts</div>
              <div className="text-2xl font-bold text-green-600">{expenseStats.withReceipts}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Missing Receipts</div>
              <div className="text-2xl font-bold text-amber-600">{expenseStats.withoutReceipts}</div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search vendor, purpose, order #, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {filteredProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.address}
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
                      <TableCell className="max-w-[200px] truncate" title={exp.property_address}>
                        {exp.property_address}
                      </TableCell>
                      <TableCell>{exp.vendor || "-"}</TableCell>
                      <TableCell className="max-w-[250px]" title={exp.purpose || exp.items_detail || ""}>
                        <span className="line-clamp-2">
                          {getExpenseDisplayName({
                            items_detail: exp.items_detail,
                            purpose: exp.purpose,
                            category: exp.category,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {exp.order_number || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(exp.amount)}
                      </TableCell>
                      <TableCell>
                        <ReceiptViewer
                          filePath={exp.file_path}
                          emailScreenshotPath={exp.email_screenshot_path}
                          originalReceiptPath={exp.original_receipt_path}
                          expenseDescription={exp.items_detail || exp.purpose}
                          vendor={exp.vendor || undefined}
                          amount={exp.amount}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="visits" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Visits</div>
              <div className="text-2xl font-bold">{visitStats.total}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="text-2xl font-bold">{formatCurrency(visitStats.totalAmount)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">With Receipts</div>
              <div className="text-2xl font-bold text-green-600">{visitStats.withReceipts}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Missing Receipts</div>
              <div className="text-2xl font-bold text-amber-600">{visitStats.withoutReceipts}</div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search visitor, notes, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {filteredProperties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.address}
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

          {filteredVisits.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Visits Found</h3>
              <p className="text-muted-foreground">
                Property visits and receipts will appear here.
              </p>
            </Card>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Visited By</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">
                        {format(new Date(visit.date), "MMM d, yyyy")}
                        {visit.time && (
                          <span className="text-muted-foreground text-sm ml-1">
                            {visit.time}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={visit.property_address}>
                        {visit.property_address}
                      </TableCell>
                      <TableCell>{visit.visited_by || "-"}</TableCell>
                      <TableCell>{visit.hours ? `${visit.hours}h` : "-"}</TableCell>
                      <TableCell className="max-w-[200px]" title={visit.notes || ""}>
                        <span className="line-clamp-2">{visit.notes || "-"}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(visit.price)}
                      </TableCell>
                      <TableCell>
                        {visit.receipt_path ? (
                          <ReceiptViewer
                            filePath={visit.receipt_path}
                            expenseDescription={`Property visit${visit.visited_by ? ` by ${visit.visited_by}` : ""}`}
                            vendor="PeachHaus"
                            amount={visit.price}
                          />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateSingleVisitReceipt(visit.id)}
                            disabled={generatingVisitReceipt === visit.id}
                          >
                            {generatingVisitReceipt === visit.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-1" />
                            )}
                            Generate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
