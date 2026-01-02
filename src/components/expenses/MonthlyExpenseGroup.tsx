import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Expense } from "@/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ExpenseListItem } from "./ExpenseListItem";

interface MonthlyExpenseGroupProps {
  monthKey: string;
  expenses: (Expense & { returns: Expense[] })[];
  defaultOpen?: boolean;
  onViewExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string, expense: Expense) => void;
}

export const MonthlyExpenseGroup = ({
  monthKey,
  expenses,
  defaultOpen = false,
  onViewExpense,
  onDeleteExpense,
}: MonthlyExpenseGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getMonthTotal = () => {
    return expenses.reduce((sum, exp) => {
      const returnTotal = exp.returns.reduce((rSum, r) => rSum + r.amount, 0);
      return sum + exp.amount + returnTotal;
    }, 0);
  };

  const billedCount = expenses.filter(e => e.exported === true).length;
  const total = getMonthTotal();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 p-0">
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-foreground">
                    {getMonthLabel(monthKey)}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {expenses.length} transaction{expenses.length !== 1 ? 's' : ''}
                    {billedCount > 0 && (
                      <span className="text-green-600 dark:text-green-500 ml-2">
                        • {billedCount} billed
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-3 md:px-5 pb-4 md:pb-5">
            <div className="space-y-2">
              {expenses.map((expense) => (
                <ExpenseListItem
                  key={expense.id}
                  expense={expense}
                  onView={onViewExpense}
                  onDelete={onDeleteExpense}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
