import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ZoomIn, ZoomOut, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PDFViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  title?: string;
  bucketName?: string;
}

export function PDFViewerDialog({
  open,
  onOpenChange,
  filePath,
  title = "Document Viewer",
  bucketName = "signed-documents",
}: PDFViewerDialogProps) {
  const [loading, setLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const { toast } = useToast();

  useEffect(() => {
    if (open && filePath) {
      loadPdf();
    }
    
    return () => {
      // Cleanup blob URL on unmount
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [open, filePath]);

  const loadPdf = async () => {
    if (!filePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Download the file as a blob instead of using signed URL
      // This avoids browser ad blockers blocking Supabase URLs
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (downloadError) throw downloadError;
      
      // Create a blob URL from the downloaded file
      const blobUrl = URL.createObjectURL(data);
      setPdfBlobUrl(blobUrl);
    } catch (err: any) {
      console.error("Error loading PDF:", err);
      setError(err.message || "Failed to load document");
      toast({
        title: "Error",
        description: "Failed to load document. Please try downloading instead.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!filePath) return;
    
    try {
      // Download as blob to avoid ad blockers
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (downloadError) throw downloadError;
      
      // Create download link
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filePath.split('/').pop() || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      toast({
        title: "Success",
        description: "Document downloaded successfully",
      });
    } catch (err: any) {
      console.error("Error downloading PDF:", err);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Cleanup when closing
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setZoom(100);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg truncate pr-4">{title}</DialogTitle>
            <div className="flex items-center gap-2">
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
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              {pdfBlobUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(pdfBlobUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p>{error}</p>
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Instead
              </Button>
            </div>
          ) : pdfBlobUrl ? (
            <div className="flex justify-center p-4">
              <iframe
                src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="bg-white shadow-lg rounded"
                style={{
                  width: `${zoom}%`,
                  minWidth: "600px",
                  height: "calc(90vh - 100px)",
                  maxWidth: "100%",
                }}
                title={title}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No document to display
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
