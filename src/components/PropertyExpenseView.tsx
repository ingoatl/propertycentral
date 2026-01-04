import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Expense } from "@/types";
import { ChevronLeft, Search } from "lucide-react";
import { ExpenseDetailModal } from "@/components/ExpenseDetailModal";
import { DeleteExpenseDialog } from "@/components/expenses/DeleteExpenseDialog";
import { ExpenseSummaryCard } from "@/components/expenses/ExpenseSummaryCard";
import { MonthlyExpenseGroup } from "@/components/expenses/MonthlyExpenseGroup";

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
  const [deleteExpense, setDeleteExpense] = useState<{ id: string; description: string; amount: number } | null>(null);

  // Filter expenses based on search term and billed status
  const filteredExpenses = expenses.filter((expense) => {
    // Exclude visit-related expenses (legacy data cleanup)
    if (expense.category === "Visit Charges") return false;
    if (expense.purpose?.toLowerCase().includes("visit fee")) return false;
    if (expense.purpose?.toLowerCase().includes("hourly charges")) return false;
    
    // Check if expense is in any approved or statement_sent reconciliation
    const isBilled = expense.exported === true;
    
    // Billed filter
    if (billedFilter === "billed" && !isBilled) return false;
    if (billedFilter === "unbilled" && isBilled) return false;
    
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

  // Get current month key for default open
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleDelete = async (id: string, expense: Expense) => {
    // Always use the delete dialog with reason logging
    const description = expense.vendor 
      ? `${expense.vendor} - ${expense.purpose || 'Expense'}`
      : expense.purpose || 'Expense';
    setDeleteExpense({ 
      id, 
      description,
      amount: expense.amount
    });
  };

  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header with Back Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">{propertyName}</h1>
            <p className="text-sm text-muted-foreground">{propertyAddress}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <ExpenseSummaryCard expenses={filteredExpenses} propertyName={propertyName} />

      {/* Filters & Search */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={billedFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setBilledFilter("all")}
                className="text-xs md:text-sm"
              >
                All
              </Button>
              <Button
                variant={billedFilter === "billed" ? "default" : "outline"}
                size="sm"
                onClick={() => setBilledFilter("billed")}
                className="text-xs md:text-sm"
              >
                Billed
              </Button>
              <Button
                variant={billedFilter === "unbilled" ? "default" : "outline"}
                size="sm"
                onClick={() => setBilledFilter("unbilled")}
                className="text-xs md:text-sm"
              >
                Unbilled
              </Button>
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search by vendor, items, amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense List by Month */}
      {sortedMonths.length > 0 ? (
        <div className="space-y-3">
          {sortedMonths.map((monthKey, index) => (
            <MonthlyExpenseGroup
              key={monthKey}
              monthKey={monthKey}
              expenses={expensesByMonth[monthKey]}
              defaultOpen={monthKey === currentMonthKey || index === 0}
              onViewExpense={handleViewExpense}
              onDeleteExpense={handleDelete}
            />
          ))}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No expenses found matching your criteria.</p>
          </CardContent>
        </Card>
      )}

      <ExpenseDetailModal
        expense={selectedExpense}
        propertyName={propertyName}
        propertyAddress={propertyAddress}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
      />

      <DeleteExpenseDialog
        open={!!deleteExpense}
        onOpenChange={(open) => !open && setDeleteExpense(null)}
        expenseId={deleteExpense?.id || ""}
        expenseDescription={deleteExpense?.description || ""}
        expenseAmount={deleteExpense?.amount}
        onDeleted={onExpenseDeleted}
      />
    </div>
  );
};