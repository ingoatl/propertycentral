import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  DollarSign, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package
} from "lucide-react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FlaggedExpense {
  id: string;
  email_insight_id: string | null;
  property_id: string;
  property_name: string;
  order_number: string | null;
  extracted_amount: number;
  email_subject: string;
  email_date: string;
  expense_exists: boolean;
  expense_amount: number | null;
  discrepancy: string | null;
}

export const ExpenseWatchdogCard = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState("");
  const queryClient = useQueryClient();

  // Fetch email insights that detected expenses but may have issues
  const { data: flaggedItems, isLoading, refetch } = useQuery({
    queryKey: ["expense-watchdog"],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      // Get all email insights with expense_detected = true from last 30 days
      const { data: insights, error } = await supabase
        .from("email_insights")
        .select(`
          id,
          subject,
          email_date,
          property_id,
          expense_detected,
          expense_amount,
          expense_description,
          expense_created
        `)
        .eq("expense_detected", true)
        .gte("email_date", thirtyDaysAgo)
        .order("email_date", { ascending: false });

      if (error) throw error;

      // Get properties for names
      const { data: properties } = await supabase
        .from("properties")
        .select("id, name");

      const propertyMap = new Map(properties?.map(p => [p.id, p.name]) || []);

      // Check each insight for issues
      const flagged: FlaggedExpense[] = [];
      
      for (const insight of insights || []) {
        if (!insight.property_id) continue;

        // Check if expense actually exists
        const { data: expenses } = await supabase
          .from("expenses")
          .select("id, amount, order_number")
          .eq("email_insight_id", insight.id);

        const expense = expenses?.[0];
        const propertyName = propertyMap.get(insight.property_id) || "Unknown";

        // Flag if:
        // 1. expense_detected but no expense created
        // 2. Amount mismatch between insight and actual expense
        const shouldFlag = 
          !expense || 
          (expense && insight.expense_amount && 
           Math.abs(expense.amount - insight.expense_amount) > 0.01);

        if (shouldFlag) {
          flagged.push({
            id: insight.id,
            email_insight_id: insight.id,
            property_id: insight.property_id,
            property_name: propertyName,
            order_number: expense?.order_number || null,
            extracted_amount: insight.expense_amount || 0,
            email_subject: insight.subject,
            email_date: insight.email_date,
            expense_exists: !!expense,
            expense_amount: expense?.amount || null,
            discrepancy: expense 
              ? `Insight: $${insight.expense_amount?.toFixed(2)}, Actual: $${expense.amount.toFixed(2)}`
              : "Expense not created"
          });
        }
      }

      return flagged;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const createMissingExpenseMutation = useMutation({
    mutationFn: async ({ insightId, amount }: { insightId: string; amount: number }) => {
      // Get the insight details
      const { data: insight, error: insightError } = await supabase
        .from("email_insights")
        .select("*")
        .eq("id", insightId)
        .single();

      if (insightError) throw insightError;

      // Create the expense
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          property_id: insight.property_id,
          amount: amount,
          purpose: insight.expense_description || insight.subject,
          date: insight.email_date.split('T')[0],
          email_insight_id: insightId,
          category: "order",
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Update insight
      await supabase
        .from("email_insights")
        .update({ expense_created: true })
        .eq("id", insightId);

      return expense;
    },
    onSuccess: () => {
      toast.success("Expense created successfully");
      queryClient.invalidateQueries({ queryKey: ["expense-watchdog"] });
      setCorrectingId(null);
      setCorrectedAmount("");
    },
    onError: (error) => {
      toast.error("Failed to create expense: " + (error as Error).message);
    },
  });

  const updateExpenseAmountMutation = useMutation({
    mutationFn: async ({ insightId, newAmount }: { insightId: string; newAmount: number }) => {
      // Find the expense
      const { data: expenses, error: findError } = await supabase
        .from("expenses")
        .select("id")
        .eq("email_insight_id", insightId);

      if (findError) throw findError;
      if (!expenses || expenses.length === 0) throw new Error("Expense not found");

      // Update the amount
      const { error: updateError } = await supabase
        .from("expenses")
        .update({ amount: newAmount })
        .eq("id", expenses[0].id);

      if (updateError) throw updateError;

      return expenses[0].id;
    },
    onSuccess: () => {
      toast.success("Expense amount corrected");
      queryClient.invalidateQueries({ queryKey: ["expense-watchdog"] });
      setCorrectingId(null);
      setCorrectedAmount("");
    },
    onError: (error) => {
      toast.error("Failed to update expense: " + (error as Error).message);
    },
  });

  const handleCorrect = (item: FlaggedExpense) => {
    const amount = parseFloat(correctedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (item.expense_exists) {
      updateExpenseAmountMutation.mutate({ insightId: item.id, newAmount: amount });
    } else {
      createMissingExpenseMutation.mutate({ insightId: item.id, amount });
    }
  };

  const flaggedCount = flaggedItems?.length || 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={flaggedCount > 0 ? "border-amber-500" : ""}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${flaggedCount > 0 ? "text-amber-500" : "text-green-500"}`} />
              Expense Watchdog
              {flaggedCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {flaggedCount} issues
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Scanning for issues...</p>
            ) : flaggedCount === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>All expenses verified - no issues detected</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  These expenses need your attention - amounts may be incorrect or expenses weren't created.
                </p>
                {flaggedItems?.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm truncate">
                            {item.property_name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">
                          {item.email_subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.email_date), "MMM d, yyyy")}
                        </p>
                        <div className="mt-2">
                          <Badge variant={item.expense_exists ? "outline" : "destructive"} className="text-xs">
                            {item.discrepancy}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Expected</p>
                          <p className="font-semibold text-amber-600">
                            ${item.extracted_amount.toFixed(2)}
                          </p>
                        </div>
                        
                        {correctingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Correct amount"
                              value={correctedAmount}
                              onChange={(e) => setCorrectedAmount(e.target.value)}
                              className="w-24 h-8 text-sm"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleCorrect(item)}
                              disabled={createMissingExpenseMutation.isPending || updateExpenseAmountMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCorrectingId(null);
                                setCorrectedAmount("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCorrectingId(item.id);
                              setCorrectedAmount(item.extracted_amount.toString());
                            }}
                          >
                            <DollarSign className="w-3 h-3 mr-1" />
                            {item.expense_exists ? "Fix Amount" : "Create Expense"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
