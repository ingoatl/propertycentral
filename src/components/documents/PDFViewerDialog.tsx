import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ZoomIn, ZoomOut, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PDFViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  title?: string;
  bucketName?: string;
  documentName?: string;
  propertyAddress?: string;
  recipientName?: string;
}

export function PDFViewerDialog({
  open,
  onOpenChange,
  filePath,
  title = "Document Viewer",
  bucketName = "signed-documents",
  documentName,
  propertyAddress,
  recipientName,
}: PDFViewerDialogProps) {
  const [loading, setLoading] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open && filePath) {
      loadPdf();
    }
  }, [open, filePath, retryCount]);

  const loadPdf = async () => {
    if (!filePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get a signed URL for the PDF - Google Docs Viewer needs a public URL
      const { data, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (urlError) throw urlError;
      
      setSignedUrl(data.signedUrl);
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

  const generateDownloadFilename = (): string => {
    const parts: string[] = [];
    
    // Add document/agreement type
    if (documentName) {
      parts.push(documentName.replace(/[^a-zA-Z0-9\s-]/g, '').trim());
    } else if (title && title !== "Document Viewer") {
      parts.push(title.replace(/[^a-zA-Z0-9\s-]/g, '').trim());
    }
    
    // Add property address
    if (propertyAddress) {
      parts.push(propertyAddress.replace(/[^a-zA-Z0-9\s-]/g, '').trim());
    }
    
    // Add recipient name
    if (recipientName) {
      parts.push(recipientName.replace(/[^a-zA-Z0-9\s-]/g, '').trim());
    }
    
    // If we have parts, join them with underscores
    if (parts.length > 0) {
      return parts.join('_').replace(/\s+/g, '_').replace(/_+/g, '_') + '.pdf';
    }
    
    // Fallback to file path name
    return filePath.split('/').pop() || 'document.pdf';
  };

  const handleDownload = async () => {
    if (!filePath) return;
    
    try {
      // Download as blob to avoid ad blockers
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (downloadError) throw downloadError;
      
      // Create download link with descriptive filename
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = generateDownloadFilename();
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
      setSignedUrl(null);
      setError(null);
      setRetryCount(0);
    }
    onOpenChange(newOpen);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg truncate pr-4">{title}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              {signedUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(signedUrl, "_blank")}
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
              <div className="flex gap-2">
                <Button onClick={handleRetry} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Instead
                </Button>
              </div>
            </div>
          ) : signedUrl ? (
            <div className="flex flex-col items-center justify-center min-h-full gap-6 p-4">
              {/* PDF: Use Google Docs Viewer - same as GREC audit (most reliable) */}
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(signedUrl)}&embedded=true`}
                className="w-full h-[calc(90vh-100px)] border rounded-lg bg-white"
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
