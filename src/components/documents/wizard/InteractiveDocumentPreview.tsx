import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, 
  List, PenTool, User, Building, Check, AlertCircle, ChevronUp, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { getFieldLabelInfo } from "@/utils/fieldLabelMapping";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface InteractiveDocumentPreviewProps {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  pdfUrl: string;
}

interface FieldWithPosition extends DetectedField {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  value?: string | boolean;
}

export function InteractiveDocumentPreview({ 
  data, 
  updateData, 
  pdfUrl 
}: InteractiveDocumentPreviewProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showFieldList, setShowFieldList] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pageThumbnails, setPageThumbnails] = useState<number[]>([]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Calculate base width from container
  const baseWidth = 650;
  const scaledWidth = (baseWidth * zoom) / 100;

  // Build fields with positions from template field_mappings
  const [fieldsWithPositions, setFieldsWithPositions] = useState<FieldWithPosition[]>([]);

  useEffect(() => {
    // Wait until we know the actual page count
    if (numPages === 0) {
      console.log('[InteractiveDocumentPreview] Waiting for PDF to load...');
      return;
    }
    
    // Create positioned fields from detected fields
    // SCALE positions based on actual page count vs stored page numbers
    console.log('[InteractiveDocumentPreview] Processing fields:', data.detectedFields.length, 'actualPages:', numPages);
    
    // FILTER: Only include fields that have values OR are signature fields
    // This matches the template analysis behavior - only show filled fields
    const fieldsToShow = data.detectedFields.filter(field => {
      const value = data.fieldValues[field.api_id];
      const hasValue = value !== undefined && value !== null && value.toString().trim() !== "";
      const isSignature = (field.type as string) === "signature" || (field.type as string) === "initials" || field.api_id.includes("signature");
      // Show fields with values or signature fields
      return hasValue || isSignature;
    });
    
    console.log('[InteractiveDocumentPreview] Fields with values to show:', fieldsToShow.length, 'of', data.detectedFields.length);
    
    // Determine the max page number from stored fields to calculate scale factor
    const maxStoredPage = Math.max(1, ...fieldsToShow.map(f => f.page || 1));
    const scaleFactor = maxStoredPage > numPages ? numPages / maxStoredPage : 1;
    console.log('[InteractiveDocumentPreview] Scale factor:', scaleFactor, 'maxStoredPage:', maxStoredPage);
    
    // Group fields by category for fallback positioning
    const categoryPageMap: Record<string, number> = {
      property: 1,
      financial: 1,
      dates: 1,
      occupancy: Math.min(2, numPages),
      contact: Math.min(2, numPages),
      identification: Math.min(2, numPages),
      vehicle: Math.min(3, numPages),
      emergency: Math.min(3, numPages),
      acknowledgment: Math.max(numPages - 1, 1),
      signature: numPages, // Signatures on LAST page
      other: 1,
    };
    
    // Track fields per page for Y positioning (fallback)
    const fieldsPerPage: Record<number, number> = {};
    
    const positioned = fieldsToShow.map((field, index) => {
      const value = data.fieldValues[field.api_id];
      
      // Check if field has position data from field_mappings
      const hasPosition = field.x !== undefined && field.y !== undefined && field.page !== undefined;
      const isSignature = (field.type as string) === "signature" || (field.type as string) === "initials" || field.api_id.includes("signature");
      
      if (hasPosition && field.page !== undefined) {
        // SCALE the stored page number to actual document pages
        let actualPage: number;
        
        if (isSignature) {
          // Signatures ALWAYS go on the last page
          actualPage = numPages;
        } else {
          // Scale other fields proportionally
          actualPage = Math.max(1, Math.min(numPages, Math.ceil(field.page * scaleFactor)));
        }
        
        // IMPORTANT: Adjust stored Y position to avoid overlapping document header
        // Stored positions from AI analysis may place fields too high
        // Add a minimum Y offset of 25% to skip headers/titles on first page
        let adjustedY = field.y!;
        if (actualPage === 1 && adjustedY < 25) {
          // Push fields below the typical document header area
          adjustedY = 25 + (adjustedY * 0.5); // Compress and offset
        }
        
        console.log(`[InteractiveDocumentPreview] Field ${field.api_id}: stored page=${field.page} -> actual page=${actualPage}, y=${field.y} -> ${adjustedY}`);
        return {
          ...field,
          x: field.x!,
          y: adjustedY,
          width: field.width || 40,
          height: field.height || 2.5,
          page: actualPage,
          value,
        };
      }
      
      // Fallback: distribute across pages based on field category/type
      const isDateField = field.type === "date" && (field.api_id.includes("sign") || field.api_id.includes("tenant") || field.api_id.includes("host"));
      const category = field.category || "other";
      
      // Determine page based on category and actual numPages
      let estimatedPage = 1;
      if (isSignature || isDateField) {
        // Signatures and related dates go on the LAST page
        estimatedPage = numPages;
      } else if (categoryPageMap[category]) {
        estimatedPage = categoryPageMap[category];
      } else {
        // Distribute other fields based on index across available pages
        estimatedPage = Math.min(Math.floor(index / 8) + 1, numPages);
      }
      
      // Track and calculate Y position based on fields already on this page
      if (!fieldsPerPage[estimatedPage]) {
        fieldsPerPage[estimatedPage] = 0;
      }
      const fieldIndexOnPage = fieldsPerPage[estimatedPage];
      fieldsPerPage[estimatedPage]++;
      
      // Grid positioning within page - 2 columns
      const row = Math.floor(fieldIndexOnPage / 2);
      const col = fieldIndexOnPage % 2;
      
      // Start fields lower on the page to avoid document headers
      // For first page, start at 30% to skip title/header
      const pageYOffset = estimatedPage === 1 ? 30 : 15;
      
      // Special handling for signature fields - place them at bottom
      let yPos = pageYOffset + (row * 8);
      if (isSignature) {
        yPos = 65 + (fieldIndexOnPage * 10); // Start at 65% from top
      }
      
      console.log(`[InteractiveDocumentPreview] Field ${field.api_id}: fallback page=${estimatedPage}, y=${yPos}, category=${category}`);
      
      return {
        ...field,
        x: 5 + (col * 48),
        y: Math.min(yPos, 88), // Don't go off page
        width: 42,
        height: isSignature ? 5 : 3,
        page: estimatedPage,
        value,
      };
    });
    
    setFieldsWithPositions(positioned);
  }, [data.detectedFields, data.fieldValues, numPages]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageThumbnails(Array.from({ length: numPages }, (_, i) => i + 1));
  };

  // Get admin-filled and guest fields
  const adminFields = fieldsWithPositions.filter(f => f.filled_by === "admin");
  const guestFields = fieldsWithPositions.filter(f => f.filled_by === "guest" || f.filled_by === "tenant");
  const signatureFields = fieldsWithPositions.filter(f => f.type === "signature");

  // Get filled vs unfilled admin fields
  const filledAdminFields = adminFields.filter(f => {
    const val = data.fieldValues[f.api_id];
    return val && val.toString().trim() !== "";
  });
  const unfilledAdminFields = adminFields.filter(f => {
    const val = data.fieldValues[f.api_id];
    return !val || val.toString().trim() === "";
  });

  // Navigate between fields
  const allEditableFields = [...adminFields];
  const navigateToField = (direction: "next" | "prev") => {
    if (allEditableFields.length === 0) return;
    
    let newIndex = currentFieldIndex;
    if (direction === "next") {
      newIndex = (currentFieldIndex + 1) % allEditableFields.length;
    } else {
      newIndex = currentFieldIndex - 1 < 0 ? allEditableFields.length - 1 : currentFieldIndex - 1;
    }
    
    setCurrentFieldIndex(newIndex);
    const field = allEditableFields[newIndex];
    setSelectedFieldId(field.api_id);
    
    // Go to the field's page if needed
    if (field.page !== currentPage) {
      setCurrentPage(field.page);
    }
  };

  const jumpToField = (fieldId: string) => {
    const field = fieldsWithPositions.find(f => f.api_id === fieldId);
    if (field) {
      setSelectedFieldId(fieldId);
      setCurrentPage(field.page);
      const idx = allEditableFields.findIndex(f => f.api_id === fieldId);
      if (idx >= 0) setCurrentFieldIndex(idx);
    }
  };

  const startEditing = (field: FieldWithPosition) => {
    setEditingFieldId(field.api_id);
    setEditValue((data.fieldValues[field.api_id] as string) || "");
  };

  const saveEdit = () => {
    if (editingFieldId) {
      updateData({
        fieldValues: {
          ...data.fieldValues,
          [editingFieldId]: editValue,
        },
      });
      setEditingFieldId(null);
    }
  };

  const cancelEdit = () => {
    setEditingFieldId(null);
    setEditValue("");
  };

  const getFieldColor = (field: FieldWithPosition) => {
    const hasValue = data.fieldValues[field.api_id] && 
      data.fieldValues[field.api_id].toString().trim() !== "";
    
    if (field.type === "signature") {
      if (field.filled_by === "guest" || field.filled_by === "tenant") {
        return "bg-orange-100/80 border-orange-400 border-dashed";
      }
      return "bg-purple-100/80 border-purple-400 border-dashed";
    }
    
    if (field.filled_by === "admin") {
      if (hasValue) {
        return "bg-yellow-100/90 border-yellow-500";
      }
      return "bg-red-50/80 border-red-400 border-dashed";
    }
    
    if (field.filled_by === "guest" || field.filled_by === "tenant") {
      return "bg-blue-50/80 border-blue-400 border-dashed";
    }
    
    return "bg-gray-100/50 border-gray-300";
  };

  const fieldsOnCurrentPage = fieldsWithPositions.filter(f => f.page === currentPage);

  return (
    <TooltipProvider>
      <div className="flex h-[600px] border rounded-lg overflow-hidden bg-background">
        {/* Page Thumbnails Sidebar */}
        <div className="w-20 bg-muted/50 border-r flex flex-col">
          <div className="p-2 text-xs font-medium text-center border-b">Pages</div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {pageThumbnails.map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-full aspect-[8.5/11] rounded border-2 flex items-center justify-center text-xs font-medium transition-all",
                    currentPage === pageNum 
                      ? "border-primary bg-primary/10" 
                      : "border-muted-foreground/20 hover:border-primary/50"
                  )}
                >
                  {pageNum}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Document View */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {/* Page Navigation */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[80px] text-center">
                {currentPage} / {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6 mx-2" />

              {/* Zoom Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(z => Math.max(50, z - 25))}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[50px] text-center">{zoom}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(z => Math.min(200, z + 25))}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(100)}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>

            {/* Field Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToField("prev")}
                disabled={allEditableFields.length === 0}
              >
                <ChevronUp className="h-4 w-4" />
                Prev Field
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToField("next")}
                disabled={allEditableFields.length === 0}
              >
                Next Field
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFieldList(!showFieldList)}
                className={cn(showFieldList && "bg-muted")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Document + Field List */}
          <div className="flex-1 flex overflow-hidden">
            {/* PDF Container */}
            <div ref={containerRef} className="flex-1 overflow-auto bg-[#525659] p-6">
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
                  className="relative bg-white shadow-2xl mx-auto" 
                  style={{ width: scaledWidth }}
                >
                  <Page
                    pageNumber={currentPage}
                    width={scaledWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />

                  {/* Field Overlays */}
                  {fieldsOnCurrentPage.map((field) => {
                    const labelInfo = getFieldLabelInfo(field.api_id, field.label);
                    const fieldValue = data.fieldValues[field.api_id];
                    const hasValue = fieldValue && fieldValue.toString().trim() !== "";
                    const isSelected = selectedFieldId === field.api_id;
                    const isEditing = editingFieldId === field.api_id;
                    const isSignature = field.type === "signature";
                    const isGuestField = field.filled_by === "guest" || field.filled_by === "tenant";

                    // For now, show fields in a list-style view within the document area
                    // In production, these positions would come from actual PDF field extraction
                    return (
                      <Tooltip key={field.api_id}>
                        <Popover 
                          open={isEditing} 
                          onOpenChange={(open) => !open && cancelEdit()}
                        >
                          <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                              <div
                                onClick={() => {
                                  setSelectedFieldId(field.api_id);
                                  if (field.filled_by === "admin" && !isSignature) {
                                    startEditing(field);
                                  }
                                }}
                                className={cn(
                                  "absolute border-2 rounded cursor-pointer transition-all hover:shadow-md",
                                  getFieldColor(field),
                                  isSelected && "ring-2 ring-primary ring-offset-2 z-20"
                                )}
                                style={{
                                  left: `${field.x}%`,
                                  top: `${field.y}%`,
                                  width: `${field.width}%`,
                                  height: isSignature ? "4%" : `${field.height}%`,
                                  minHeight: isSignature ? 40 : 24,
                                }}
                              >
                                {/* Field Value Display */}
                                <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                                  {isSignature ? (
                                    <div className="flex items-center gap-1 text-xs font-medium opacity-70">
                                      <PenTool className="h-3 w-3" />
                                      {isGuestField ? "Guest Signs Here" : "Host Signs Here"}
                                    </div>
                                  ) : hasValue ? (
                                    <span className="text-xs truncate">{fieldValue as string}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">
                                      {labelInfo.placeholder || labelInfo.label}
                                    </span>
                                  )}
                                </div>

                                {/* Status Indicator */}
                                <div className="absolute -top-2 -right-2">
                                  {field.filled_by === "admin" && !isSignature && (
                                    hasValue ? (
                                      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      </div>
                                    ) : (
                                      <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                                        <AlertCircle className="h-2.5 w-2.5 text-white" />
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            </PopoverTrigger>
                          </TooltipTrigger>

                          {/* Edit Popover */}
                          <PopoverContent className="w-80" align="start">
                            <div className="space-y-3">
                              <div>
                                <div className="font-medium text-sm">{labelInfo.label}</div>
                                {labelInfo.description && (
                                  <p className="text-xs text-muted-foreground">{labelInfo.description}</p>
                                )}
                              </div>
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={labelInfo.placeholder}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={saveEdit}>
                                  Save
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>

                        <TooltipContent side="top">
                          <div className="text-xs">
                            <div className="font-medium">{labelInfo.label}</div>
                            <div className="text-muted-foreground capitalize">
                              {field.filled_by === "admin" ? "Pre-filled by Admin" : 
                               field.filled_by === "guest" ? "Filled by Guest" : "Filled by Tenant"}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </Document>
            </div>

            {/* Field List Sidebar */}
            {showFieldList && (
              <div className="w-72 border-l bg-background flex flex-col">
                <div className="p-3 border-b">
                  <div className="text-sm font-medium mb-2">Document Fields</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs bg-yellow-50">
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      Filled: {filledAdminFields.length}
                    </Badge>
                    {unfilledAdminFields.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-red-50">
                        <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                        Empty: {unfilledAdminFields.length}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      <User className="h-3 w-3 mr-1" />
                      Guest: {guestFields.length}
                    </Badge>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {/* Admin Fields */}
                    {adminFields.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          Admin Pre-filled
                        </div>
                        {adminFields.map((field) => {
                          const labelInfo = getFieldLabelInfo(field.api_id, field.label);
                          const value = data.fieldValues[field.api_id];
                          const hasValue = value && value.toString().trim() !== "";
                          
                          return (
                            <button
                              key={field.api_id}
                              onClick={() => jumpToField(field.api_id)}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors flex items-center gap-2",
                                selectedFieldId === field.api_id && "bg-muted"
                              )}
                            >
                              <div className={cn(
                                "h-2 w-2 rounded-full flex-shrink-0",
                                hasValue ? "bg-green-500" : "bg-red-400"
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{labelInfo.label}</div>
                                {hasValue && (
                                  <div className="text-muted-foreground truncate">{value as string}</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Guest Fields */}
                    {guestFields.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Guest Completes
                        </div>
                        {guestFields.map((field) => {
                          const labelInfo = getFieldLabelInfo(field.api_id, field.label);
                          
                          return (
                            <div
                              key={field.api_id}
                              className="px-2 py-1.5 rounded text-xs text-muted-foreground"
                            >
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="truncate">{labelInfo.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Signature Fields */}
                    {signatureFields.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                          <PenTool className="h-3 w-3" />
                          Signatures
                        </div>
                        {signatureFields.map((field) => {
                          const isGuest = field.filled_by === "guest" || field.filled_by === "tenant";
                          
                          return (
                            <div
                              key={field.api_id}
                              className="px-2 py-1.5 rounded text-xs text-muted-foreground"
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "h-2 w-2 rounded-full flex-shrink-0",
                                  isGuest ? "bg-orange-400" : "bg-purple-400"
                                )} />
                                <span className="truncate">
                                  {isGuest ? "Guest Signature" : "Host Signature"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Legend */}
                <div className="p-3 border-t bg-muted/30">
                  <div className="text-xs font-medium mb-2">Legend</div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-6 bg-yellow-100 border-2 border-yellow-500 rounded" />
                      <span>Admin filled</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-6 bg-red-50 border-2 border-red-400 border-dashed rounded" />
                      <span>Empty field</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-6 bg-blue-50 border-2 border-blue-400 border-dashed rounded" />
                      <span>Guest field</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-6 bg-orange-100 border-2 border-orange-400 border-dashed rounded" />
                      <span>Signature</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default InteractiveDocumentPreview;
