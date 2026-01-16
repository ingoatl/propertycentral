import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, ChevronLeft, ChevronRight, Move, Grid3X3, Plus, Trash2, Save } from "lucide-react";
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
  filled_by: "admin" | "guest" | "tenant";
  required: boolean;
  group_name?: string;
}

interface NewFieldFormData {
  label: string;
  type: FieldData["type"];
  filled_by: "admin" | "guest" | "tenant";
}

interface TemplateFieldPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  fields: FieldData[];
  templateName: string;
  onSave?: (fields: FieldData[]) => Promise<void>;
  onReanalyze?: () => void;
}

export function TemplateFieldPreview({
  open,
  onOpenChange,
  pdfUrl,
  fields,
  templateName,
  onSave,
  onReanalyze,
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
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [newFieldData, setNewFieldData] = useState<NewFieldFormData>({
    label: "",
    type: "text",
    filled_by: "guest",
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Sync local fields with props
  useEffect(() => {
    setLocalFields(fields);
    setHasChanges(false);
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
  
  // Group fields by filled_by - now includes tenant
  const ownerFields = localFields.filter(f => f.filled_by === "guest" || f.api_id.includes("owner"));
  const tenantFields = localFields.filter(f => f.filled_by === "tenant");
  const adminFields = localFields.filter(f => f.filled_by === "admin" || f.api_id.includes("manager") || f.api_id.includes("landlord"));

  const getFieldColor = (field: FieldData) => {
    if (field.filled_by === "admin") return "bg-blue-500/30 border-blue-500";
    if (field.filled_by === "tenant") return "bg-green-500/30 border-green-500";
    if (field.type === "radio") return "bg-purple-500/30 border-purple-500";
    return "bg-[#fae052]/40 border-[#fae052]";
  };

  const handleMouseDown = (e: React.MouseEvent, field: FieldData) => {
    if (e.button !== 0) return;
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
    setHasChanges(true);
  }, [isDragging, selectedField, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
    setLocalFields(prev => prev.map(f => {
      if (f.api_id !== fieldId) return f;
      const newValue = Math.max(2, Math.min(80, f[dimension] + delta));
      return { ...f, [dimension]: newValue };
    }));
    setHasChanges(true);
  };

  const updateField = (fieldId: string, updates: Partial<FieldData>) => {
    setLocalFields(prev => prev.map(f => 
      f.api_id === fieldId ? { ...f, ...updates } : f
    ));
    setHasChanges(true);
  };

  const openAddFieldDialog = () => {
    setNewFieldData({ label: "", type: "text", filled_by: "guest" });
    setShowAddFieldDialog(true);
  };

  const confirmAddField = () => {
    if (!newFieldData.label.trim()) return;
    
    const apiId = newFieldData.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const newField: FieldData = {
      api_id: `${apiId}_${Date.now()}`,
      label: newFieldData.label,
      type: newFieldData.type,
      page: currentPage,
      x: 10,
      y: 10,
      width: newFieldData.type === "checkbox" || newFieldData.type === "radio" ? 3 : 25,
      height: newFieldData.type === "signature" ? 4 : 2.5,
      filled_by: newFieldData.filled_by,
      required: false,
    };
    setLocalFields(prev => [...prev, newField]);
    setSelectedField(newField.api_id);
    setHasChanges(true);
    setShowAddFieldDialog(false);
  };

  const deleteField = (fieldId: string) => {
    setLocalFields(prev => prev.filter(f => f.api_id !== fieldId));
    if (selectedField === fieldId) setSelectedField(null);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(localFields);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const selectedFieldData = localFields.find(f => f.api_id === selectedField);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>{templateName}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openAddFieldDialog}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </Button>
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
              >
                {showFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                      backgroundSize: '5% 2.5%',
                    }}
                  />
                )}

                {/* Field Overlays - Clean boxes only */}
                {showFields && fieldsOnPage.map((field) => {
                  const fieldHeight = field.type === "signature" 
                    ? Math.min(field.height || 4, 5)
                    : field.type === "checkbox" || field.type === "radio"
                      ? 2.2
                      : Math.min(field.height || 2.5, 3);
                  
                  return (
                    <div
                      key={field.api_id}
                      onMouseDown={(e) => handleMouseDown(e, field)}
                      className={cn(
                        "absolute border-2 rounded-sm transition-all",
                        getFieldColor(field),
                        selectedField === field.api_id && "ring-2 ring-offset-1 ring-primary shadow-lg z-10",
                        isDragging && selectedField === field.api_id ? "cursor-grabbing opacity-80" : "cursor-grab hover:opacity-90"
                      )}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: field.type === "checkbox" || field.type === "radio" ? "2.2%" : `${field.width}%`,
                        height: `${fieldHeight}%`,
                      }}
                    />
                  );
                })}

                {/* Page indicator */}
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-white/90 px-2 py-1 rounded shadow">
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

          {/* Sidebar */}
          <div className="w-72 border-l bg-background flex flex-col">
            <div className="p-4 border-b">
              <div className="flex flex-wrap gap-2 text-xs mb-2">
                {ownerFields.length > 0 && (
                  <Badge variant="outline" className="bg-[#fae052]/20">Owner: {ownerFields.length}</Badge>
                )}
                {tenantFields.length > 0 && (
                  <Badge variant="outline" className="bg-green-100 text-green-700">Tenant: {tenantFields.length}</Badge>
                )}
                <Badge variant="outline" className="bg-blue-100">Admin: {adminFields.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Move className="h-3 w-3" /> Drag to move
              </p>
            </div>

            {/* Selected field editor */}
            {selectedFieldData && (
              <div className="p-3 border-b bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Edit Field</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => deleteField(selectedFieldData.api_id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={selectedFieldData.label}
                  onChange={(e) => updateField(selectedFieldData.api_id, { label: e.target.value })}
                  className="h-7 text-xs"
                  placeholder="Field label"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select 
                    value={selectedFieldData.type} 
                    onValueChange={(v) => updateField(selectedFieldData.api_id, { type: v as FieldData['type'] })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="signature">Signature</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="radio">Radio</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={selectedFieldData.filled_by} 
                    onValueChange={(v) => updateField(selectedFieldData.api_id, { filled_by: v as "admin" | "guest" | "tenant" })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Owner</SelectItem>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateFieldSize(selectedFieldData.api_id, 'width', -5)}>W-</Button>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateFieldSize(selectedFieldData.api_id, 'width', 5)}>W+</Button>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateFieldSize(selectedFieldData.api_id, 'height', -0.5)}>H-</Button>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => updateFieldSize(selectedFieldData.api_id, 'height', 0.5)}>H+</Button>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 p-2">
              {localFields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  No fields - click "Add Field"
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
                        "w-full text-left p-2 rounded text-xs transition-colors",
                        selectedField === field.api_id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium truncate">{field.label}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{field.type}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span>P{field.page}</span>
                        <span className={
                          field.filled_by === "admin" ? "text-blue-600" : 
                          field.filled_by === "tenant" ? "text-green-600" : 
                          "text-amber-600"
                        }>
                          {field.filled_by === "admin" ? "Admin" : field.filled_by === "tenant" ? "Tenant" : "Owner"}
                        </span>
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
            {hasChanges ? (
              <span className="text-amber-600">Unsaved changes</span>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                {localFields.length} fields
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
          {onSave && (
            <Button 
              onClick={handleSave} 
              disabled={saving || !hasChanges}
              className="gap-2 bg-[#fae052] text-black hover:bg-[#f5d93a]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Add Field Dialog */}
      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="field-label">Field Label</Label>
              <Input
                id="field-label"
                placeholder="e.g., Owner Name, Signature Date"
                value={newFieldData.label}
                onChange={(e) => setNewFieldData(prev => ({ ...prev, label: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select 
                value={newFieldData.type} 
                onValueChange={(v) => setNewFieldData(prev => ({ ...prev, type: v as FieldData['type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="signature">Signature</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="radio">Radio</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Who fills this field?</Label>
              <Select 
                value={newFieldData.filled_by} 
                onValueChange={(v) => setNewFieldData(prev => ({ ...prev, filled_by: v as "admin" | "guest" | "tenant" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">
                    <div className="flex flex-col">
                      <span>Owner / Guest</span>
                      <span className="text-xs text-muted-foreground">Property owner (management agreements)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="tenant">
                    <div className="flex flex-col">
                      <span>Tenant / Renter</span>
                      <span className="text-xs text-muted-foreground">Tenant fills this (lease agreements)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex flex-col">
                      <span>Admin / Landlord</span>
                      <span className="text-xs text-muted-foreground">Your team pre-fills this</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmAddField}
              disabled={!newFieldData.label.trim()}
              className="bg-[#fae052] text-black hover:bg-[#f5d93a]"
            >
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default TemplateFieldPreview;
