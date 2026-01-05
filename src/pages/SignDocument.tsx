import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, X, Edit3, ZoomIn, ZoomOut } from "lucide-react";
import SignatureCanvas from "@/components/signing/SignatureCanvas";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldPosition {
  api_id: string;
  label: string;
  type: string;
  page: number;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage width
  height: number; // percentage height
}

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
  fields: any[];
  savedFieldValues: Record<string, string | boolean>;
}

// Default field positions for a typical contract (these would ideally come from the template)
const getDefaultFieldPositions = (fields: any[], signerType: string): FieldPosition[] => {
  const positions: FieldPosition[] = [];
  
  // Signature typically at bottom of last page
  const signatureField = fields.find(f => f.type === "signature");
  if (signatureField) {
    positions.push({
      api_id: signatureField.api_id || "signature",
      label: "Sign Here",
      type: "signature",
      page: 10, // Last page typically
      x: signerType === "owner" || signerType === "second_owner" ? 10 : 55,
      y: 75,
      width: 35,
      height: 8,
    });
  }

  // Date field next to signature
  const dateField = fields.find(f => f.api_id?.includes("date") || f.label?.toLowerCase().includes("date"));
  if (dateField) {
    positions.push({
      api_id: dateField.api_id,
      label: "Date",
      type: "date",
      page: 10,
      x: signerType === "owner" || signerType === "second_owner" ? 10 : 55,
      y: 85,
      width: 20,
      height: 4,
    });
  }

  // Name field
  const nameField = fields.find(f => f.api_id?.includes("name") || f.label?.toLowerCase().includes("name"));
  if (nameField && nameField.type !== "signature") {
    positions.push({
      api_id: nameField.api_id,
      label: nameField.label || "Full Name",
      type: "text",
      page: 1,
      x: 35,
      y: 28,
      width: 40,
      height: 4,
    });
  }

  // Email field
  const emailField = fields.find(f => f.type === "email" || f.api_id?.includes("email"));
  if (emailField) {
    positions.push({
      api_id: emailField.api_id,
      label: emailField.label || "Email",
      type: "email",
      page: 1,
      x: 35,
      y: 35,
      width: 40,
      height: 4,
    });
  }

  // Phone field
  const phoneField = fields.find(f => f.type === "phone" || f.api_id?.includes("phone"));
  if (phoneField) {
    positions.push({
      api_id: phoneField.api_id,
      label: phoneField.label || "Phone",
      type: "phone",
      page: 1,
      x: 35,
      y: 32,
      width: 40,
      height: 4,
    });
  }

  // Address field
  const addressField = fields.find(f => f.api_id?.includes("address") && !f.api_id?.includes("property"));
  if (addressField) {
    positions.push({
      api_id: addressField.api_id,
      label: addressField.label || "Address",
      type: "text",
      page: 1,
      x: 35,
      y: 29,
      width: 55,
      height: 4,
    });
  }

  return positions;
};

