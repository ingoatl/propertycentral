import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, TrendingUp, Calendar } from "lucide-react";
import { Expense } from "@/types";

interface ExpenseSummaryCardProps {
  expenses: Expense[];
  propertyName: string;
}

export const ExpenseSummaryCard = ({ expenses, propertyName }: ExpenseSummaryCardProps) => {
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expenseCount = expenses.length;
  const avgExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;
  
  const billedCount = expenses.filter(e => e.exported === true).length;
  const unbilledCount = expenseCount - billedCount;

  // Get date range
  const sortedDates = expenses
    .map(e => new Date(e.date))
    .sort((a, b) => a.getTime() - b.getTime());
  const earliestDate = sortedDates[0];
  const latestDate = sortedDates[sortedDates.length - 1];

  const dateRange = earliestDate && latestDate
    ? `${earliestDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${latestDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : 'No expenses';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {/* Total Expenses */}
      <Card className="border-border/50">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Total Expenses</p>
              <p className="text-lg md:text-xl font-bold text-foreground truncate">
                ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Count */}
      <Card className="border-border/50">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/50">
              <Receipt className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Transactions</p>
              <p className="text-lg md:text-xl font-bold text-foreground">
                {expenseCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Expense */}
      <Card className="border-border/50">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/50">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Avg per Transaction</p>
              <p className="text-lg md:text-xl font-bold text-foreground truncate">
                ${avgExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Status */}
      <Card className="border-border/50">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <div className="flex gap-2 text-xs md:text-sm font-medium">
                <span className="text-green-600 dark:text-green-500">{billedCount} billed</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{unbilledCount} pending</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
