import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  X,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  RotateCw
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

  // Determine which receipts are available
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

  const openReceipt = async () => {
    const path = getActiveFilePath();
    if (!path) {
      toast.error("No receipt available for this expense");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(path, 3600); // 1 hour expiry

      if (error) {
        console.error("Storage error:", error);
        throw new Error(`Could not access file: ${error.message}`);
      }
      
      if (!data?.signedUrl) {
        throw new Error("No URL returned from storage");
      }
      
      setSignedUrl(data.signedUrl);
      setIsOpen(true);
      setZoom(1);
      setRotation(0);
    } catch (error) {
      console.error("Error getting signed URL:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async () => {
    const path = getActiveFilePath();
    if (!path) return;

    try {
      const { data, error } = await supabase.storage
        .from("expense-documents")
        .createSignedUrl(path, 60);

      if (error) throw error;
      
      // Open in new tab for download
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Failed to download receipt");
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const isPdf = (path: string | null | undefined) => {
    return path?.toLowerCase().endsWith(".pdf");
  };

  const switchTab = async (tab: "original" | "email") => {
    setActiveTab(tab);
    setZoom(1);
    setRotation(0);
    
    const path = tab === "original" 
      ? (originalReceiptPath || filePath) 
      : emailScreenshotPath;
    
    if (path) {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from("expense-documents")
          .createSignedUrl(path, 3600);

        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error("Error getting signed URL:", error);
        toast.error("Failed to load receipt");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!hasAnyReceipt) {
    return (
      <Badge variant="outline" className="text-amber-600">
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
          ) : hasOriginal ? (
            <FileText className="h-4 w-4" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
          View
        </Button>
        {hasOriginal && (
          <Badge variant="secondary" className="text-xs">
            Original
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
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleRotate}>
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
            ) : signedUrl ? (
              <div className="flex items-center justify-center min-h-full">
                {isPdf(getActiveFilePath()) ? (
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
                      toast.error("Failed to load image");
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No receipt available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}