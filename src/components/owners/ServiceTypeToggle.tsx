import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Home, Briefcase, Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export type ServiceType = "cohosting" | "full_service";

interface ServiceTypeToggleProps {
  ownerId: string;
  ownerName: string;
  currentType: ServiceType;
  onSuccess?: () => void;
  compact?: boolean;
}

export const ServiceTypeToggle = ({
  ownerId,
  ownerName,
  currentType,
  onSuccess,
  compact = false,
}: ServiceTypeToggleProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const targetType: ServiceType = currentType === "cohosting" ? "full_service" : "cohosting";

  const handleConfirmSwitch = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("property_owners")
        .update({ service_type: targetType })
        .eq("id", ownerId);

      if (error) throw error;

      toast.success(
        `Switched ${ownerName} to ${targetType === "cohosting" ? "Co-Hosting" : "Full-Service"}`,
        {
          description: targetType === "cohosting"
            ? "Owner will now be charged for services"
            : "Owner will now receive payouts",
        }
      );

      setShowConfirm(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error updating service type:", error);
      toast.error("Failed to update service type: " + (error.message || "Unknown error"));
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowConfirm(true)}
          className="gap-1.5 h-7 px-2"
        >
          {currentType === "cohosting" ? (
            <>
              <Home className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs">Co-Hosting</span>
            </>
          ) : (
            <>
              <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs">Full-Service</span>
            </>
          )}
          <ArrowRightLeft className="w-3 h-3 text-muted-foreground ml-0.5" />
        </Button>

        <ServiceTypeConfirmDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          currentType={currentType}
          targetType={targetType}
          ownerName={ownerName}
          isUpdating={isUpdating}
          onConfirm={handleConfirmSwitch}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge
          variant={currentType === "cohosting" ? "outline" : "default"}
          className={`cursor-pointer transition-all hover:opacity-80 ${
            currentType === "cohosting"
              ? "border-orange-500 text-orange-600 hover:bg-orange-50"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
          onClick={() => setShowConfirm(true)}
        >
          {currentType === "cohosting" ? (
            <>
              <Home className="w-3 h-3 mr-1" />
              Co-Hosting
            </>
          ) : (
            <>
              <Briefcase className="w-3 h-3 mr-1" />
              Full-Service
            </>
          )}
          <ArrowRightLeft className="w-3 h-3 ml-1.5 opacity-50" />
        </Badge>
      </div>

      <ServiceTypeConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        currentType={currentType}
        targetType={targetType}
        ownerName={ownerName}
        isUpdating={isUpdating}
        onConfirm={handleConfirmSwitch}
      />
    </>
  );
};

interface ServiceTypeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentType: ServiceType;
  targetType: ServiceType;
  ownerName: string;
  isUpdating: boolean;
  onConfirm: () => void;
}

const ServiceTypeConfirmDialog = ({
  open,
  onOpenChange,
  currentType,
  targetType,
  ownerName,
  isUpdating,
  onConfirm,
}: ServiceTypeConfirmDialogProps) => {
  const isToFullService = targetType === "full_service";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isToFullService ? (
              <Briefcase className="w-5 h-5 text-emerald-500" />
            ) : (
              <Home className="w-5 h-5 text-orange-500" />
            )}
            Switch to {isToFullService ? "Full-Service Management" : "Co-Hosting"}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p>
              This will change how reconciliation works for <strong>{ownerName}</strong>:
            </p>

            {isToFullService ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <span className="font-medium">Full-Service Management</span>
                </div>
                <ul className="text-sm space-y-1 text-emerald-600 dark:text-emerald-400">
                  <li>✓ PeachHaus will collect all revenue</li>
                  <li>✓ Monthly payouts will go TO the owner</li>
                  <li>✓ We issue 1099 to owner at year-end</li>
                </ul>
              </div>
            ) : (
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <span className="font-medium">Co-Hosting</span>
                </div>
                <ul className="text-sm space-y-1 text-orange-600 dark:text-orange-400">
                  <li>✓ Owner collects revenue directly</li>
                  <li>✓ Monthly charges go TO PeachHaus</li>
                  <li>✓ Owner issues 1099 to us at year-end</li>
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              This affects future statements only. Existing finalized statements are unchanged.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isUpdating}
            className={isToFullService ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-600 hover:bg-orange-700"}
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Switching...
              </>
            ) : (
              <>Confirm Switch</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
