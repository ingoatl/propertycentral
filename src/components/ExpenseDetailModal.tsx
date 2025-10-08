import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Expense } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Package, Truck, Building2, FileText, Tag } from "lucide-react";

interface ExpenseDetailModalProps {
  expense: Expense | null;
  propertyName: string;
  propertyAddress: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExpenseDetailModal = ({
  expense,
  propertyName,
  propertyAddress,
  open,
  onOpenChange,
}: ExpenseDetailModalProps) => {
  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Expense Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Property Info */}
          <div className="p-4 bg-gradient-subtle rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">{propertyName}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{propertyAddress}</p>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between p-4 bg-gradient-subtle rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="font-semibold">Total Amount</span>
            </div>
            <span className="text-3xl font-bold text-red-600 dark:text-red-500">
              ${expense.amount.toFixed(2)}
            </span>
          </div>

          {/* Order Details */}
          {(expense.orderNumber || expense.vendor || expense.trackingNumber) && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Order Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {expense.orderNumber && (
                  <div className="p-3 bg-gradient-subtle rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Order Number</p>
                    <p className="font-mono font-semibold">{expense.orderNumber}</p>
                  </div>
                )}
                {expense.vendor && (
                  <div className="p-3 bg-gradient-subtle rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Vendor</p>
                    <Badge variant="secondary" className="font-semibold">
                      {expense.vendor}
                    </Badge>
                  </div>
                )}
                {expense.orderDate && (
                  <div className="p-3 bg-gradient-subtle rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Order Date</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(expense.orderDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                )}
                {expense.trackingNumber && (
                  <div className="p-3 bg-gradient-subtle rounded-lg border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Tracking Number</p>
                    <p className="font-mono text-sm flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      {expense.trackingNumber}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expense Date */}
          <div className="p-3 bg-gradient-subtle rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Expense Date</p>
                <p className="font-semibold">
                  {new Date(expense.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Purpose/Items */}
          {(expense.purpose || expense.itemsDetail) && (
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {expense.itemsDetail ? 'Items Purchased' : 'Purpose'}
              </h3>
              <div className="p-4 bg-gradient-subtle rounded-lg border border-border/50 border-l-4 border-l-primary">
                <p className="text-sm whitespace-pre-wrap">
                  {expense.itemsDetail || expense.purpose}
                </p>
              </div>
            </div>
          )}

          {/* Category */}
          {expense.category && (
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Category:</span>
              <Badge variant="outline">{expense.category}</Badge>
            </div>
          )}

          {/* Created Date */}
          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            Added to system: {new Date(expense.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
