import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, ZoomIn, ZoomOut, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Expense {
  id: string;
  date: string;
  amount: number;
  purpose: string | null;
  vendor: string | null;
  category: string | null;
  file_path: string | null;
  original_receipt_path: string | null;
  email_screenshot_path?: string | null;
}

interface OwnerReceiptViewerProps {
  expense: Expense;
  onClose: () => void;
  token?: string;
}

export function OwnerReceiptViewer({ expense, onClose, token }: OwnerReceiptViewerProps) {
  const [loading, setLoading] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  // Priority: email_screenshot_path (real email) > file_path (uploaded) > original_receipt_path (auto-generated)
  const receiptPath = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;
  const isPdf = receiptPath?.toLowerCase().endsWith('.pdf');
  const isHtml = receiptPath?.toLowerCase().endsWith('.html');

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!receiptPath) {
        setError("No receipt file available");
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching receipt for path:", receiptPath);
        
        // Use edge function to get signed URL
        const { data, error: urlError } = await supabase.functions.invoke("owner-receipt-url", {
          body: { expenseId: expense.id, token, filePath: receiptPath },
        });

        if (urlError) throw urlError;
        if (data?.error) throw new Error(data.error);

        console.log("Received signed URL, fetching content...");
        setSignedUrl(data.signedUrl);

        // Always fetch as blob first to determine actual content type
        try {
          const response = await fetch(data.signedUrl);
          if (!response.ok) throw new Error("Failed to fetch content");
          
          const blob = await response.blob();
          console.log("Fetched blob type:", blob.type, "size:", blob.size);
          
          // Check if it's actually HTML (by content type or extension)
          const isHtmlContent = blob.type.includes('html') || blob.type.includes('text') || isHtml;
          
          if (isHtmlContent) {
            const text = await blob.text();
            // Sanitize and prepare HTML for rendering
            const sanitizedHtml = text
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
              .replace(/onclick|onerror|onload|onmouseover/gi, 'data-removed'); // Remove event handlers
            setHtmlContent(sanitizedHtml);
            console.log("HTML content loaded and sanitized");
          } else {
            // For non-HTML, create a blob URL for display
            const blobUrl = URL.createObjectURL(blob);
            setSignedUrl(blobUrl);
            console.log("Created blob URL for non-HTML content");
          }
        } catch (fetchErr) {
          console.warn("Could not fetch content directly:", fetchErr);
          // Keep the signed URL as fallback
        }
      } catch (err) {
        console.error("Error fetching receipt:", err);
        setError("Failed to load receipt");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptPath, expense.id, token, isHtml]);

  const handleDownload = () => {
    if (signedUrl) {
      // For downloads, always open in new tab
      const link = document.createElement('a');
      link.href = signedUrl;
      link.target = '_blank';
      link.download = `receipt-${expense.id}${isPdf ? '.pdf' : isHtml ? '.html' : '.png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    }
  };

  const handleOpenExternal = () => {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
      toast.success("Receipt opened in new tab");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">
                {expense.purpose || expense.category || "Receipt"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(expense.date), "MMMM d, yyyy")} • {formatCurrency(expense.amount)}
                {expense.vendor && ` • ${expense.vendor}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isPdf && !isHtml && signedUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.max(50, zoom - 25))}
                    disabled={zoom <= 50}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                    disabled={zoom >= 200}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleOpenExternal} disabled={!signedUrl}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
              <Button variant="default" size="sm" onClick={handleDownload} disabled={!signedUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg min-h-[400px] relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <X className="h-12 w-12 mx-auto text-destructive/50 mb-4" />
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={handleOpenExternal} className="mt-4">
                  Try Opening Directly
                </Button>
              </div>
            </div>
          ) : signedUrl ? (
            isPdf ? (
              // PDF Viewer using Google Docs
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(signedUrl)}&embedded=true`}
                className="w-full h-full min-h-[500px] rounded-lg"
                title="Receipt PDF"
              />
            ) : isHtml && htmlContent ? (
              // HTML Viewer using srcdoc for proper rendering
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full min-h-[500px] bg-white rounded-lg"
                title="Receipt HTML"
                sandbox="allow-same-origin"
                style={{ border: 'none' }}
              />
            ) : isHtml ? (
              // Fallback: HTML Viewer using src with sandbox
              <iframe
                src={signedUrl}
                className="w-full h-full min-h-[500px] bg-white rounded-lg"
                title="Receipt HTML"
                sandbox="allow-same-origin"
                style={{ border: 'none' }}
              />
            ) : (
              // Image Viewer
              <div className="flex items-center justify-center p-4">
                <img
                  src={signedUrl}
                  alt="Receipt"
                  className="max-w-full h-auto rounded-lg shadow-lg transition-transform duration-200"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              </div>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
