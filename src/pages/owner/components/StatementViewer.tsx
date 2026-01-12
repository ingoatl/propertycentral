import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, X, FileText, ExternalLink, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  actual_net_earnings?: number; // Calculated correctly based on service type
  status: string;
}

interface StatementViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: Statement | null;
  fetchPdf: (statementId: string) => Promise<{ signedUrl?: string; pdfBase64?: string }>;
  propertyName?: string;
  ownerName?: string;
  propertyAddress?: string;
}

export function StatementViewer({
  open,
  onOpenChange,
  statement,
  fetchPdf,
  propertyName,
  ownerName,
  propertyAddress,
}: StatementViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Generate proper filename for download
  const getDownloadFilename = useCallback(() => {
    if (!statement) return "statement.pdf";
    
    const monthDate = new Date(statement.reconciliation_month + "-01");
    const monthName = format(monthDate, "MMMM yyyy");
    
    const parts = [monthName, "Statement"];
    if (ownerName) parts.push(ownerName);
    if (propertyAddress) parts.push(propertyAddress);
    
    // Clean up the filename - remove special characters
    const filename = parts.join(" - ").replace(/[^a-zA-Z0-9\s\-]/g, "").replace(/\s+/g, " ").trim();
    return `${filename}.pdf`;
  }, [statement, ownerName, propertyAddress]);

  // Load PDF when dialog opens
  useEffect(() => {
    if (!open || !statement) {
      setSignedUrl(null);
      setError(null);
      setLoading(true);
      setZoom(1);
      setRotation(0);
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log("StatementViewer: Fetching PDF for statement:", statement.id);
        const data = await fetchPdf(statement.id);

        if (data.signedUrl) {
          setSignedUrl(data.signedUrl);
          console.log("StatementViewer: PDF signed URL received");
        } else if (data.pdfBase64) {
          // Convert base64 to blob and create object URL
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setSignedUrl(url);
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

  // Download the PDF with proper naming
  const handleDownload = useCallback(async () => {
    if (!signedUrl || !statement) return;

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error("Failed to fetch PDF");
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getDownloadFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success("Statement downloaded");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download statement");
    }
  }, [signedUrl, statement, getDownloadFilename]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

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
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 border-b">
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
                      {formatCurrency(statement.actual_net_earnings ?? statement.net_to_owner)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={!signedUrl}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={!signedUrl}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRotate} disabled={!signedUrl}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signedUrl && window.open(signedUrl, "_blank")}
              disabled={!signedUrl}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in New Tab
            </Button>
          </div>
        </DialogHeader>

        {/* Content area */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading statement...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive gap-4">
              <X className="h-12 w-12" />
              <div className="text-center">
                <p className="font-medium">Failed to load statement</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          ) : signedUrl ? (
            <div className="flex flex-col items-center justify-center min-h-full gap-6">
              {/* PDF: Use Google Docs Viewer - same as GREC audit (most reliable) */}
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(signedUrl)}&embedded=true`}
                className="w-full h-[60vh] border rounded-lg bg-white"
                title="Statement PDF"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              />
              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap justify-center">
                <Button variant="default" size="lg" onClick={() => window.open(signedUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open PDF in New Tab
                </Button>
                <Button variant="outline" size="lg" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-md">
                If the preview doesn't load, use the buttons above to view or download the PDF directly.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No statement to display</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
