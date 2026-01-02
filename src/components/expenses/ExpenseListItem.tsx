import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Expense } from "@/types";
import { MoreVertical, Eye, Trash2, ChevronDown, RotateCcw, FileText } from "lucide-react";
import { ExpenseDocumentLink } from "@/components/ExpenseDocumentLink";

interface ExpenseListItemProps {
  expense: Expense & { returns: Expense[] };
  onView: (expense: Expense) => void;
  onDelete: (id: string, expense: Expense) => void;
}

export const ExpenseListItem = ({ expense, onView, onDelete }: ExpenseListItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasReturns = expense.returns.length > 0;
  const hasDetails = expense.lineItems?.items?.length || expense.itemsDetail || expense.purpose;
  const netAmount = expense.amount + expense.returns.reduce((sum, r) => sum + r.amount, 0);

  const displayName = expense.vendor || expense.purpose?.slice(0, 40) || "Expense";
  const hasReceipt = expense.filePath || expense.emailScreenshotPath;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border border-border/40 rounded-lg overflow-hidden hover:border-border transition-colors bg-card">
        {/* Compact Row */}
        <div className="flex items-center gap-2 md:gap-4 p-3 md:p-4">
          {/* Date - Desktop only inline */}
          <div className="hidden md:block w-24 shrink-0">
            <p className="text-sm text-muted-foreground">
              {new Date(expense.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-foreground truncate text-sm md:text-base">
                {displayName}
              </p>
              {expense.exported === true && (
                <Badge variant="outline" className="text-[10px] md:text-xs border-green-500/50 text-green-600 dark:text-green-400 shrink-0">
                  Billed
                </Badge>
              )}
              {hasReturns && (
                <Badge variant="outline" className="text-[10px] md:text-xs border-orange-500/50 text-orange-600 dark:text-orange-400 shrink-0">
                  Has Return
                </Badge>
              )}
              {hasReceipt && (
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
            {/* Mobile date */}
            <p className="md:hidden text-xs text-muted-foreground mt-0.5">
              {new Date(expense.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          </div>

          {/* Category */}
          <div className="hidden lg:block w-28 shrink-0">
            {expense.category && (
              <Badge variant="secondary" className="text-xs font-normal">
                {expense.category}
              </Badge>
            )}
          </div>

          {/* Amount */}
          <div className="text-right shrink-0">
            <p className="font-semibold text-foreground text-sm md:text-base">
              ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            {hasReturns && (
              <p className="text-xs text-green-600 dark:text-green-500">
                Net: ${netAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Expand Button */}
          {hasDetails && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          )}

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(expense)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(expense.id, expense)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expandable Details */}
        <CollapsibleContent>
          <div className="px-3 md:px-4 pb-3 md:pb-4 pt-0 border-t border-border/30">
            <div className="pt-3 space-y-3">
              {/* Line Items */}
              {expense.lineItems?.items && expense.lineItems.items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items</p>
                  <div className="bg-muted/30 rounded-md p-3 space-y-1.5">
                    {expense.lineItems.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-2 text-sm">
                        <span className="text-foreground">{item.name}</span>
                        <span className="font-medium text-foreground whitespace-nowrap">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Detail (text) */}
              {!expense.lineItems?.items?.length && expense.itemsDetail && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items</p>
                  <div className="bg-muted/30 rounded-md p-3">
                    <p className="text-sm text-foreground">{expense.itemsDetail}</p>
                  </div>
                </div>
              )}

              {/* Purpose */}
              {expense.purpose && !expense.lineItems?.items?.length && !expense.itemsDetail && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purpose</p>
                  <p className="text-sm text-foreground">{expense.purpose}</p>
                </div>
              )}

              {/* Receipt Link */}
              {hasReceipt && (
                <div className="flex gap-2">
                  <ExpenseDocumentLink
                    filePath={expense.filePath}
                    emailScreenshotPath={expense.emailScreenshotPath}
                    size="sm"
                  />
                </div>
              )}

              {/* Returns */}
              {hasReturns && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Returns</p>
                  {expense.returns.map((returnExp) => (
                    <div
                      key={returnExp.id}
                      onClick={() => onView(returnExp)}
                      className="flex items-center justify-between gap-3 p-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-md cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500" />
                        <div>
                          <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                            Refund - {new Date(returnExp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          {returnExp.returnReason && (
                            <p className="text-xs text-orange-600 dark:text-orange-400">{returnExp.returnReason}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-semibold text-orange-700 dark:text-orange-400">
                        -${Math.abs(returnExp.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
