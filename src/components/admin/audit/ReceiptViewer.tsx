import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  X,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  RotateCw,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface ReceiptViewerProps {
  filePath?: string | null;
  emailScreenshotPath?: string | null;
  originalReceiptPath?: string | null;
  expenseDescription?: string;
  vendor?: string;
  amount?: number;
}

export function ReceiptViewer({
  filePath,
  emailScreenshotPath,
  originalReceiptPath,
  expenseDescription,
  vendor,
  amount,
}: ReceiptViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"original" | "email">("original");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  // Determine which receipts are available - prioritize original/file over email screenshot
  const hasOriginal = !!(originalReceiptPath || filePath);
  const hasEmailScreenshot = !!emailScreenshotPath;
  const hasAnyReceipt = hasOriginal || hasEmailScreenshot;

  // Get the active file path - prioritize what's available
  const getActiveFilePath = () => {
    if (activeTab === "original" && hasOriginal) {
      return originalReceiptPath || filePath;
    }
    if (activeTab === "email" && hasEmailScreenshot) {
      return emailScreenshotPath;
    }
    // Fallback to whatever is available
    return originalReceiptPath || filePath || emailScreenshotPath;
  };

  const isHtmlFile = (path: string | null | undefined) => {
    return path?.toLowerCase().endsWith(".html") || path?.toLowerCase().endsWith(".htm");
  };

  const isPdfFile = (path: string | null | undefined) => {
    return path?.toLowerCase().endsWith(".pdf");
  };

  const isImageFile = (path: string | null | undefined) => {
    const ext = path?.toLowerCase();
    return ext?.endsWith(".png") || ext?.endsWith(".jpg") || ext?.endsWith(".jpeg") || ext?.endsWith(".webp") || ext?.endsWith(".gif");
  };

  const openReceipt = async () => {
    const path = getActiveFilePath();
    if (!path) {
      toast.error("No receipt available for this expense");
      return;
    }

    setLoading(true);
    setError(null);
    setHtmlContent(null);
    
    try {
      const { data, error: storageError } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (storageError) {
        console.error("Storage error:", storageError);
        throw new Error(`Could not access file: ${storageError.message}`);
      }
      
      if (!data?.signedUrl) {
        throw new Error("No URL returned from storage");
      }

      // For HTML files, fetch the content and render it differently to avoid browser blocking
      if (isHtmlFile(path)) {
        try {
          const response = await fetch(data.signedUrl);
          if (response.ok) {
            const html = await response.text();
            setHtmlContent(html);
          } else {
            throw new Error("Failed to fetch HTML content");
          }
        } catch (fetchError) {
          console.error("Error fetching HTML:", fetchError);
          // Fallback to signed URL
          setSignedUrl(data.signedUrl);
        }
      } else {
        setSignedUrl(data.signedUrl);
      }
      
      setIsOpen(true);
      setZoom(1);
      setRotation(0);
    } catch (err) {
      console.error("Error getting signed URL:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load receipt";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async () => {
    const path = getActiveFilePath();
    if (!path) {
      toast.error("No receipt available to download");
      return;
    }

    try {
      const { data, error: storageError } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(path, 300); // 5 min expiry for download

      if (storageError) throw storageError;
      
      if (!data?.signedUrl) {
        throw new Error("Could not generate download URL");
      }
      
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = path.split('/').pop() || 'receipt';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Download started");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download receipt");
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const switchTab = async (tab: "original" | "email") => {
    setActiveTab(tab);
    setZoom(1);
    setRotation(0);
    setError(null);
    setHtmlContent(null);
    
    const path = tab === "original" 
      ? (originalReceiptPath || filePath) 
      : emailScreenshotPath;
    
    if (path) {
      setLoading(true);
      try {
        const { data, error: storageError } = await supabase.storage
          .from("expense-documents")
          .createSignedUrl(path, 3600);

        if (storageError) throw storageError;
        
        if (isHtmlFile(path)) {
          try {
            const response = await fetch(data.signedUrl);
            if (response.ok) {
              const html = await response.text();
              setHtmlContent(html);
            }
          } catch {
            setSignedUrl(data.signedUrl);
          }
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error getting signed URL:", err);
        setError("Failed to load receipt");
        toast.error("Failed to load receipt");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!hasAnyReceipt) {
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-300">
        Missing
      </Badge>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const currentPath = getActiveFilePath();

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={openReceipt}
          disabled={loading}
          className="gap-1"
        >
          {loading ? (
            <RotateCw className="h-4 w-4 animate-spin" />
          ) : isPdfFile(currentPath) ? (
            <FileText className="h-4 w-4" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          View
        </Button>
        {hasOriginal && (
          <Badge variant="secondary" className="text-xs">
            {isPdfFile(originalReceiptPath || filePath) ? "PDF" : "Original"}
          </Badge>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {vendor || "Receipt"} {amount ? `- ${formatCurrency(amount)}` : ""}
                </DialogTitle>
                {expenseDescription && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {expenseDescription}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab buttons if both types exist */}
            {hasOriginal && hasEmailScreenshot && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant={activeTab === "original" ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchTab("original")}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Original Receipt
                </Button>
                <Button
                  variant={activeTab === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchTab("email")}
                >
                  <ImageIcon className="h-4 w-4 mr-1" />
                  Email Screenshot
                </Button>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={!htmlContent && !signedUrl}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={!htmlContent && !signedUrl}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleRotate} disabled={!htmlContent && !signedUrl}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={downloadReceipt}>
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

          {/* Content area with scroll and zoom */}
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RotateCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-destructive gap-4">
                <AlertCircle className="h-12 w-12" />
                <div className="text-center">
                  <p className="font-medium">Failed to load receipt</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <Button variant="outline" onClick={openReceipt}>
                  Try Again
                </Button>
              </div>
            ) : htmlContent ? (
              // Render HTML content in a sandboxed div (avoids iframe blocking)
              <div 
                className="flex items-center justify-center min-h-full"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center top",
                }}
              >
                <div 
                  className="bg-white rounded-lg shadow-lg max-w-full overflow-hidden p-4"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                  style={{ maxWidth: '100%' }}
                />
              </div>
            ) : signedUrl ? (
              <div className="flex items-center justify-center min-h-full">
                {isPdfFile(currentPath) ? (
                  <iframe
                    src={signedUrl}
                    className="w-full h-full min-h-[70vh] border rounded-lg bg-white"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                    }}
                    title="Receipt PDF"
                  />
                ) : (
                  <img
                    src={signedUrl}
                    alt="Receipt"
                    className="max-w-full rounded-lg shadow-lg transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                    }}
                    onError={() => {
                      setError("Failed to load image");
                      toast.error("Failed to load image");
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <AlertCircle className="h-8 w-8" />
                <p>No receipt available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
