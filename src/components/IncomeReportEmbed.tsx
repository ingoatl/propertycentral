import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface IncomeReportEmbedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReportGenerated?: () => void;
}

export function IncomeReportEmbed({ open, onOpenChange, onReportGenerated }: IncomeReportEmbedProps) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'INCOME_REPORT_GENERATED') {
        console.log('Income report was generated!');
        onReportGenerated?.();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onReportGenerated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <iframe 
          src="https://www.peachhausgroup.com/embed/income-report"
          className="w-full h-[80vh] border-none"
          allow="clipboard-write"
          title="PeachHaus Income Report Generator"
        />
      </DialogContent>
    </Dialog>
  );
}

interface IncomeReportButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function IncomeReportButton({ variant = "default", size = "default", className }: IncomeReportButtonProps) {
  return (
    <Button variant={variant} size={size} className={className}>
      <FileText className="h-4 w-4 mr-2" />
      Income Report
    </Button>
  );
}
