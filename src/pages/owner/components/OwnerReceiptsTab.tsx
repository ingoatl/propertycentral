import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Receipt,
  Search,
  Filter,
  Download,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OwnerReceiptViewer } from "./OwnerReceiptViewer";

interface Expense {
  id: string;
  date: string;
  amount: number;
  purpose: string | null;
  vendor: string | null;
  category: string | null;
  file_path: string | null;
  original_receipt_path: string | null;
  email_screenshot_path?: string | null;
}

interface OwnerReceiptsTabProps {
  expenses: Expense[];
  propertyId: string;
  token?: string;
}

interface MonthGroup {
  monthKey: string;
  monthLabel: string;
  expenses: Expense[];
  total: number;
  receiptsCount: number;
}

export function OwnerReceiptsTab({ expenses, propertyId, token }: OwnerReceiptsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewingReceipt, setViewingReceipt] = useState<Expense | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Get unique categories and vendors for filters
  const categories = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach(e => e.category && cats.add(e.category));
    return Array.from(cats).sort();
  }, [expenses]);

  const vendors = useMemo(() => {
    const vends = new Set<string>();
    expenses.forEach(e => e.vendor && vends.add(e.vendor));
    return Array.from(vends).sort();
  }, [expenses]);

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.purpose?.toLowerCase().includes(query)) ||
        (e.vendor?.toLowerCase().includes(query)) ||
        (e.category?.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter(e => e.category === categoryFilter);
    }

    // Vendor filter
    if (vendorFilter !== "all") {
      result = result.filter(e => e.vendor === vendorFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      } else {
        return sortOrder === "desc" ? b.amount - a.amount : a.amount - b.amount;
      }
    });

    return result;
  }, [expenses, searchQuery, categoryFilter, vendorFilter, sortBy, sortOrder]);

  // Group expenses by month
  const monthGroups = useMemo(() => {
    const groups = new Map<string, MonthGroup>();
    
    filteredExpenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = format(date, "yyyy-MM");
      const monthLabel = format(date, "MMMM yyyy");
      
      if (!groups.has(monthKey)) {
        groups.set(monthKey, {
          monthKey,
          monthLabel,
          expenses: [],
          total: 0,
          receiptsCount: 0,
        });
      }
      
      const group = groups.get(monthKey)!;
      group.expenses.push(expense);
      group.total += expense.amount;
      if (expense.email_screenshot_path || expense.file_path || expense.original_receipt_path) {
        group.receiptsCount++;
      }
    });

    // Sort by month descending
    return Array.from(groups.values()).sort((a, b) => 
      b.monthKey.localeCompare(a.monthKey)
    );
  }, [filteredExpenses]);

  // Auto-expand first 3 months
  useMemo(() => {
    if (expandedMonths.size === 0 && monthGroups.length > 0) {
      const initialExpanded = new Set(monthGroups.slice(0, 3).map(g => g.monthKey));
      setExpandedMonths(initialExpanded);
    }
  }, [monthGroups.length]);

  // Calculate totals
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const receiptsWithFiles = filteredExpenses.filter(e => e.email_screenshot_path || e.file_path || e.original_receipt_path).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleDownloadReceipt = async (expense: Expense) => {
    const receiptPath = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;
    if (!receiptPath) {
      toast.error("No receipt file available");
      return;
    }

    // Check if it's an HTML file - open in viewer instead of downloading
    const isHtml = receiptPath.toLowerCase().endsWith('.html') || receiptPath.toLowerCase().endsWith('.htm');
    if (isHtml) {
      setViewingReceipt(expense);
      toast.info("Opening HTML receipt in viewer");
      return;
    }

    setDownloadingId(expense.id);
    try {
      // Use edge function to bypass RLS
      const { data, error } = await supabase.functions.invoke("owner-receipt-url", {
        body: { expenseId: expense.id, token, filePath: receiptPath },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      // Fetch the file as blob to avoid browser blocking
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Failed to fetch file");
      
      const blob = await response.blob();
      
      // Check content type - if HTML, open in viewer instead
      if (blob.type.includes('html') || blob.type.includes('text')) {
        setViewingReceipt(expense);
        toast.info("Opening receipt in viewer");
        return;
      }
      
      const blobUrl = URL.createObjectURL(blob);
      
      // For PDFs and images, open in new tab for better viewing
      const isPdf = blob.type === 'application/pdf' || receiptPath.toLowerCase().endsWith('.pdf');
      const isImage = blob.type.startsWith('image/');
      
      if (isPdf || isImage) {
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        toast.success("Receipt opened in new tab");
      } else {
        // For other files, download
        const filename = receiptPath.split('/').pop() || `receipt-${expense.id}`;
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        toast.success("Receipt downloaded");
      }
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download receipt");
    } finally {
      setDownloadingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setVendorFilter("all");
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || vendorFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-background to-muted/50 border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Expenses</p>
                <p className="text-2xl font-bold tracking-tight">{filteredExpenses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-muted/50 border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Amount</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-muted/50 border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">With Receipts</p>
                <p className="text-2xl font-bold tracking-tight">{receiptsWithFiles} / {filteredExpenses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(vendor => (
                  <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
              const [by, order] = val.split("-") as ["date" | "amount", "asc" | "desc"];
              setSortBy(by);
              setSortOrder(order);
            }}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest First</SelectItem>
                <SelectItem value="date-asc">Oldest First</SelectItem>
                <SelectItem value="amount-desc">Highest Amount</SelectItem>
                <SelectItem value="amount-asc">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Receipts List Grouped by Month */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-background border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Expense Receipts by Month
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {monthGroups.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No expenses found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {monthGroups.map((group) => (
                <Collapsible 
                  key={group.monthKey} 
                  open={expandedMonths.has(group.monthKey)}
                  onOpenChange={() => toggleMonth(group.monthKey)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        {expandedMonths.has(group.monthKey) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">{group.monthLabel}</p>
                          <p className="text-sm text-muted-foreground">
                            {group.expenses.length} expense{group.expenses.length !== 1 ? 's' : ''} • {group.receiptsCount} receipt{group.receiptsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold text-lg">{formatCurrency(group.total)}</p>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="divide-y border-t bg-muted/10">
                      {group.expenses.map((expense) => {
                        const hasReceipt = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;
                        return (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between p-4 pl-16 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                hasReceipt ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
                              }`}>
                                {hasReceipt ? <FileText className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate text-sm">
                                  {expense.purpose || expense.category || "Expense"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{format(new Date(expense.date), "MMM d")}</span>
                                  {expense.vendor && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">{expense.vendor}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {expense.category && (
                                <Badge variant="secondary" className="hidden md:flex text-xs">
                                  {expense.category}
                                </Badge>
                              )}
                              <p className="font-mono font-semibold">
                                {formatCurrency(expense.amount)}
                              </p>
                              <div className="flex gap-1">
                                {hasReceipt && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingReceipt(expense);
                                      }}
                                      className="h-8 w-8"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadReceipt(expense);
                                      }}
                                      disabled={downloadingId === expense.id}
                                      className="h-8 w-8"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Viewer Modal */}
      {viewingReceipt && (
        <OwnerReceiptViewer
          expense={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          token={token}
        />
      )}
    </div>
  );
}
