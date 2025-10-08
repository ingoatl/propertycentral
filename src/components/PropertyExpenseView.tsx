import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Expense } from "@/types";
import { Calendar as CalendarIcon, Trash2, Eye, ChevronLeft } from "lucide-react";
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

  // Group expenses by month
  const expensesByMonth = expenses.reduce((acc, expense) => {
    const date = new Date(expense.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  // Sort months in descending order
  const sortedMonths = Object.keys(expensesByMonth).sort((a, b) => b.localeCompare(a));

  const getMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getMonthTotal = (monthKey: string) => {
    return expensesByMonth[monthKey].reduce((sum, exp) => sum + exp.amount, 0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      onExpenseDeleted();
      toast.success("Expense deleted");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error deleting expense:", error);
      }
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
              {expensesByMonth[monthKey].map((expense, index) => (
                <div
                  key={expense.id}
                  onClick={() => {
                    setSelectedExpense(expense);
                    setIsDetailModalOpen(true);
                  }}
                  className="p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle cursor-pointer group"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {new Date(expense.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                      {expense.vendor && (
                        <p className="text-sm font-semibold text-foreground">
                          {expense.vendor}
                        </p>
                      )}
                      {expense.purpose && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {expense.purpose}
                        </p>
                      )}
                      {expense.filePath && (
                        <ExpenseDocumentLink filePath={expense.filePath} />
                      )}
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
              ))}
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
