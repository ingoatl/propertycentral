import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldData {
  api_id: string;
  label: string;
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
}

interface TemplateFieldPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  fields: FieldData[];
  templateName: string;
  onConfirm?: () => void;
  onReanalyze?: () => void;
}

export function TemplateFieldPreview({
  open,
  onOpenChange,
  pdfUrl,
  fields,
  templateName,
  onConfirm,
  onReanalyze,
}: TemplateFieldPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageWidth, setPageWidth] = useState(600);
  const [showFields, setShowFields] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setPageWidth(Math.min(containerRef.current.offsetWidth - 48, 700));
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [open]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const fieldsOnPage = fields.filter(f => f.page === currentPage);
  const guestFields = fields.filter(f => f.filled_by === "guest");
  const adminFields = fields.filter(f => f.filled_by === "admin");

  const getFieldColor = (field: FieldData) => {
    if (field.filled_by === "admin") return "bg-blue-500/20 border-blue-500";
    return "bg-[#fae052]/30 border-[#fae052]";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Preview Field Detection: {templateName}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFields(!showFields)}
                className="gap-1"
              >
                {showFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showFields ? "Hide" : "Show"} Fields
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* PDF Preview */}
          <div ref={containerRef} className="flex-1 overflow-auto bg-[#525252] p-4">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              }
            >
              <div className="relative bg-white shadow-xl mx-auto" style={{ width: pageWidth }}>
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />

                {/* Field Overlays */}
                {showFields && fieldsOnPage.map((field) => (
                  <div
                    key={field.api_id}
                    onClick={() => setSelectedField(field.api_id === selectedField ? null : field.api_id)}
                    className={cn(
                      "absolute border-2 rounded cursor-pointer transition-all",
                      getFieldColor(field),
                      selectedField === field.api_id && "ring-2 ring-offset-1 ring-black"
                    )}
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: field.type === "signature" ? "6%" : `${Math.max(field.height, 2.5)}%`,
                      minHeight: field.type === "signature" ? "40px" : "20px",
                    }}
                  >
                    <div className="absolute -top-5 left-0 text-[10px] bg-black text-white px-1 rounded whitespace-nowrap">
                      {field.label}
                    </div>
                  </div>
                ))}

                {/* Page indicator */}
                <div className="absolute bottom-2 right-2 text-xs text-[#666] bg-white/90 px-2 py-1 rounded shadow">
                  Page {currentPage} of {numPages}
                </div>
              </div>
            </Document>

            {/* Page Navigation */}
            {numPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-white text-sm px-3 py-1">
                  {currentPage} / {numPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  disabled={currentPage === numPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Field List Sidebar */}
          <div className="w-72 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm mb-2">Detected Fields</h3>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className="bg-[#fae052]/20">
                  Guest: {guestFields.length}
                </Badge>
                <Badge variant="outline" className="bg-blue-100">
                  Admin: {adminFields.length}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  No fields detected
                </div>
              ) : (
                <div className="space-y-1">
                  {fields.map((field) => (
                    <button
                      key={field.api_id}
                      onClick={() => {
                        setCurrentPage(field.page);
                        setSelectedField(field.api_id);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded text-sm transition-colors",
                        selectedField === field.api_id
                          ? "bg-[#fae052]/30"
                          : "hover:bg-gray-100"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{field.label}</span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {field.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Page {field.page}</span>
                        <span>•</span>
                        <span className={field.filled_by === "admin" ? "text-blue-600" : "text-amber-600"}>
                          {field.filled_by === "admin" ? "Admin fills" : "Guest fills"}
                        </span>
                        {field.required && (
                          <>
                            <span>•</span>
                            <span className="text-red-500">Required</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {fields.length > 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                {fields.length} fields detected
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                No fields detected - try re-analyzing
              </>
            )}
          </div>
          {onReanalyze && (
            <Button variant="outline" onClick={onReanalyze}>
              Re-analyze
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onConfirm && (
            <Button onClick={onConfirm} className="bg-[#fae052] text-black hover:bg-[#f5d93a]">
              Confirm & Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateFieldPreview;
