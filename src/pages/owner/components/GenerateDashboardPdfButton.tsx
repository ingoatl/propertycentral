import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerateDashboardPdfButtonProps {
  ownerId: string;
  propertyId?: string;
  propertyName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function GenerateDashboardPdfButton({
  ownerId,
  propertyId,
  propertyName,
  variant = "default",
  size = "default",
  className = "",
}: GenerateDashboardPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGeneratePdf = async () => {
    if (!ownerId) {
      toast.error("Owner information not available");
      return;
    }

    setGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-owner-dashboard-pdf",
        {
          body: { ownerId, propertyId },
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.pdfBase64) {
        throw new Error("No PDF data received");
      }

      // Convert base64 to blob and download
      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName || `PeachHaus-Dashboard-Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Dashboard report downloaded successfully!");
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(error.message || "Failed to generate dashboard report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGeneratePdf}
      disabled={generating}
      variant={variant}
      size={size}
      className={`gap-2 ${className}`}
    >
      {generating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating Report...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4" />
          Generate Report
          <Sparkles className="h-3 w-3 text-amber-400" />
        </>
      )}
    </Button>
  );
}
