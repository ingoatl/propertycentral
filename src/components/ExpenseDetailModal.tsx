import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Expense } from "@/types";
import { Calendar, DollarSign, FileText, MapPin, Package } from "lucide-react";
import { ExpenseDocumentLink } from "./ExpenseDocumentLink";

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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto max-md:max-w-full max-md:h-screen max-md:p-4">
        <DialogHeader>
          <DialogTitle className="text-2xl max-md:text-xl">Expense Details</DialogTitle>
          <DialogDescription className="max-md:text-base">
            Complete information about this expense
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-md:space-y-4">
          {/* Property Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center gap-2 max-md:text-xl">
              <MapPin className="w-4 h-4 max-md:w-5 max-md:h-5" />
              Property
            </h3>
            <div className="pl-6 space-y-1 max-md:pl-7">
              <p className="font-medium max-md:text-lg">{propertyName}</p>
              <p className="text-sm text-muted-foreground max-md:text-base">{propertyAddress}</p>
            </div>
          </div>

          <Separator />

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1 max-md:gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2 max-md:text-lg">
                <DollarSign className="w-4 h-4 max-md:w-5 max-md:h-5" />
                Amount
              </h3>
              <p className="text-3xl font-bold text-red-600 dark:text-red-500 max-md:text-4xl">
                ${expense.amount.toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2 max-md:text-lg">
                <Calendar className="w-4 h-4 max-md:w-5 max-md:h-5" />
                Expense Date
              </h3>
              <p className="text-lg max-md:text-xl">
                {new Date(expense.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Order Details */}
          {(expense.vendor || expense.orderNumber || expense.orderDate) && (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 max-md:text-xl">
                  <Package className="w-4 h-4 max-md:w-5 max-md:h-5" />
                  Order Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 max-md:pl-7 max-md:gap-6">
                  {expense.vendor && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground max-md:text-base">Vendor</p>
                      <p className="font-medium max-md:text-lg">{expense.vendor}</p>
                    </div>
                  )}
                  {expense.orderNumber && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground max-md:text-base">Order Number</p>
                      <p className="font-medium font-mono text-sm max-md:text-base">{expense.orderNumber}</p>
                    </div>
                  )}
                  {expense.orderDate && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Order Date</p>
                      <p className="font-medium">
                        {new Date(expense.orderDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  {expense.trackingNumber && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Tracking Number</p>
                      <p className="font-medium font-mono text-sm">{expense.trackingNumber}</p>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Delivery Address */}
          {expense.deliveryAddress && (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Delivery Address
                </h3>
                <p className="pl-6 text-sm leading-relaxed bg-muted/50 p-3 rounded-lg">
                  {expense.deliveryAddress}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Items Detail */}
          {expense.itemsDetail && (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Items Purchased
                </h3>
                <p className="pl-6 text-sm leading-relaxed">{expense.itemsDetail}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Purpose/Description */}
          {expense.purpose && (
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Description
              </h3>
              <p className="pl-6 text-sm leading-relaxed">{expense.purpose}</p>
            </div>
          )}

          {/* Document Link */}
          {expense.filePath && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold">Attached Document</h3>
                <div className="pl-6">
                  <ExpenseDocumentLink filePath={expense.filePath} />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
