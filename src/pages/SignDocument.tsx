import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Document, Page, pdfjs } from "react-pdf";
import { InlineField, FieldData } from "@/components/signing/InlineField";
import { InlineSignature } from "@/components/signing/InlineSignature";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SigningData {
  valid: boolean;
  tokenId: string;
  documentId: string;
  documentName: string;
  contractType: string;
  signerName: string;
  signerEmail: string;
  signerType: string;
  pdfUrl: string | null;
  signers: {
    name: string;
    email: string;
    type: string;
    order: number;
    signed: boolean;
    signedAt: string | null;
  }[];
  expiresAt: string;
  fields: FieldData[];
  savedFieldValues: Record<string, string | boolean>;
}

const SignDocument = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SigningData | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  
  // PDF states
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(800);
  const [pdfPageHeights, setPdfPageHeights] = useState<Map<number, number>>(new Map());
  
  // Field interaction states
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [showSignatureFor, setShowSignatureFor] = useState<string | null>(null);
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());
  const [showFieldList, setShowFieldList] = useState(false);

  // Filter fields for current signer
  // Owner 2 fields are NOT mandatory - they become active only when clicked
  const allGuestFields = (data?.fields || []).filter(f => f.filled_by === "guest");
  const adminFields = (data?.fields || []).filter(f => f.filled_by === "admin");
  
  // Determine if a field belongs to Owner 2 (secondary signer) based on label/group
  const isOwner2Field = (f: FieldData) => {
    const label = f.label.toLowerCase();
    return label.includes("owner 2") || label.includes("owner2") || label.includes("second owner");
  };
  
  // Required fields are: Owner 1 fields that are marked required + radio groups (one selection per group)
  const signerFields = allGuestFields;
  
  // Get all unique radio groups
  const radioGroups = new Set<string>();
  signerFields.filter(f => f.type === "radio" && f.group_name).forEach(f => radioGroups.add(f.group_name!));
  
  // Check if a radio group is complete (at least one selected)
  const isRadioGroupComplete = (groupName: string) => {
    const groupFields = signerFields.filter(f => f.type === "radio" && f.group_name === groupName);
    return groupFields.some(f => fieldValues[f.api_id] === true);
  };
  
  // Calculate required fields - Owner 2 fields are NOT required
  const requiredFields = signerFields.filter(f => {
    if (isOwner2Field(f)) return false; // Owner 2 fields are optional
    if (f.type === "radio") return false; // Radio handled separately by group
    return f.required;
  });
  
  // Count completed required fields
  const completedRequired = requiredFields.filter(f => {
    if (f.type === "signature") return !!signatureData;
    return completedFields.has(f.api_id);
  }).length;
  
  // Total required = required fields + radio groups (each group counts as 1)
  const totalRequired = requiredFields.length + radioGroups.size;
  
  // Completed radio groups
  const completedRadioGroups = Array.from(radioGroups).filter(g => isRadioGroupComplete(g)).length;
  
  // Total completed
  const totalCompleted = completedRequired + completedRadioGroups;
  
  // Remaining fields to complete
  const remainingCount = totalRequired - totalCompleted;

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 32, 900);
        setPageWidth(width);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const validateToken = async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke("validate-signing-token", {
        body: { token },
      });

      if (error) throw error;
      
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        
        // Initialize field values
        const initialValues: Record<string, string | boolean> = {};
        const completed = new Set<string>();
        
        result.fields?.forEach((field: FieldData) => {
          if (result.savedFieldValues?.[field.api_id] !== undefined) {
            initialValues[field.api_id] = result.savedFieldValues[field.api_id];
            if (result.savedFieldValues[field.api_id]) {
              completed.add(field.api_id);
            }
          } else if (field.type === "checkbox") {
            initialValues[field.api_id] = false;
          } else {
            initialValues[field.api_id] = "";
          }
        });
        setFieldValues(initialValues);
        setCompletedFields(completed);
      }
    } catch (err: any) {
      console.error("Error validating token:", err);
      setError(err.message || "Failed to validate signing link");
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = useCallback((pageNum: number, page: any) => {
    setPdfPageHeights(prev => {
      const next = new Map(prev);
      next.set(pageNum, page.height);
      return next;
    });
  }, []);

  const handleFieldChange = (fieldId: string, value: string | boolean, field?: FieldData) => {
    // For radio fields, clear other selections in the same group
    if (field?.type === "radio" && field.group_name && value === true) {
      const groupFields = [...signerFields, ...adminFields].filter(
        f => f.type === "radio" && f.group_name === field.group_name && f.api_id !== fieldId
      );
      
      setFieldValues(prev => {
        const next = { ...prev, [fieldId]: value };
        groupFields.forEach(f => {
          next[f.api_id] = false;
        });
        return next;
      });
      
      setCompletedFields(prev => {
        const next = new Set(prev);
        next.add(fieldId);
        // Don't remove group fields from completed - the group itself is complete
        return next;
      });
      return;
    }
    
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    
    if (value || value === false) {
      setCompletedFields(prev => new Set([...prev, fieldId]));
    } else {
      setCompletedFields(prev => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
    }
  };

  // Track separate signatures for Owner 1 and Owner 2
  const [owner2SignatureData, setOwner2SignatureData] = useState<string | null>(null);
  
  const handleSignatureAdopt = (sigData: string) => {
    const currentSignatureField = signerFields.find(f => f.api_id === showSignatureFor);
    
    if (currentSignatureField && isOwner2Field(currentSignatureField)) {
      // Owner 2 is signing - only apply to Owner 2 fields
      setOwner2SignatureData(sigData);
      setCompletedFields(prev => new Set([...prev, currentSignatureField.api_id]));
      toast.success("Owner 2 signature adopted!");
    } else {
      // Owner 1 is signing - only apply to Owner 1 signature fields
      setSignatureData(sigData);
      signerFields
        .filter(f => f.type === "signature" && !isOwner2Field(f))
        .forEach(f => {
          setCompletedFields(prev => new Set([...prev, f.api_id]));
        });
      toast.success("Signature adopted!");
    }
    
    setShowSignatureFor(null);
  };

  const handleSubmitSignature = async () => {
    if (!signatureData) {
      toast.error("Please add your signature");
      return;
    }

    if (!agreedToTerms) {
      toast.error("Please agree to sign electronically");
      return;
    }

    // Check required non-Owner2 fields (Owner 2 fields are optional)
    const missingFields: FieldData[] = [];
    const checkedRadioGroups = new Set<string>();
    
    for (const f of signerFields) {
      // Skip Owner 2 fields - they're optional
      if (isOwner2Field(f)) continue;
      
      // Handle radio groups - only check once per group
      if (f.type === "radio" && f.group_name) {
        if (checkedRadioGroups.has(f.group_name)) continue;
        checkedRadioGroups.add(f.group_name);
        
        if (!isRadioGroupComplete(f.group_name)) {
          missingFields.push(f);
        }
        continue;
      }
      
      // Skip non-required and checkboxes
      if (!f.required) continue;
      if (f.type === "checkbox") continue;
      
      // Check signature
      if (f.type === "signature" && !signatureData) {
        missingFields.push(f);
        continue;
      }
      
      // Check other fields
      if (!fieldValues[f.api_id]) {
        missingFields.push(f);
      }
    }

    if (missingFields.length > 0) {
      const firstMissing = missingFields[0];
      const label = firstMissing.type === "radio" && firstMissing.group_name 
        ? `Select a ${firstMissing.group_name.replace(/_/g, ' ')}`
        : firstMissing.label;
      toast.error(`Please complete: ${label}`);
      navigateToField(firstMissing);
      return;
    }

    setSubmitting(true);

    try {
      const { data: result, error } = await supabase.functions.invoke("submit-signature", {
        body: {
          token,
          signatureData,
          agreedToTerms,
          fieldValues,
        },
      });

      if (error) throw error;

      if (result.error) {
        toast.error(result.error);
      } else {
        setIsComplete(true);
        toast.success(result.message);
      }
    } catch (err: any) {
      console.error("Error submitting signature:", err);
      toast.error(err.message || "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToField = (field: FieldData) => {
    const pageEl = pageRefs.current.get(field.page);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    
    setActiveFieldId(null);
    setShowSignatureFor(null);
    
    setTimeout(() => {
      if (field.type === "signature") {
        setShowSignatureFor(field.api_id);
      } else {
        setActiveFieldId(field.api_id);
      }
    }, 300);
  };

  // Sort fields STRICTLY by page, then Y (top to bottom), then X (left to right)
  // Using a smaller threshold to ensure proper ordering
  const sortedSignerFields = [...signerFields].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    // Primary sort by Y - round to nearest integer for comparison
    const yA = Math.round(a.y);
    const yB = Math.round(b.y);
    if (yA !== yB) return yA - yB;
    // Same Y level, sort by X
    return a.x - b.x;
  });

  // Check if a field is incomplete - Owner 2 fields are considered complete (optional)
  const isFieldIncomplete = (f: FieldData) => {
    // Owner 2 fields are optional, never considered incomplete for navigation
    if (isOwner2Field(f)) return false;
    
    if (f.type === "signature") return !signatureData;
    if (f.type === "radio" && f.group_name) {
      // For radio groups, check if ANY field in the group is selected
      return !isRadioGroupComplete(f.group_name);
    }
    return !completedFields.has(f.api_id);
  };

  // Get fields that need to be completed in document order
  const getRequiredIncompleteFields = () => {
    const seenGroups = new Set<string>();
    const result: FieldData[] = [];
    
    for (const f of sortedSignerFields) {
      // Skip Owner 2 fields entirely
      if (isOwner2Field(f)) continue;
      
      // For radio groups - only add ONE field per incomplete group
      if (f.type === "radio" && f.group_name) {
        // Skip if we've already handled this group
        if (seenGroups.has(f.group_name)) continue;
        seenGroups.add(f.group_name);
        
        // If group is complete, skip it
        if (isRadioGroupComplete(f.group_name)) continue;
        
        // Group is incomplete - add the first radio of this group
        result.push(f);
        continue;
      }
      
      // For non-radio fields, add if incomplete
      if (isFieldIncomplete(f)) {
        result.push(f);
      }
    }
    
    return result;
  };

  const findNextIncompleteField = () => {
    return getRequiredIncompleteFields()[0];
  };

  const handleStart = () => {
    const firstIncomplete = findNextIncompleteField();
    if (firstIncomplete) {
      navigateToField(firstIncomplete);
    }
  };

  const handleNext = () => {
    const incompleteFields = getRequiredIncompleteFields();
    
    if (incompleteFields.length === 0) {
      toast.success("All fields complete! Click FINISH to submit.");
      return;
    }
    
    const currentId = activeFieldId || showSignatureFor;
    
    // If no current field, go to first incomplete
    if (!currentId) {
      navigateToField(incompleteFields[0]);
      return;
    }
    
    // Find current field's position in document order
    const currentField = sortedSignerFields.find(f => f.api_id === currentId);
    if (!currentField) {
      navigateToField(incompleteFields[0]);
      return;
    }
    
    // Find current field index in the sorted incomplete list
    const currentIdx = sortedSignerFields.findIndex(f => f.api_id === currentId);
    
    // Find the next incomplete field after current position in sorted order
    for (let i = currentIdx + 1; i < sortedSignerFields.length; i++) {
      const f = sortedSignerFields[i];
      if (isOwner2Field(f)) continue;
      
      // Check if this field is in our incomplete list
      const isIncomplete = incompleteFields.some(inc => inc.api_id === f.api_id);
      if (isIncomplete) {
        navigateToField(f);
        return;
      }
    }
    
    // If no field after current, wrap to first incomplete
    navigateToField(incompleteFields[0]);
  };

  // Check if all required fields are complete (excluding Owner 2 fields)
  const radioGroupsComplete = Array.from(radioGroups).every(groupName => isRadioGroupComplete(groupName));
  
  const nonRadioFieldsComplete = requiredFields.every(f => {
    if (f.type === "signature") return !!signatureData;
    if (f.type === "checkbox") return true;
    return !!fieldValues[f.api_id];
  });
  
  const allRequiredComplete = radioGroupsComplete && nonRadioFieldsComplete;
  const canFinish = signatureData && agreedToTerms && allRequiredComplete;

  const getFieldsForPage = (pageNum: number) => [...signerFields, ...adminFields].filter(f => f.page === pageNum);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#4c4c4c] mx-auto mb-4" />
          <p className="text-[#666]">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#333] mb-2">Unable to Load Document</h1>
          <p className="text-[#666] mb-6">{error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#333] mb-2">Signing Complete!</h1>
          <p className="text-[#666] mb-6">
            Thank you, {data?.signerName}. Your signature has been recorded.
          </p>
          <div className="bg-[#f8f8f8] rounded p-4 text-left mb-4 border">
            <p className="text-xs text-[#888] mb-1">Document</p>
            <p className="font-medium text-[#333]">{data?.documentName}</p>
          </div>
          <p className="text-sm text-[#888]">
            A confirmation will be sent to {data?.signerEmail}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#e8e8e8] flex flex-col">
      {/* DocuSign-style Header */}
      <header className="bg-[#1a1a2e] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded bg-[#fae052] flex items-center justify-center flex-shrink-0">
            <span className="text-[#1a1a2e] font-bold text-sm">P</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-medium text-sm truncate">{data?.documentName}</h1>
            <p className="text-xs text-white/60">Please review and sign</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white/60">Signing as</p>
            <p className="text-sm font-medium truncate max-w-[140px]">{data?.signerName}</p>
          </div>
          <Button
            onClick={handleSubmitSignature}
            disabled={!canFinish || submitting}
            className={cn(
              "font-semibold px-6 transition-all duration-300",
              canFinish 
                ? "bg-[#4caf50] text-white hover:bg-[#43a047] animate-pulse shadow-lg shadow-green-500/30" 
                : "bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] disabled:opacity-40"
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : canFinish ? "✓ FINISH" : "FINISH"}
          </Button>
        </div>
      </header>

      {/* Progress Banner - DocuSign yellow style */}
      <div className="bg-[#fae052] px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#1a1a2e] text-sm">
            {totalCompleted} of {totalRequired} required fields complete
          </span>
          {remainingCount > 0 && (
            <span className="text-[#1a1a2e]/70 text-xs">
              ({remainingCount} remaining)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFieldList(!showFieldList)}
            size="sm"
            variant="ghost"
            className="text-[#1a1a2e] hover:bg-[#e8d044]"
          >
            {showFieldList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Floating NEXT/START Button - Positioned at the document edge */}
      <div className="fixed z-40" style={{ right: `calc(50% - ${(pageWidth * scale) / 2 + 60}px)`, top: '40%' }}>
        {remainingCount > 0 ? (
          <Button
            onClick={activeFieldId || showSignatureFor ? handleNext : handleStart}
            size="lg"
            className="bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] font-bold shadow-2xl rounded-full px-6 py-6 gap-2 animate-pulse text-sm flex-col h-auto"
          >
            <span className="text-lg">{activeFieldId || showSignatureFor ? "NEXT" : "START"}</span>
            <span className="text-xs font-normal opacity-80">{remainingCount} left</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        ) : canFinish ? (
          <Button
            onClick={handleSubmitSignature}
            disabled={submitting}
            size="lg"
            className="bg-[#4caf50] text-white hover:bg-[#43a047] font-bold shadow-2xl rounded-full px-6 py-6 gap-2 text-sm flex-col h-auto animate-pulse"
          >
            <Check className="h-6 w-6" />
            <span className="text-lg">FINISH</span>
            <span className="text-xs font-normal opacity-80">& Submit</span>
          </Button>
        ) : (
          <Button
            onClick={() => setAgreedToTerms(true)}
            size="lg"
            className="bg-[#fae052] text-[#1a1a2e] hover:bg-[#f5d93a] font-bold shadow-2xl rounded-full px-6 py-6 gap-2 animate-pulse text-sm flex-col h-auto"
          >
            <span className="text-lg">AGREE</span>
            <span className="text-xs font-normal opacity-80">to continue</span>
          </Button>
        )}
      </div>

      {/* Field List Dropdown */}
      {showFieldList && (
        <div className="bg-white border-b shadow-sm px-4 py-3 max-h-48 overflow-y-auto">
          <div className="grid gap-1">
            {signerFields.map((field) => {
              const isOwner2 = isOwner2Field(field);
              let isFieldComplete = false;
              
              if (field.type === "signature") {
                isFieldComplete = !!signatureData;
              } else if (field.type === "radio" && field.group_name) {
                isFieldComplete = isRadioGroupComplete(field.group_name);
              } else {
                isFieldComplete = completedFields.has(field.api_id);
              }
              
              // Show Owner 2 fields as optional/muted
              const isOptional = isOwner2 || (!field.required && field.type !== "radio");
              
              return (
                <button
                  key={field.api_id}
                  onClick={() => {
                    navigateToField(field);
                    setShowFieldList(false);
                  }}
                  className={cn(
                    "text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors",
                    isFieldComplete 
                      ? "bg-green-50 text-green-700" 
                      : isOptional
                        ? "bg-gray-50 text-gray-500 hover:bg-gray-100"
                        : "bg-[#fff8dc] text-[#8b7355] hover:bg-[#fff5cc]"
                  )}
                >
                  {isFieldComplete ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0",
                      isOptional ? "border-gray-300" : "border-[#fae052]"
                    )} />
                  )}
                  <span className="truncate">
                    {field.label}
                    {isOptional && <span className="text-xs ml-1">(optional)</span>}
                    {!isOptional && !isFieldComplete && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <span className="text-xs text-[#999] ml-auto flex-shrink-0">Page {field.page}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Document Area */}
      <main ref={containerRef} className="flex-1 overflow-auto py-4">
        <div className="mx-auto" style={{ maxWidth: pageWidth + 32 }}>
          {data?.pdfUrl ? (
            <Document
              file={data.pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-96 bg-white rounded shadow">
                  <Loader2 className="h-8 w-8 animate-spin text-[#666]" />
                </div>
              }
              error={
                <div className="bg-white rounded shadow p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                  <p className="text-[#666]">Could not load PDF</p>
                </div>
              }
            >
              <div className="space-y-2">
                {Array.from({ length: numPages }, (_, index) => {
                  const pageNum = index + 1;
                  const fieldsOnPage = getFieldsForPage(pageNum);
                  
                  return (
                    <div
                      key={pageNum}
                      ref={(el) => {
                        if (el) pageRefs.current.set(pageNum, el);
                      }}
                      className="relative bg-white shadow-lg mx-auto"
                      style={{ width: pageWidth * scale }}
                    >
                      <Page
                        pageNumber={pageNum}
                        width={pageWidth * scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        onLoadSuccess={(page) => onPageLoadSuccess(pageNum, page)}
                      />
                      
                      {/* Field Overlays */}
                      {fieldsOnPage.map((field) => {
                        const isActive = activeFieldId === field.api_id;
                        const isCompleted = completedFields.has(field.api_id) || (field.type === "signature" && !!signatureData);
                        const isReadOnly = field.filled_by === "admin";
                        const isShowingSignature = showSignatureFor === field.api_id;
                        const value = fieldValues[field.api_id];
                        
                        // Calculate compact heights based on field type
                        const getFieldStyle = () => {
                          if (field.type === "signature") {
                            return { height: "50px", minHeight: "50px" };
                          }
                          if (field.type === "checkbox" || field.type === "radio") {
                            return { height: "22px", width: "22px", minHeight: "22px" };
                          }
                          // Text, date, email, phone - compact to fit between lines
                          return { height: "24px", minHeight: "24px" };
                        };
                        
                        const fieldStyle = getFieldStyle();
                        
                        return (
                          <div
                            key={field.api_id}
                            className="absolute"
                            style={{
                              left: `${field.x}%`,
                              top: `${field.y}%`,
                              width: field.type === "checkbox" || field.type === "radio" ? fieldStyle.width : `${field.width}%`,
                              height: fieldStyle.height,
                              minHeight: fieldStyle.minHeight,
                              zIndex: isActive || isShowingSignature ? 100 : 10,
                            }}
                          >
                            {isShowingSignature ? (
                              <InlineSignature
                                onAdopt={handleSignatureAdopt}
                                onCancel={() => setShowSignatureFor(null)}
                              />
                            ) : (
                              <InlineField
                                field={field}
                                value={value}
                                onChange={(val) => handleFieldChange(field.api_id, val, field)}
                                isActive={isActive}
                                isCompleted={isCompleted}
                                isReadOnly={isReadOnly}
                                signatureData={isOwner2Field(field) ? owner2SignatureData : signatureData}
                                onFocus={() => {
                                  if (field.type === "signature" && !isReadOnly) {
                                    setShowSignatureFor(field.api_id);
                                  } else if (!isReadOnly) {
                                    setActiveFieldId(field.api_id);
                                  }
                                }}
                                onBlur={() => setActiveFieldId(null)}
                                onSignatureClick={() => !isReadOnly && setShowSignatureFor(field.api_id)}
                                scale={scale}
                              />
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Page indicator */}
                      <div className="absolute bottom-2 right-2 text-xs text-[#999] bg-white/80 px-2 py-0.5 rounded">
                        {pageNum} / {numPages}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Document>
          ) : (
            <div className="bg-white rounded shadow p-8 text-center">
              <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
              <p className="text-[#666]">No PDF available</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer - Terms */}
      <footer className="bg-white border-t px-4 py-3 flex items-center justify-between sticky bottom-0 z-50">
        <div className="flex items-center gap-2">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(c) => setAgreedToTerms(c === true)}
          />
          <label htmlFor="terms" className="text-xs text-[#666] cursor-pointer">
            I agree to use electronic records and signatures
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#999]">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="px-2 py-1 rounded hover:bg-[#f0f0f0]"
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(1.5, s + 0.1))}
            className="px-2 py-1 rounded hover:bg-[#f0f0f0]"
          >
            +
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SignDocument;
