import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, X, Edit3 } from "lucide-react";
import SignatureCanvas from "@/components/signing/SignatureCanvas";

interface FieldMapping {
  api_id: string;
  label: string;
  type: string;
  category: string;
  filled_by: string;
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
  fields: FieldMapping[];
  savedFieldValues: Record<string, string | boolean>;
}

const SignDocument = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SigningData | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  
  // DocuSign-style states
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [activeField, setActiveField] = useState<FieldMapping | null>(null);
  const [completedFields, setCompletedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

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
        const initialValues: Record<string, string | boolean> = {};
        const completed = new Set<string>();
        
        result.fields?.forEach((field: FieldMapping) => {
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
      }
    } catch (err: any) {
      console.error("Error validating token:", err);
      setError(err.message || "Failed to validate signing link");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleFieldComplete = (fieldId: string) => {
    const value = fieldValues[fieldId];
    if (value || value === false) {
      setCompletedFields(prev => new Set([...prev, fieldId]));
    }
    setShowFieldModal(false);
    setActiveField(null);
    
    // Auto-advance to next field
    const fields = data?.fields || [];
    const currentIdx = fields.findIndex(f => f.api_id === fieldId);
    if (currentIdx < fields.length - 1) {
      setCurrentFieldIndex(currentIdx + 1);
    }
  };

  const handleSignatureComplete = () => {
    if (signatureData) {
      const signatureFields = data?.fields?.filter(f => f.type === "signature") || [];
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

  const allFields = data?.fields || [];
  const requiredFieldsCount = allFields.length;
  const completedFieldsCount = completedFields.size + (signatureData ? 1 : 0);
  const progress = requiredFieldsCount > 0 ? Math.round((completedFieldsCount / (requiredFieldsCount + 1)) * 100) : 0;

  const openFieldForEdit = (field: FieldMapping) => {
    if (field.type === "signature") {
      setShowSignatureModal(true);
    } else {
      setActiveField(field);
      setShowFieldModal(true);
    }
  };

  const goToNextField = () => {
    if (currentFieldIndex < allFields.length - 1) {
      setCurrentFieldIndex(currentFieldIndex + 1);
    }
  };

  const goToPrevField = () => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(currentFieldIndex - 1);
    }
  };

  const canFinish = signatureData && agreedToTerms;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#ffc107] mx-auto mb-4" />
          <p className="text-white/70">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
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
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
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
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      {/* Top Header Bar - DocuSign style */}
      <header className="bg-[#ffc107] text-black px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🍑</span>
            <div>
              <h1 className="font-bold text-lg leading-tight">{data?.documentName}</h1>
              <p className="text-sm opacity-80">Sent by PeachHaus Group LLC</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {data?.signerName}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-[#2a2a4e] px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm">
              {completedFieldsCount} of {requiredFieldsCount + 1} fields completed
            </span>
            <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#ffc107] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevField}
              disabled={currentFieldIndex === 0}
              className="text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <span className="text-white/70 text-sm px-2">
              Field {currentFieldIndex + 1} of {allFields.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextField}
              disabled={currentFieldIndex >= allFields.length - 1}
              className="text-white hover:bg-white/10"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Document with Overlays */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Field Tags */}
        <aside className="w-64 bg-[#2a2a4e] border-r border-white/10 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Required Fields</h3>
            <div className="space-y-2">
              {allFields.map((field, idx) => {
                const isCompleted = completedFields.has(field.api_id) || (field.type === "signature" && signatureData);
                const isActive = idx === currentFieldIndex;
                
                return (
                  <button
                    key={field.api_id}
                    onClick={() => {
                      setCurrentFieldIndex(idx);
                      openFieldForEdit(field);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                      isActive 
                        ? "bg-[#ffc107] text-black" 
                        : isCompleted 
                          ? "bg-emerald-500/20 text-emerald-400" 
                          : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted ? "bg-emerald-500 text-white" : isActive ? "bg-black text-[#ffc107]" : "bg-white/20"
                    }`}>
                      {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{field.label}</p>
                      <p className="text-xs opacity-70 capitalize">{field.type}</p>
                    </div>
                  </button>
                );
              })}
              
              {/* Signature as final step */}
              <button
                onClick={() => setShowSignatureModal(true)}
                className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-3 ${
                  signatureData 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : "bg-[#ffc107]/20 text-[#ffc107] hover:bg-[#ffc107]/30"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  signatureData ? "bg-emerald-500 text-white" : "bg-[#ffc107] text-black"
                }`}>
                  {signatureData ? <CheckCircle className="h-4 w-4" /> : <Edit3 className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Sign Here</p>
                  <p className="text-xs opacity-70">Your signature</p>
                </div>
              </button>
            </div>
          </div>
        </aside>

        {/* Document Preview */}
        <div className="flex-1 bg-[#3a3a5e] overflow-auto p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Document Container */}
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden relative">
              {data?.pdfUrl ? (
                <iframe
                  src={data.pdfUrl}
                  className="w-full h-[calc(100vh-220px)] min-h-[600px]"
                  title="Document Preview"
                />
              ) : (
                <div className="h-[600px] flex items-center justify-center text-gray-400">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-xl font-medium mb-2">Document Preview</p>
                    <p className="text-sm">Complete the required fields on the left to finish signing</p>
                  </div>
                </div>
              )}
              
              {/* Floating Action Tags on Document */}
              <div className="absolute bottom-8 right-8 flex flex-col gap-2">
                {allFields.filter(f => f.type === "signature").map((field) => (
                  <button
                    key={field.api_id}
                    onClick={() => setShowSignatureModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium transition-all ${
                      signatureData 
                        ? "bg-emerald-500 text-white" 
                        : "bg-[#ffc107] text-black hover:bg-[#ffcd38] animate-pulse"
                    }`}
                  >
                    {signatureData ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Signed
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-4 w-4" />
                        Sign Here
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="bg-[#2a2a4e] border-t border-white/10 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Checkbox
              id="agree-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="border-white/30 data-[state=checked]:bg-[#ffc107] data-[state=checked]:border-[#ffc107]"
            />
            <label htmlFor="agree-terms" className="text-white/80 text-sm cursor-pointer">
              I agree to use electronic records and signatures
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => navigate("/")}
            >
              Decline
            </Button>
            <Button
              onClick={handleSubmitSignature}
              disabled={!canFinish || submitting}
              className="bg-[#ffc107] text-black hover:bg-[#ffcd38] font-semibold px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Finish"
              )}
            </Button>
          </div>
        </div>
      </footer>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#ffc107] px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-black text-lg">Add Your Signature</h3>
              <button 
                onClick={() => setShowSignatureModal(false)}
                className="text-black/70 hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-sm mb-4">
                Draw your signature below. This will be applied to the document.
              </p>
              <SignatureCanvas onSignatureChange={setSignatureData} />
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
                  className="bg-[#ffc107] text-black hover:bg-[#ffcd38]"
                >
                  Apply Signature
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Field Input Modal */}
      {showFieldModal && activeField && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#ffc107] px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-black text-lg">{activeField.label}</h3>
              <button 
                onClick={() => {
                  setShowFieldModal(false);
                  setActiveField(null);
                }}
                className="text-black/70 hover:text-black"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {activeField.type === "checkbox" ? (
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={activeField.api_id}
                    checked={fieldValues[activeField.api_id] as boolean || false}
                    onCheckedChange={(checked) => handleFieldChange(activeField.api_id, !!checked)}
                    className="h-6 w-6"
                  />
                  <label htmlFor={activeField.api_id} className="text-gray-700 cursor-pointer">
                    {activeField.label}
                  </label>
                </div>
              ) : (
                <Input
                  type={
                    activeField.type === "email" ? "email" : 
                    activeField.type === "phone" ? "tel" : 
                    activeField.type === "date" ? "date" : 
                    activeField.type === "number" ? "number" : "text"
                  }
                  value={fieldValues[activeField.api_id] as string || ""}
                  onChange={(e) => handleFieldChange(activeField.api_id, e.target.value)}
                  placeholder={`Enter ${activeField.label.toLowerCase()}`}
                  className="text-lg py-6"
                  autoFocus
                />
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFieldModal(false);
                    setActiveField(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleFieldComplete(activeField.api_id)}
                  className="bg-[#ffc107] text-black hover:bg-[#ffcd38]"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Field Navigation */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4">
        <div className="bg-[#2a2a4e] rounded-lg p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const currentField = allFields[currentFieldIndex];
                if (currentField) openFieldForEdit(currentField);
              }}
              className="flex-1 bg-[#ffc107] text-black font-medium py-3 px-4 rounded-lg text-center"
            >
              {allFields[currentFieldIndex]?.type === "signature" 
                ? "Sign Here" 
                : `Fill: ${allFields[currentFieldIndex]?.label || "Complete Field"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignDocument;
