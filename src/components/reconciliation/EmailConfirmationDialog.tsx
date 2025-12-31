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
import { Mail, Send, Loader2 } from "lucide-react";

interface EmailConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  emailType: "performance" | "statement";
  propertyName: string;
  ownerName: string;
  ownerEmail: string;
  month: string;
}

export const EmailConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  emailType,
  propertyName,
  ownerName,
  ownerEmail,
  month,
}: EmailConfirmationDialogProps) => {
  const isPerformance = emailType === "performance";
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isPerformance ? (
              <Mail className="w-5 h-5 text-primary" />
            ) : (
              <Send className="w-5 h-5 text-primary" />
            )}
            Confirm Email to Owner
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to send a <span className="font-medium text-foreground">{isPerformance ? "performance report" : "monthly statement"}</span> email to the property owner.
              </p>
              
              <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property:</span>
                  <span className="font-medium text-foreground">{propertyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-medium text-foreground">{ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{ownerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Period:</span>
                  <span className="font-medium text-foreground">{month}</span>
                </div>
              </div>
              
              {isPerformance && (
                <p className="text-xs text-muted-foreground">
                  A copy will also be sent to info@peachhausgroup.com
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
