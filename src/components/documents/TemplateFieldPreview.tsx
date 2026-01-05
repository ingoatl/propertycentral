import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, ChevronLeft, ChevronRight, Move, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldData {
  api_id: string;
  label: string;
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox" | "radio";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
  group_name?: string;
}

interface TemplateFieldPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  fields: FieldData[];
  templateName: string;
  onConfirm?: () => void;
  onReanalyze?: () => void;
  onFieldsUpdate?: (fields: FieldData[]) => void;
}

export function TemplateFieldPreview({
  open,
  onOpenChange,
  pdfUrl,
  fields,
  templateName,
  onConfirm,
  onReanalyze,
  onFieldsUpdate,
}: TemplateFieldPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageWidth, setPageWidth] = useState(600);
  const [pageHeight, setPageHeight] = useState(800);
  const [showFields, setShowFields] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [localFields, setLocalFields] = useState<FieldData[]>(fields);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Sync local fields with props
  useEffect(() => {
    setLocalFields(fields);
  }, [fields]);

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

  const onPageLoadSuccess = useCallback((page: any) => {
    const { height, width } = page;
    const scale = pageWidth / width;
    setPageHeight(height * scale);
  }, [pageWidth]);

  const fieldsOnPage = localFields.filter(f => f.page === currentPage);
  const guestFields = localFields.filter(f => f.filled_by === "guest");
  const adminFields = localFields.filter(f => f.filled_by === "admin");

  const getFieldColor = (field: FieldData) => {
    if (field.filled_by === "admin") return "bg-blue-500/20 border-blue-500";
    if (field.type === "radio") return "bg-purple-500/20 border-purple-500";
    return "bg-[#fae052]/30 border-[#fae052]";
  };

  const handleMouseDown = (e: React.MouseEvent, field: FieldData) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedField(field.api_id);
    setIsDragging(true);
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedField || !pageRef.current) return;
    
    const pageRect = pageRef.current.getBoundingClientRect();
    const newX = ((e.clientX - pageRect.left - dragOffset.x) / pageRect.width) * 100;
    const newY = ((e.clientY - pageRect.top - dragOffset.y) / pageRect.height) * 100;
    
    setLocalFields(prev => prev.map(f => 
      f.api_id === selectedField 
        ? { ...f, x: Math.max(0, Math.min(95, newX)), y: Math.max(0, Math.min(95, newY)) }
        : f
    ));
  }, [isDragging, selectedField, dragOffset]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && onFieldsUpdate) {
      onFieldsUpdate(localFields);
    }
    setIsDragging(false);
  }, [isDragging, localFields, onFieldsUpdate]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const updateFieldSize = (fieldId: string, dimension: 'width' | 'height', delta: number) => {
    setLocalFields(prev => {
      const updated = prev.map(f => {
        if (f.api_id !== fieldId) return f;
        const newValue = Math.max(2, Math.min(80, f[dimension] + delta));
        return { ...f, [dimension]: newValue };
      });
      if (onFieldsUpdate) onFieldsUpdate(updated);
      return updated;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Preview Field Detection: {templateName}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGrid(!showGrid)}
                className={cn("gap-1", showGrid && "bg-muted")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
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
              <div 
                ref={pageRef}
                className="relative bg-white shadow-xl mx-auto" 
                style={{ width: pageWidth }}
              >
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={onPageLoadSuccess}
                />

                {/* Grid Overlay */}
                {showGrid && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `
                        linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                      `,
                      backgroundSize: '10% 10%',
                    }}
                  />
                )}

                {/* Field Overlays */}
                {showFields && fieldsOnPage.map((field) => (
                  <div
                    key={field.api_id}
                    onMouseDown={(e) => handleMouseDown(e, field)}
                    className={cn(
                      "absolute border-2 rounded transition-all",
                      getFieldColor(field),
                      selectedField === field.api_id && "ring-2 ring-offset-1 ring-black",
                      isDragging && selectedField === field.api_id ? "cursor-grabbing" : "cursor-grab"
                    )}
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: field.type === "signature" ? "6%" : `${Math.max(field.height, 2.5)}%`,
                      minHeight: field.type === "signature" ? "40px" : "20px",
                    }}
                  >
                    {/* Field Label */}
                    <div className="absolute -top-5 left-0 text-[10px] bg-black text-white px-1 rounded whitespace-nowrap flex items-center gap-1">
                      <Move className="h-2 w-2" />
                      {field.label}
                    </div>
                    
                    {/* Coordinates Display */}
                    {selectedField === field.api_id && (
                      <div className="absolute -bottom-6 left-0 text-[9px] bg-gray-800 text-white px-1 rounded whitespace-nowrap">
                        x:{field.x.toFixed(1)}% y:{field.y.toFixed(1)}% w:{field.width.toFixed(1)}%
                      </div>
                    )}
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
          <div className="w-80 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm mb-2">Detected Fields</h3>
              <div className="flex gap-2 text-xs flex-wrap">
                <Badge variant="outline" className="bg-[#fae052]/20">
                  Guest: {guestFields.length}
                </Badge>
                <Badge variant="outline" className="bg-blue-100">
                  Admin: {adminFields.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <Move className="h-3 w-3 inline mr-1" />
                Drag fields to reposition
              </p>
            </div>

            <ScrollArea className="flex-1 p-2">
              {localFields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  No fields detected
                </div>
              ) : (
                <div className="space-y-1">
                  {localFields.map((field) => (
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
                      {field.group_name && (
                        <div className="text-xs text-purple-600 mt-1">
                          Group: {field.group_name}
                        </div>
                      )}
                      {/* Position info */}
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">
                        x:{field.x.toFixed(1)} y:{field.y.toFixed(1)} w:{field.width.toFixed(1)} h:{field.height.toFixed(1)}
                      </div>
                      
                      {/* Size adjustment buttons when selected */}
                      {selectedField === field.api_id && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); updateFieldSize(field.api_id, 'width', -5); }}
                          >
                            W-
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); updateFieldSize(field.api_id, 'width', 5); }}
                          >
                            W+
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); updateFieldSize(field.api_id, 'height', -1); }}
                          >
                            H-
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); updateFieldSize(field.api_id, 'height', 1); }}
                          >
                            H+
                          </Button>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {localFields.length > 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                {localFields.length} fields detected
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
