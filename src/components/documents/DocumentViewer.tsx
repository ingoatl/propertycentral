import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ExternalLink, X, FileText, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName: string;
  fileType?: string;
}

export function DocumentViewer({ open, onOpenChange, filePath, fileName, fileType }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && filePath) {
      loadDocument();
    }
  }, [open, filePath]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if it's a public URL or needs signing
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        setSignedUrl(filePath);
      } else if (filePath.startsWith('/')) {
        // Local public path
        setSignedUrl(filePath);
      } else if (filePath.startsWith('public/')) {
        // Files in public folder - strip 'public/' prefix for browser access
        setSignedUrl('/' + filePath.replace('public/', ''));
      } else {
        // Supabase storage path - get signed URL
        const bucketName = filePath.includes('property-documents') ? 'property-documents' : 'documents';
        const pathInBucket = filePath.replace(`${bucketName}/`, '');
        
        const { data, error: signError } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(pathInBucket, 3600);

        if (signError) throw signError;
        setSignedUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const [pdfLoadFailed, setPdfLoadFailed] = useState(false);
  
  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileType?.includes('pdf');
  const isImage = fileType?.includes('image') || 
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName || '');
  const isExcel = fileName?.toLowerCase().endsWith('.xlsx') || 
    fileName?.toLowerCase().endsWith('.xls') || 
    fileType?.includes('spreadsheet') || 
    fileType?.includes('excel');

  // Reset PDF load state when document changes
  useEffect(() => {
    setPdfLoadFailed(false);
  }, [filePath]);

  const getFileIcon = () => {
    if (isPdf) return <FileText className="h-16 w-16 text-red-500" />;
    if (isExcel) return <FileSpreadsheet className="h-16 w-16 text-green-600" />;
    if (isImage) return <ImageIcon className="h-16 w-16 text-blue-500" />;
    return <FileText className="h-16 w-16 text-muted-foreground" />;
  };

  // Handle PDF iframe load error (for browsers like Brave that block iframes)
  const handlePdfError = () => {
    setPdfLoadFailed(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {isPdf && <FileText className="h-5 w-5 text-red-500" />}
              {isExcel && <FileSpreadsheet className="h-5 w-5 text-green-600" />}
              {isImage && <ImageIcon className="h-5 w-5 text-blue-500" />}
              {!isPdf && !isExcel && !isImage && <FileText className="h-5 w-5" />}
              {fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {signedUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => window.open(signedUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in New Tab
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    asChild
                  >
                    <a href={signedUrl} download={fileName}>
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p className="text-lg">Failed to load document</p>
              <p className="text-sm">{error}</p>
              {signedUrl && (
                <Button variant="outline" onClick={() => window.open(signedUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Try Opening in New Tab
                </Button>
              )}
            </div>
          ) : isPdf && signedUrl ? (
            pdfLoadFailed ? (
              // Fallback for browsers that block iframe PDFs (like Brave)
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <FileText className="h-16 w-16 text-red-500" />
                <div className="text-center">
                  <p className="text-lg font-medium">{fileName}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF preview is blocked by your browser's privacy settings
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => window.open(signedUrl, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open PDF in New Tab
                  </Button>
                  <Button asChild>
                    <a href={signedUrl} download={fileName}>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <iframe
                src={`${signedUrl}#view=FitH`}
                className="w-full h-full border-0"
                title={fileName}
                onError={handlePdfError}
                onLoad={(e) => {
                  // Check if iframe loaded empty (blocked by browser)
                  try {
                    const iframe = e.target as HTMLIFrameElement;
                    // If we can't access contentDocument, it's likely blocked
                    if (!iframe.contentDocument && !iframe.contentWindow) {
                      handlePdfError();
                    }
                  } catch {
                    // Cross-origin error means it loaded (external URL)
                  }
                }}
              />
            )
          ) : isImage && signedUrl ? (
            <div className="flex items-center justify-center h-full p-4">
              <img 
                src={signedUrl} 
                alt={fileName} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : signedUrl ? (
            // For non-viewable files (Excel, etc.), show a preview card
            <div className="flex flex-col items-center justify-center h-full gap-6">
              {getFileIcon()}
              <div className="text-center">
                <p className="text-lg font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This file type cannot be previewed in the browser
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => window.open(signedUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button asChild>
                  <a href={signedUrl} download={fileName}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p>No document to display</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
