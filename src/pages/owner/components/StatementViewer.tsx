import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, X, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  status: string;
}

interface StatementViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: Statement | null;
  fetchPdf: (statementId: string) => Promise<{ signedUrl?: string; pdfBase64?: string }>;
  propertyName?: string;
}

export function StatementViewer({
  open,
  onOpenChange,
  statement,
  fetchPdf,
  propertyName,
}: StatementViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Cleanup blob URL on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Load PDF when dialog opens
  useEffect(() => {
    if (!open || !statement) {
      // Reset state when closed
      setBlobUrl(null);
      setError(null);
      setLoading(true);
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log("StatementViewer: Fetching PDF for statement:", statement.id);
        const data = await fetchPdf(statement.id);

        if (data.signedUrl) {
          // Fetch as blob to avoid ad blocker issues
          const response = await fetch(data.signedUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status}`);
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          console.log("StatementViewer: PDF loaded from signed URL");
        } else if (data.pdfBase64) {
          // Convert base64 to blob
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          console.log("StatementViewer: PDF loaded from base64");
        } else {
          throw new Error("No PDF data received");
        }
      } catch (err) {
        console.error("StatementViewer: Error loading PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load statement");
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [open, statement, fetchPdf]);

  // Download the PDF programmatically
  const handleDownload = useCallback(() => {
    if (!blobUrl || !statement) return;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `statement-${statement.reconciliation_month}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Statement downloaded");
  }, [blobUrl, statement]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formattedMonth = statement
    ? format(new Date(statement.reconciliation_month + "-01"), "MMMM yyyy")
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {formattedMonth} Statement
                </DialogTitle>
                {propertyName && (
                  <p className="text-sm text-muted-foreground">{propertyName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {statement && (
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <span className="text-muted-foreground">Net:</span>
                    <span className="ml-2 font-semibold text-emerald-600">
                      {formatCurrency(statement.net_to_owner)}
                    </span>
                  </div>
                </div>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleDownload}
                disabled={!blobUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30 min-h-[600px] relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading statement...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <X className="h-12 w-12 mx-auto text-destructive/50 mb-4" />
                <p className="text-destructive font-medium mb-2">Failed to load statement</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : blobUrl ? (
            // PDF viewer using object tag with iframe fallback - better browser support than embed
            <object
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full min-h-[600px]"
              title="Statement PDF"
            >
              {/* Fallback to iframe if object doesn't work */}
              <iframe
                src={blobUrl}
                className="w-full h-full min-h-[600px] border-0"
                title="Statement PDF"
              />
            </object>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">No statement to display</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
