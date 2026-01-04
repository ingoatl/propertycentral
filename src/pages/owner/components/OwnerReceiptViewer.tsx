import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RefreshCw, X, FileText, Image, File } from "lucide-react";
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

type ContentType = "pdf" | "image" | "html" | "unknown";

export function OwnerReceiptViewer({ expense, onClose, token }: OwnerReceiptViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>("unknown");
  const [zoom, setZoom] = useState(100);

  // Priority: email_screenshot_path (real email) > file_path (uploaded) > original_receipt_path (auto-generated)
  const receiptPath = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Sanitize HTML to remove potentially dangerous content
  const sanitizeHtml = (html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
      .replace(/on\w+\s*=/gi, "data-removed=") // Remove event handlers
      .replace(/javascript:/gi, "removed:"); // Remove javascript: URLs
  };

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!receiptPath) {
        setError("No receipt file available");
        setLoading(false);
        return;
      }

      try {
        console.log("OwnerReceiptViewer: Fetching receipt for path:", receiptPath);
        
        // Use edge function to get signed URL
        const { data, error: urlError } = await supabase.functions.invoke("owner-receipt-url", {
          body: { expenseId: expense.id, token, filePath: receiptPath },
        });

        if (urlError) throw urlError;
        if (data?.error) throw new Error(data.error);

        console.log("OwnerReceiptViewer: Got signed URL, fetching as blob...");
        
        // Fetch the content as a blob - this avoids ad blocker issues
        const response = await fetch(data.signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch receipt: ${response.status}`);
        }

        const blob = await response.blob();
        console.log("OwnerReceiptViewer: Blob type:", blob.type, "size:", blob.size);

        // Determine content type from blob MIME type and file extension
        const mimeType = blob.type.toLowerCase();
        let detectedType: ContentType = "unknown";

        if (mimeType.includes("pdf") || receiptPath.toLowerCase().endsWith(".pdf")) {
          detectedType = "pdf";
        } else if (mimeType.includes("image") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(receiptPath)) {
          detectedType = "image";
        } else if (mimeType.includes("html") || mimeType.includes("text") || /\.html?$/i.test(receiptPath)) {
          detectedType = "html";
        }

        setContentType(detectedType);

        if (detectedType === "html") {
          // For HTML, read as text and sanitize for safe rendering
          const text = await blob.text();
          const sanitizedHtml = sanitizeHtml(text);
          setHtmlContent(sanitizedHtml);
          console.log("OwnerReceiptViewer: HTML content sanitized and ready");
        } else {
          // For PDF, images, and other files, create a blob URL
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          console.log("OwnerReceiptViewer: Blob URL created for", detectedType);
        }
      } catch (err) {
        console.error("OwnerReceiptViewer: Error fetching receipt:", err);
        setError(err instanceof Error ? err.message : "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptPath, expense.id, token]);

  // Download the receipt programmatically - this method is never blocked
  const handleDownload = useCallback(async () => {
    if (!blobUrl && !htmlContent) return;

    try {
      let downloadUrl = blobUrl;
      
      // For HTML content, create a blob from the content
      if (htmlContent && !blobUrl) {
        const blob = new Blob([htmlContent], { type: "text/html" });
        downloadUrl = URL.createObjectURL(blob);
      }

      if (!downloadUrl) return;

      // Determine file extension
      let ext = ".png";
      if (contentType === "pdf") ext = ".pdf";
      else if (contentType === "html") ext = ".html";
      else if (contentType === "image") ext = ".png";

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `receipt-${expense.id}${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup temporary URL for HTML
      if (htmlContent && downloadUrl !== blobUrl) {
        URL.revokeObjectURL(downloadUrl);
      }

      toast.success("Receipt downloaded");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download receipt");
    }
  }, [blobUrl, htmlContent, contentType, expense.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Get icon based on content type
  const getTypeIcon = () => {
    switch (contentType) {
      case "pdf":
        return <FileText className="h-5 w-5 text-primary" />;
      case "image":
        return <Image className="h-5 w-5 text-primary" />;
      default:
        return <File className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {getTypeIcon()}
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {expense.purpose || expense.category || "Receipt"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(expense.date), "MMMM d, yyyy")} • {formatCurrency(expense.amount)}
                  {expense.vendor && ` • ${expense.vendor}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {contentType === "image" && blobUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                    disabled={zoom <= 25}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(300, zoom + 25))}
                    disabled={zoom >= 300}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleDownload}
                disabled={!blobUrl && !htmlContent}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 min-h-[500px] relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading receipt...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <X className="h-12 w-12 mx-auto text-destructive/50 mb-4" />
                <p className="text-destructive font-medium mb-2">Failed to load receipt</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : contentType === "pdf" && blobUrl ? (
            // PDF: Use object with iframe fallback - better browser support
            <object
              data={blobUrl}
              type="application/pdf"
              className="w-full h-full min-h-[600px]"
              title="Receipt PDF"
            >
              <iframe
                src={blobUrl}
                className="w-full h-full min-h-[600px] border-0"
                title="Receipt PDF"
              />
            </object>
          ) : contentType === "html" && htmlContent ? (
            // HTML: Use srcdoc with sanitized content - never blocked by ad blockers
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full min-h-[600px] bg-white"
              title="Receipt"
              sandbox="allow-same-origin"
              style={{ border: "none" }}
            />
          ) : contentType === "image" && blobUrl ? (
            // Image: Display with zoom controls
            <div className="flex items-center justify-center p-4 min-h-[500px] overflow-auto">
              <img
                src={blobUrl}
                alt="Receipt"
                className="max-w-full h-auto rounded-lg shadow-lg transition-transform duration-200"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
              />
            </div>
          ) : blobUrl ? (
            // Unknown type with blob URL - offer download
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <File className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="font-medium mb-2">Preview not available</p>
                <p className="text-sm text-muted-foreground mb-4">
                  This file type cannot be previewed in the browser.
                </p>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">No receipt to display</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
