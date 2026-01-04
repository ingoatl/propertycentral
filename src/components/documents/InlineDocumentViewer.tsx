import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, ZoomIn, ZoomOut, RefreshCw, X, FileText, Image, File } from "lucide-react";
import { toast } from "sonner";

interface InlineDocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  fetchUrl: () => Promise<string>; // Function to get the signed URL
  fileName?: string;
}

type ContentType = "pdf" | "image" | "html" | "unknown";

export function InlineDocumentViewer({
  open,
  onOpenChange,
  title = "Document",
  subtitle,
  fetchUrl,
  fileName = "document",
}: InlineDocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>("unknown");
  const [zoom, setZoom] = useState(100);

  // Cleanup blob URLs on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Load document when dialog opens
  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setBlobUrl(null);
      setHtmlContent(null);
      setError(null);
      setLoading(true);
      return;
    }

    const loadDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the signed URL
        const signedUrl = await fetchUrl();
        console.log("InlineDocumentViewer: Got signed URL");

        // Fetch the content as a blob
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status}`);
        }

        const blob = await response.blob();
        console.log("InlineDocumentViewer: Blob type:", blob.type, "size:", blob.size);

        // Determine content type
        const mimeType = blob.type.toLowerCase();
        let detectedType: ContentType = "unknown";

        if (mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")) {
          detectedType = "pdf";
        } else if (mimeType.includes("image") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) {
          detectedType = "image";
        } else if (mimeType.includes("html") || mimeType.includes("text") || /\.html?$/i.test(fileName)) {
          detectedType = "html";
        }

        setContentType(detectedType);

        if (detectedType === "html") {
          // For HTML, read as text and sanitize
          const text = await blob.text();
          const sanitizedHtml = sanitizeHtml(text);
          setHtmlContent(sanitizedHtml);
        } else {
          // For PDF, images, and other files, create a blob URL
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }

        console.log("InlineDocumentViewer: Content loaded as", detectedType);
      } catch (err) {
        console.error("InlineDocumentViewer: Error loading document:", err);
        setError(err instanceof Error ? err.message : "Failed to load document");
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [open, fetchUrl, fileName]);

  // Sanitize HTML to remove potentially dangerous content
  const sanitizeHtml = (html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
      .replace(/on\w+\s*=/gi, "data-removed=") // Remove event handlers
      .replace(/javascript:/gi, "removed:"); // Remove javascript: URLs
  };

  // Download the document programmatically
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

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup temporary URL for HTML
      if (htmlContent && downloadUrl !== blobUrl) {
        URL.revokeObjectURL(downloadUrl);
      }

      toast.success("Download started");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download");
    }
  }, [blobUrl, htmlContent, fileName]);

  // Get icon based on content type
  const getTypeIcon = () => {
    switch (contentType) {
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "image":
        return <Image className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                {getTypeIcon()}
              </div>
              <div>
                <DialogTitle className="text-lg">{title}</DialogTitle>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
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
                  <span className="text-sm text-muted-foreground w-12 text-center">
                    {zoom}%
                  </span>
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
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <X className="h-12 w-12 mx-auto text-destructive/50 mb-4" />
                <p className="text-destructive font-medium mb-2">Failed to load document</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : contentType === "pdf" && blobUrl ? (
            // PDF: Use embed with blob URL - works offline and avoids external services
            <embed
              src={blobUrl}
              type="application/pdf"
              className="w-full h-full min-h-[600px]"
              title="PDF Document"
            />
          ) : contentType === "html" && htmlContent ? (
            // HTML: Use srcdoc with sanitized content
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full min-h-[600px] bg-white"
              title="HTML Document"
              sandbox="allow-same-origin"
              style={{ border: "none" }}
            />
          ) : contentType === "image" && blobUrl ? (
            // Image: Display with zoom controls
            <div className="flex items-center justify-center p-4 min-h-[500px] overflow-auto">
              <img
                src={blobUrl}
                alt={title}
                className="max-w-full h-auto rounded-lg shadow-lg transition-transform duration-200"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
              />
            </div>
          ) : blobUrl ? (
            // Unknown type with blob URL - show download prompt
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <File className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="font-medium mb-2">Preview not available</p>
                <p className="text-sm text-muted-foreground mb-4">
                  This file type cannot be previewed in the browser.
                </p>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">No content to display</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
