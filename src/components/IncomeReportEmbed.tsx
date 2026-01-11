import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface IncomeReportButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
}

const INCOME_REPORT_URL = "https://www.peachhausgroup.com/embed/income-report";

export function IncomeReportButton({ 
  variant = "outline", 
  size = "sm", 
  className,
  showIcon = true 
}: IncomeReportButtonProps) {
  const handleOpenReport = () => {
    // Open in new tab since iframe embedding is blocked by X-Frame-Options
    const newWindow = window.open(INCOME_REPORT_URL, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      toast.error("Please allow popups to open the income report tool");
    } else {
      toast.success("Income Report tool opened in new tab");
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={handleOpenReport}
    >
      {showIcon && <FileText className="h-4 w-4 mr-2" />}
      Income Report
      <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />
    </Button>
  );
}

// For backwards compatibility - component that was previously a dialog
interface IncomeReportEmbedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReportGenerated?: () => void;
}

export function IncomeReportEmbed({ open, onOpenChange }: IncomeReportEmbedProps) {
  // When opened, redirect to new tab and close immediately
  if (open) {
    window.open(INCOME_REPORT_URL, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  }
  return null;
}
