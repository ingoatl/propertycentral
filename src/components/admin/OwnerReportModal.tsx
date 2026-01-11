import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Download,
  Send,
  Loader2,
  FileText,
  Mail,
  CheckCircle,
  Building2,
} from "lucide-react";

interface OwnerReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  propertyId: string;
  propertyName: string;
}

export function OwnerReportModal({
  open,
  onOpenChange,
  ownerId,
  ownerName,
  ownerEmail,
  propertyId,
  propertyName,
}: OwnerReportModalProps) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [pdfData, setPdfData] = useState<{ base64: string; filename: string } | null>(null);

  const handleGeneratePdf = async () => {
    setGenerating(true);
    setPdfGenerated(false);
    setPdfData(null);

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

      setPdfData({
        base64: data.pdfBase64,
        filename: data.fileName || `PeachHaus-Report-${propertyName}.pdf`,
      });
      setPdfGenerated(true);
      toast.success("Report generated successfully!");
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(error.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfData) return;

    const byteCharacters = atob(pdfData.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = pdfData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success("Report downloaded!");
  };

  const handleSendToOwner = async () => {
    if (!pdfData) {
      toast.error("Please generate the report first");
      return;
    }

    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call send-monthly-report with the PDF
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-monthly-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            propertyId,
            isManualSend: true,
            emailType: "performance",
            sendToOwner: true,
            sendCopyToInfo: false,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send report");
      }

      toast.success(`Report sent to ${ownerEmail}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending report:", error);
      toast.error(error.message || "Failed to send report to owner");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setPdfGenerated(false);
    setPdfData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Owner Dashboard Report
          </DialogTitle>
          <DialogDescription>
            Generate and share the performance report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Property & Owner Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{propertyName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{ownerName}</span>
              <span className="text-xs">({ownerEmail})</span>
            </div>
          </div>

          {/* Generate Button */}
          {!pdfGenerated && (
            <Button
              onClick={handleGeneratePdf}
              disabled={generating}
              className="w-full gap-2"
              size="lg"
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
                </>
              )}
            </Button>
          )}

          {/* Actions after generation */}
          {pdfGenerated && pdfData && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Report Ready!
                </span>
                <Badge variant="secondary" className="ml-2">
                  PDF
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>

                <Button
                  onClick={handleSendToOwner}
                  disabled={sending}
                  className="gap-2 bg-gradient-to-r from-primary to-primary/80"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send to Owner
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Will be sent to {ownerEmail}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
