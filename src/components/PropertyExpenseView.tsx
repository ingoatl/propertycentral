import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Expense } from "@/types";
import { Calendar as CalendarIcon, Trash2, Eye, ChevronLeft, Search, RotateCcw } from "lucide-react";
import { ExpenseDetailModal } from "@/components/ExpenseDetailModal";
import { ExpenseDocumentLink } from "@/components/ExpenseDocumentLink";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PropertyExpenseViewProps {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  expenses: Expense[];
  onBack: () => void;
  onExpenseDeleted: () => void;
}

export const PropertyExpenseView = ({
  propertyId,
  propertyName,
  propertyAddress,
  expenses,
  onBack,
  onExpenseDeleted,
}: PropertyExpenseViewProps) => {
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [billedFilter, setBilledFilter] = useState<"all" | "billed" | "unbilled">("all");

  // Filter expenses based on search term and billed status
  const filteredExpenses = expenses.filter((expense) => {
    // Billed filter
    if (billedFilter === "billed" && !expense.exported) return false;
    if (billedFilter === "unbilled" && expense.exported) return false;
    
    // Search filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      expense.vendor?.toLowerCase().includes(search) ||
      expense.purpose?.toLowerCase().includes(search) ||
      expense.itemsDetail?.toLowerCase().includes(search) ||
      expense.category?.toLowerCase().includes(search) ||
      expense.orderNumber?.toLowerCase().includes(search) ||
      expense.amount.toString().includes(search) ||
      new Date(expense.date).toLocaleDateString().toLowerCase().includes(search) ||
      expense.lineItems?.items?.some(item => item.name.toLowerCase().includes(search))
    );
  });

  // Group expenses with returns linked to parents
  const groupedExpenses = filteredExpenses.reduce((acc, expense) => {
    // Skip returns, they'll be displayed with their parent
    if (expense.isReturn && expense.parentExpenseId) {
      return acc;
    }
    acc.push({
      ...expense,
      returns: filteredExpenses.filter(e => e.parentExpenseId === expense.id && e.isReturn)
    });
    return acc;
  }, [] as (Expense & { returns: Expense[] })[]);

  // Group expenses by month
  const expensesByMonth = groupedExpenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(expense);
    return acc;
  }, {} as Record<string, (Expense & { returns: Expense[] })[]>);

  // Sort months in descending order
  const sortedMonths = Object.keys(expensesByMonth).sort((a, b) => b.localeCompare(a));

  const getMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getMonthTotal = (monthKey: string) => {
    return expensesByMonth[monthKey].reduce((sum, exp) => {
      const returnTotal = exp.returns.reduce((rSum, r) => rSum + r.amount, 0);
      return sum + exp.amount + returnTotal;
    }, 0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      // Check if expense is in any reconciliation line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("reconciliation_line_items")
        .select("id, reconciliation_id, reconciliation:monthly_reconciliations(status)")
        .eq("item_type", "expense")
        .eq("item_id", id);

      if (lineItemsError) throw lineItemsError;

      // Check if any are in approved/sent reconciliations
      const inApprovedRecon = lineItems?.some((item: any) => 
        item.reconciliation?.status === "approved" || 
        item.reconciliation?.status === "statement_sent"
      );

      if (inApprovedRecon) {
        toast.error("Cannot delete: This expense is in an approved reconciliation. Please contact admin.");
        return;
      }

      // Delete from reconciliation line items first (if in draft reconciliations)
      if (lineItems && lineItems.length > 0) {
        const { error: deleteLineItemsError } = await supabase
          .from("reconciliation_line_items")
          .delete()
          .eq("item_type", "expense")
          .eq("item_id", id);

        if (deleteLineItemsError) throw deleteLineItemsError;
      }

      // Delete the expense
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Expense deleted");
      
      // Refresh the data from parent
      await onExpenseDeleted();
    } catch (error: any) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Back to Properties
        </Button>
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="text-2xl">{propertyName}</CardTitle>
          <p className="text-sm text-muted-foreground">{propertyAddress}</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={billedFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setBilledFilter("all")}
            >
              All Expenses
            </Button>
            <Button
              variant={billedFilter === "billed" ? "default" : "outline"}
              size="sm"
              onClick={() => setBilledFilter("billed")}
            >
              Billed Only
            </Button>
            <Button
              variant={billedFilter === "unbilled" ? "default" : "outline"}
              size="sm"
              onClick={() => setBilledFilter("unbilled")}
            >
              Unbilled Only
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search expenses by vendor, purpose, items, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {sortedMonths.map((monthKey) => (
        <Card key={monthKey} className="shadow-card border-border/50">
          <CardHeader className="bg-gradient-subtle rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{getMonthLabel(monthKey)}</CardTitle>
              <div className="text-2xl font-bold text-red-600 dark:text-red-500">
                ${getMonthTotal(monthKey).toFixed(2)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {expensesByMonth[monthKey].map((expense, index) => {
                const netAmount = expense.amount + expense.returns.reduce((sum, r) => sum + r.amount, 0);
                const hasReturns = expense.returns.length > 0;
                
                return (
                  <div key={expense.id} className="space-y-2">
                    {/* Main Expense */}
                    <div
                      onClick={() => {
                        setSelectedExpense(expense);
                        setIsDetailModalOpen(true);
                      }}
                      className="p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle cursor-pointer group"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <CalendarIcon className="w-3.5 h-3.5" />
                              {new Date(expense.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                            {expense.exported && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                Billed
                              </Badge>
                            )}
                          </div>
                          {expense.vendor && (
                            <p className="text-sm font-semibold text-foreground max-md:text-base">
                              {expense.vendor}
                            </p>
                          )}
                          
                          {/* Line Items Display */}
                          {expense.lineItems?.items && expense.lineItems.items.length > 0 ? (
                            <div className="mt-2 space-y-1 max-md:mt-3 max-md:space-y-2">
                              <p className="text-xs font-medium text-muted-foreground max-md:text-sm">Items:</p>
                              <div className="space-y-0.5 max-md:space-y-1">
                                {expense.lineItems.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-start gap-2 text-xs max-md:text-base">
                                    <span className="flex-1 text-foreground">{item.name}</span>
                                    <span className="font-semibold text-foreground whitespace-nowrap">
                                      ${item.price.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                                <div className="flex justify-between items-center gap-2 pt-1 mt-1 border-t text-xs max-md:text-base max-md:pt-2 max-md:mt-2">
                                  <span className="font-semibold text-foreground">Subtotal</span>
                                  <span className="font-bold text-red-600 dark:text-red-500 max-md:text-lg">
                                    ${expense.amount.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : expense.itemsDetail ? (
                            <div className="mt-2 space-y-1 max-md:mt-3 max-md:space-y-2">
                              <p className="text-xs font-medium text-muted-foreground max-md:text-sm">Items:</p>
                              <div className="space-y-0.5 max-md:space-y-1">
                                {expense.itemsDetail.split(',').map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs max-md:text-base">
                                    <span className="text-muted-foreground">•</span>
                                    <span className="flex-1 text-foreground">{item.trim()}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center gap-2 pt-1 mt-1 border-t text-xs max-md:text-base max-md:pt-2 max-md:mt-2">
                                <span className="font-semibold text-foreground">Subtotal</span>
                                <span className="font-bold text-red-600 dark:text-red-500 max-md:text-lg">
                                  ${expense.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ) : expense.purpose ? (
                            <div className="mt-2 max-md:mt-3">
                              <p className="text-xs text-muted-foreground line-clamp-2 max-md:text-sm max-md:line-clamp-3">
                                {expense.purpose}
                              </p>
                              <div className="flex justify-between items-center gap-2 pt-1 mt-1 border-t text-xs max-md:text-base max-md:pt-2 max-md:mt-2">
                                <span className="font-semibold text-foreground">Subtotal</span>
                                <span className="font-bold text-red-600 dark:text-red-500 max-md:text-lg">
                                  ${expense.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                            ${expense.amount.toFixed(2)}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedExpense(expense);
                                setIsDetailModalOpen(true);
                              }}
                              className="hover:bg-primary/10"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(expense.id);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Returns linked to this expense */}
                    {hasReturns && expense.returns.map((returnExpense) => (
                      <div
                        key={returnExpense.id}
                        onClick={() => {
                          setSelectedExpense(returnExpense);
                          setIsDetailModalOpen(true);
                        }}
                        className="ml-6 p-4 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 rounded-lg hover:shadow-card transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <RotateCcw className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                              <p className="text-sm font-semibold text-orange-800 dark:text-orange-400">Return/Refund</p>
                              <Badge variant="outline" className="text-xs border-orange-400 text-orange-700 dark:text-orange-400">
                                {new Date(returnExpense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </Badge>
                            </div>
                            {returnExpense.returnReason && (
                              <p className="text-xs text-muted-foreground ml-6">
                                Reason: {returnExpense.returnReason}
                              </p>
                            )}
                            {returnExpense.lineItems?.items && returnExpense.lineItems.items.length > 0 && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {returnExpense.lineItems.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-start gap-2 text-xs">
                                    <span className="flex-1">{item.name}</span>
                                    <span className="font-semibold text-orange-700 dark:text-orange-400">
                                      ${Math.abs(item.price).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-500">
                              -${Math.abs(returnExpense.amount).toFixed(2)}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(returnExpense.id);
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Net Total if there are returns */}
                    {hasReturns && (
                      <div className="ml-6 p-3 bg-muted/50 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold">Net for Order #{expense.orderNumber || 'N/A'}</span>
                          <span className="text-lg font-bold text-green-600 dark:text-green-500">
                            ${netAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <ExpenseDetailModal
        expense={selectedExpense}
        propertyName={propertyName}
        propertyAddress={propertyAddress}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
      />
    </div>
  );
};