const SignDocument = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [fieldPositions, setFieldPositions] = useState<FieldPosition[]>([]);
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth - 48, 900);
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
        
        result.fields?.forEach((field: any) => {
          if (result.savedFieldValues?.[field.api_id] !== undefined) {
            initialValues[field.api_id] = result.savedFieldValues[field.api_id];
            completed.add(field.api_id);
          } else if (field.type === "checkbox") {
            initialValues[field.api_id] = false;
          } else {
            initialValues[field.api_id] = "";
          }
        });
        setFieldValues(initialValues);
        setCompletedFields(completed);
        
        // Set up field positions
        const positions = getDefaultFieldPositions(result.fields || [], result.signerType);
        setFieldPositions(positions);
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

  const handleFieldClick = (field: FieldPosition) => {
    if (field.type === "signature") {
      setShowSignatureModal(true);
    } else {
      setActiveFieldId(field.api_id);
    }
  };

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleFieldBlur = (fieldId: string) => {
    const value = fieldValues[fieldId];
    if (value || value === false) {
      setCompletedFields(prev => new Set([...prev, fieldId]));
    }
    setActiveFieldId(null);
  };

  const handleSignatureComplete = () => {
    if (signatureData) {
      const signatureFields = fieldPositions.filter(f => f.type === "signature");
      signatureFields.forEach(f => {
        setCompletedFields(prev => new Set([...prev, f.api_id]));
      });
    }
    setShowSignatureModal(false);
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
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 2));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  const fieldsOnCurrentPage = fieldPositions.filter(f => f.page === currentPage);
  const allFieldsComplete = fieldPositions.every(f => 
    completedFields.has(f.api_id) || (f.type === "signature" && signatureData)
  );
  const canFinish = signatureData && agreedToTerms;

  const completedCount = completedFields.size + (signatureData ? 1 : 0);
  const totalCount = fieldPositions.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
          <div>
            <h1 className="font-semibold text-sm">{data?.documentName}</h1>
            <p className="text-xs text-white/60">From: PeachHaus Group LLC</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white/60">Signing as</p>
            <p className="text-sm font-medium">{data?.signerName}</p>
          </div>
          <Button
            onClick={handleSubmitSignature}
            disabled={!canFinish || submitting}
            className="bg-[#fae052] text-black hover:bg-[#f5d93a] font-semibold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "FINISH"}
          </Button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#fae052] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white/70 text-xs">
              {completedCount}/{totalCount} completed
            </span>
          </div>
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
      </div>

      {/* Document Area */}
      <main ref={containerRef} className="flex-1 overflow-auto p-4 lg:p-6">
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
              <div className="relative bg-white shadow-2xl rounded-lg overflow-hidden">
                <Page
                  pageNumber={currentPage}
                  width={pageWidth * scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
                
                {/* Field Overlays on Document */}
                {fieldsOnCurrentPage.map((field) => {
                  const isActive = activeFieldId === field.api_id;
                  const isCompleted = completedFields.has(field.api_id) || (field.type === "signature" && signatureData);
                  const value = fieldValues[field.api_id];
                  
                  return (
                    <div
                      key={field.api_id}
                      className="absolute transition-all"
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        minHeight: `${field.height}%`,
                      }}
                    >
                      {field.type === "signature" ? (
                        // Signature field
                        <button
                          onClick={() => handleFieldClick(field)}
                          className={`w-full h-full min-h-[60px] border-2 border-dashed rounded flex items-center justify-center transition-all ${
                            signatureData
                              ? "border-green-500 bg-green-50"
                              : "border-[#fae052] bg-[#fae052]/10 hover:bg-[#fae052]/20 animate-pulse"
                          }`}
                        >
                          {signatureData ? (
                            <img src={signatureData} alt="Your signature" className="max-h-[50px] max-w-full" />
                          ) : (
                            <div className="flex items-center gap-2 text-[#b8860b] font-medium">
                              <Edit3 className="h-5 w-5" />
                              <span>Sign Here</span>
                            </div>
                          )}
                        </button>
                      ) : isActive ? (
                        // Active input field
                        <div className="relative">
                          <Input
                            type={field.type === "email" ? "email" : field.type === "date" ? "date" : "text"}
                            value={value as string || ""}
                            onChange={(e) => handleFieldChange(field.api_id, e.target.value)}
                            onBlur={() => handleFieldBlur(field.api_id)}
                            onKeyDown={(e) => e.key === "Enter" && handleFieldBlur(field.api_id)}
                            placeholder={field.label}
                            className="w-full bg-white border-2 border-[#fae052] shadow-lg text-sm"
                            autoFocus
                          />
                        </div>
                      ) : (
                        // Inactive field - clickable tag
                        <button
                          onClick={() => handleFieldClick(field)}
                          className={`w-full h-full min-h-[32px] border-2 border-dashed rounded px-2 py-1 text-left transition-all flex items-center ${
                            isCompleted
                              ? "border-green-500 bg-green-50 text-green-800"
                              : "border-[#fae052] bg-[#fae052]/10 hover:bg-[#fae052]/20 text-[#b8860b]"
                          }`}
                        >
                          {value ? (
                            <span className="text-sm truncate">{value as string}</span>
                          ) : (
                            <span className="text-sm font-medium flex items-center gap-1">
                              <Edit3 className="h-3 w-3" />
                              {field.label}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Document>
          ) : (
            <div className="bg-white rounded-lg shadow-2xl p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-xl font-medium text-gray-700 mb-2">Document Preview Unavailable</p>
              <p className="text-gray-500">The document could not be loaded for preview.</p>
            </div>
          )}
        </div>
      </main>

      {/* Page Navigation */}
      {numPages > 1 && (
        <div className="bg-[#2d2d2d] px-4 py-3 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-12 bg-white/10 border border-white/20 rounded text-white text-center text-sm py-1"
              min={1}
              max={numPages}
            />
            <span className="text-white/70 text-sm">of {numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          {/* Quick jump to pages with fields */}
          {fieldPositions.length > 0 && (
            <div className="ml-4 flex items-center gap-2">
              <span className="text-white/50 text-xs">Fields on:</span>
              {[...new Set(fieldPositions.map(f => f.page))].sort((a, b) => a - b).map(page => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`w-6 h-6 rounded text-xs font-medium transition-all ${
                    currentPage === page
                      ? "bg-[#fae052] text-black"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Action Bar */}
      <footer className="bg-[#1a1a1a] border-t border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              id="agree-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="border-white/30 data-[state=checked]:bg-[#fae052] data-[state=checked]:border-[#fae052]"
            />
            <label htmlFor="agree-terms" className="text-white/80 text-sm cursor-pointer">
              I agree to use electronic records and signatures
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => navigate("/")}
            >
              Decline
            </Button>
            <Button
              onClick={handleSubmitSignature}
              disabled={!canFinish || submitting}
              className="bg-[#fae052] text-black hover:bg-[#f5d93a] font-semibold px-6"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing...
                </>
              ) : (
                "FINISH"
              )}
            </Button>
          </div>
        </div>
      </footer>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#fae052] px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-black text-lg">Adopt Your Signature</h3>
              <button 
                onClick={() => setShowSignatureModal(false)}
                className="text-black/70 hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm mb-4">
                Draw your signature in the box below. Your signature will be applied to all signature fields in this document.
              </p>
              <SignatureCanvas onSignatureChange={setSignatureData} />
              <p className="text-xs text-gray-500 mt-4">
                By clicking Adopt and Sign, I agree that the signature will be the electronic representation of my signature for all purposes when I use them on documents.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowSignatureModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSignatureComplete}
                  disabled={!signatureData}
                  className="bg-[#fae052] text-black hover:bg-[#f5d93a] font-semibold"
                >
                  Adopt and Sign
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignDocument;
