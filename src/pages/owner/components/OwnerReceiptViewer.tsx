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
}

export function OwnerReceiptViewer({ expense, onClose }: OwnerReceiptViewerProps) {
  const [loading, setLoading] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  // Priority: email_screenshot_path (real email) > file_path (uploaded) > original_receipt_path (auto-generated)
  const receiptPath = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;
  const isPdf = receiptPath?.toLowerCase().endsWith('.pdf');
  const isHtml = receiptPath?.toLowerCase().endsWith('.html');

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!receiptPath) {
        setError("No receipt file available");
        setLoading(false);
        return;
      }

      try {
        const { data, error: urlError } = await supabase.storage
          .from("expense-documents")
          .createSignedUrl(receiptPath, 600); // 10 minutes

        if (urlError) throw urlError;

        setSignedUrl(data.signedUrl);
      } catch (err) {
        console.error("Error fetching receipt:", err);
        setError("Failed to load receipt");
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [receiptPath]);

  const handleDownload = () => {
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
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl}>
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
                <Button variant="outline" onClick={handleDownload} className="mt-4">
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
            ) : isHtml ? (
              // HTML Viewer
              <iframe
                src={signedUrl}
                className="w-full h-full min-h-[500px] bg-white rounded-lg"
                title="Receipt HTML"
                sandbox="allow-same-origin"
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
