import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { InlineField, FieldData } from "@/components/signing/InlineField";
import { InlineSignature } from "@/components/signing/InlineSignature";
import { SigningProgress } from "@/components/signing/SigningProgress";
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
  const pageRef = useRef<HTMLDivElement>(null);
  
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
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(800);
  
  // Field interaction states
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [showSignatureFor, setShowSignatureFor] = useState<string | null>(null);
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());

  // Filter fields for current signer
  const signerFields = data?.fields || [];

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

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    
    // Mark as completed if has value
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

  const handleSignatureAdopt = (sigData: string) => {
    setSignatureData(sigData);
    setShowSignatureFor(null);
    
    // Mark all signature fields as complete
    signerFields
      .filter(f => f.type === "signature")
      .forEach(f => {
        setCompletedFields(prev => new Set([...prev, f.api_id]));
      });
    
    toast.success("Signature adopted!");
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

    // Check required fields
    const requiredFields = signerFields.filter(f => f.required && f.filled_by === "guest");
    const missingFields = requiredFields.filter(f => {
      if (f.type === "signature") return !signatureData;
      if (f.type === "checkbox") return false; // Checkboxes can be false
      return !fieldValues[f.api_id];
    });

    if (missingFields.length > 0) {
      toast.error(`Please complete all required fields: ${missingFields.map(f => f.label).join(", ")}`);
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

  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      setActiveFieldId(null);
      setShowSignatureFor(null);
    }
  };

  const navigateToField = (field: FieldData) => {
    setCurrentPage(field.page);
    setActiveFieldId(null);
    setShowSignatureFor(null);
    
    // Small delay to ensure page renders before focusing
    setTimeout(() => {
      if (field.type === "signature") {
        setShowSignatureFor(field.api_id);
      } else {
        setActiveFieldId(field.api_id);
      }
    }, 100);
  };

  const handleStart = () => {
    const firstIncomplete = signerFields.find(f => {
      if (f.type === "signature") return !signatureData;
      return !completedFields.has(f.api_id);
    });
    if (firstIncomplete) {
      navigateToField(firstIncomplete);
    }
  };

  const handleNext = () => {
    const currentFieldIndex = signerFields.findIndex(f => f.api_id === activeFieldId || f.api_id === showSignatureFor);
    
    // Find next incomplete field
    for (let i = currentFieldIndex + 1; i < signerFields.length; i++) {
      const field = signerFields[i];
      if (field.type === "signature" ? !signatureData : !completedFields.has(field.api_id)) {
        navigateToField(field);
        return;
      }
    }
    
    // Wrap around to find incomplete from start
    for (let i = 0; i <= currentFieldIndex; i++) {
      const field = signerFields[i];
      if (field.type === "signature" ? !signatureData : !completedFields.has(field.api_id)) {
        navigateToField(field);
        return;
      }
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 2));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  const fieldsOnCurrentPage = signerFields.filter(f => f.page === currentPage);
  const canFinish = signatureData && agreedToTerms && signerFields.filter(f => f.required && f.filled_by === "guest").every(f => {
    if (f.type === "signature") return !!signatureData;
    if (f.type === "checkbox") return true;
    return !!fieldValues[f.api_id];
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#404040] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#fae052] mx-auto mb-4" />
          <p className="text-white/70">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#404040] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Document</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-[#404040] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Signed!</h1>
          <p className="text-gray-600 mb-6">
            Thank you, {data?.signerName}. Your signature has been recorded.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
            <p className="text-sm text-gray-500 mb-1">Document</p>
            <p className="font-medium text-gray-900">{data?.documentName}</p>
          </div>
          <p className="text-sm text-gray-500">
            A confirmation email has been sent to {data?.signerEmail}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#404040] flex flex-col">
      {/* Header */}
      <header className="bg-[#1a1a1a] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl">🍑</span>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate">{data?.documentName}</h1>
            <p className="text-xs text-white/60">From: PeachHaus Group LLC</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white/60">Signing as</p>
            <p className="text-sm font-medium truncate max-w-32">{data?.signerName}</p>
          </div>
          <Button
            onClick={handleSubmitSignature}
            disabled={!canFinish || submitting}
            className="bg-[#fae052] text-black hover:bg-[#f5d93a] font-semibold disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "FINISH"}
          </Button>
        </div>
      </header>

      {/* Progress Bar */}
      <SigningProgress
        fields={signerFields}
        completedFields={completedFields}
        signatureData={signatureData}
        currentPage={currentPage}
        onNavigateToField={navigateToField}
        onStart={handleStart}
        onNext={handleNext}
      />

      {/* Document Area */}
      <main ref={containerRef} className="flex-1 overflow-auto p-2 sm:p-4">
        <div className="max-w-4xl mx-auto">
          {data?.pdfUrl ? (
            <Document
              file={data.pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin text-[#fae052]" />
                </div>
              }
              error={
                <div className="bg-white rounded-lg p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-600">Could not load PDF. Please try refreshing.</p>
                </div>
              }
            >
              <div ref={pageRef} className="relative bg-white shadow-2xl rounded-lg overflow-hidden">
                <Page
                  pageNumber={currentPage}
                  width={pageWidth * scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                
                {/* Field Overlays */}
                {fieldsOnCurrentPage.map((field) => {
                  const isActive = activeFieldId === field.api_id;
                  const isCompleted = completedFields.has(field.api_id) || (field.type === "signature" && !!signatureData);
                  const isReadOnly = field.filled_by === "admin";
                  const isShowingSignature = showSignatureFor === field.api_id;
                  const value = fieldValues[field.api_id];
                  
                  return (
                    <div
                      key={field.api_id}
                      className="absolute"
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        minHeight: field.type === "signature" ? "60px" : `${field.height}%`,
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
                          onChange={(val) => handleFieldChange(field.api_id, val)}
                          isActive={isActive}
                          isCompleted={isCompleted}
                          isReadOnly={isReadOnly}
                          signatureData={signatureData}
                          onFocus={() => {
                            if (field.type === "signature") {
                              setShowSignatureFor(field.api_id);
                            } else {
                              setActiveFieldId(field.api_id);
                            }
                          }}
                          onBlur={() => setActiveFieldId(null)}
                          onSignatureClick={() => setShowSignatureFor(field.api_id)}
                          scale={scale}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Document>
          ) : (
            <div className="bg-white rounded-lg p-8 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600">No PDF available for this document.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer - Page Navigation & Zoom */}
      <footer className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-white/70 text-sm min-w-[80px] text-center">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={zoomOut} className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white/70 text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={zoomIn} className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </footer>

      {/* Terms Agreement */}
      <div className="bg-[#1a1a1a] px-4 py-3 flex items-center justify-center gap-3 border-t border-white/10">
        <Checkbox
          id="terms"
          checked={agreedToTerms}
          onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
          className="border-white/40 data-[state=checked]:bg-[#fae052] data-[state=checked]:border-[#fae052]"
        />
        <label htmlFor="terms" className="text-sm text-white/70 cursor-pointer">
          I agree to use electronic records and signatures
        </label>
      </div>
    </div>
  );
};

export default SignDocument;
