import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, FileText, Shield, ChevronDown, ChevronUp } from "lucide-react";
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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
        // Initialize field values with saved values or empty
        const initialValues: Record<string, string | boolean> = {};
        result.fields?.forEach((field: FieldMapping) => {
          if (result.savedFieldValues?.[field.api_id] !== undefined) {
            initialValues[field.api_id] = result.savedFieldValues[field.api_id];
          } else if (field.type === "checkbox") {
            initialValues[field.api_id] = false;
          } else {
            initialValues[field.api_id] = "";
          }
        });
        setFieldValues(initialValues);
        
        // Expand all sections by default
        const categories = [...new Set((result.fields || []).map((f: FieldMapping) => f.category))] as string[];
        const expanded: Record<string, boolean> = {};
        categories.forEach((cat: string) => expanded[cat] = true);
        setExpandedSections(expanded);
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

  const toggleSection = (category: string) => {
    setExpandedSections(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const validateRequiredFields = () => {
    const missingFields: string[] = [];
    
    data?.fields?.forEach(field => {
      // Skip signature fields - handled separately
      if (field.type === "signature") return;
      
      const value = fieldValues[field.api_id];
      if (!value && value !== false) {
        missingFields.push(field.label);
      }
    });

    return missingFields;
  };

  const handleSubmitSignature = async () => {
    // Validate required fields
    const missingFields = validateRequiredFields();
    if (missingFields.length > 0) {
      toast.error(`Please complete: ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? ` and ${missingFields.length - 3} more` : ""}`);
      return;
    }

    if (!signatureData) {
      toast.error("Please draw your signature");
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

  // Group fields by category
  const groupedFields = data?.fields?.reduce((acc, field) => {
    const category = field.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {} as Record<string, FieldMapping[]>) || {};

  const categoryLabels: Record<string, string> = {
    contact: "Contact Information",
    property: "Property Details",
    dates: "Important Dates",
    financial: "Financial Terms",
    occupancy: "Occupancy Details",
    signature: "Signature",
    identification: "Identification",
    other: "Additional Information",
  };

  const categoryOrder = ["contact", "property", "identification", "dates", "financial", "occupancy", "other", "signature"];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Signature Complete!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for signing. You'll receive a confirmation email shortly.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
            <p className="text-sm text-gray-500 mb-1">Document</p>
            <p className="font-medium text-gray-900">{data?.documentName}</p>
          </div>
          <p className="text-sm text-gray-500">
            You can safely close this window.
          </p>
        </div>
      </div>
    );
  }

  const renderField = (field: FieldMapping) => {
    // Skip signature type fields - we have a dedicated signature section
    if (field.type === "signature") return null;

    const value = fieldValues[field.api_id];

    if (field.type === "checkbox") {
      return (
        <div key={field.api_id} className="flex items-center gap-3 py-2">
          <Checkbox
            id={field.api_id}
            checked={value as boolean || false}
            onCheckedChange={(checked) => handleFieldChange(field.api_id, !!checked)}
          />
          <Label htmlFor={field.api_id} className="text-sm cursor-pointer">
            {field.label}
          </Label>
        </div>
      );
    }

    return (
      <div key={field.api_id} className="space-y-1.5">
        <Label htmlFor={field.api_id} className="text-sm font-medium text-gray-700">
          {field.label} <span className="text-red-500">*</span>
        </Label>
        <Input
          id={field.api_id}
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          value={value as string || ""}
          onChange={(e) => handleFieldChange(field.api_id, e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="bg-white border-gray-200 focus:border-amber-400 focus:ring-amber-400"
        />
      </div>
    );
  };

  const hasFormFields = Object.keys(groupedFields).some(cat => 
    cat !== "signature" && groupedFields[cat].length > 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍑</span>
            <div>
              <h1 className="font-bold text-gray-900">PeachHaus Group</h1>
              <p className="text-xs text-gray-500">Document Signing</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            <span>Secured</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Document Viewer - Takes more space */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-24">
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-white" />
                  <div>
                    <h2 className="font-semibold text-white">{data?.documentName}</h2>
                    <p className="text-sm text-amber-100">Please review and complete all fields</p>
                  </div>
                </div>
              </div>
              
              {data?.pdfUrl ? (
                <div className="h-[700px]">
                  <iframe
                    src={data.pdfUrl}
                    className="w-full h-full"
                    title="Document Preview"
                  />
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Document preview not available</p>
                    <p className="text-sm">Please review the fields on the right</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signing Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Signer Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Signing as</h3>
              <div className="space-y-2">
                <p className="font-medium text-gray-900">{data?.signerName}</p>
                <p className="text-sm text-gray-500">{data?.signerEmail}</p>
                <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full capitalize">
                  {data?.signerType?.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Signing Progress */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Signing Progress</h3>
              <div className="space-y-3">
                {data?.signers.map((signer, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      signer.signed 
                        ? "bg-emerald-100 text-emerald-600" 
                        : signer.email === data.signerEmail 
                          ? "bg-amber-100 text-amber-600" 
                          : "bg-gray-100 text-gray-400"
                    }`}>
                      {signer.signed ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <span className="text-xs font-medium">{signer.order}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        signer.signed ? "text-emerald-600" : "text-gray-900"
                      }`}>
                        {signer.name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {signer.type.replace("_", " ")}
                        {signer.signed && " • Signed"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Fields by Category */}
            {hasFormFields && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Complete Your Information</h3>
                  <p className="text-xs text-gray-500 mt-1">All fields marked with * are required</p>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {categoryOrder.map(category => {
                    const fields = groupedFields[category];
                    if (!fields || fields.length === 0 || category === "signature") return null;
                    
                    const isExpanded = expandedSections[category] ?? true;
                    const nonSignatureFields = fields.filter(f => f.type !== "signature");
                    if (nonSignatureFields.length === 0) return null;

                    return (
                      <div key={category}>
                        <button
                          onClick={() => toggleSection(category)}
                          className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium text-sm text-gray-700">
                            {categoryLabels[category] || category}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="px-6 pb-4 space-y-4">
                            {nonSignatureFields.map(field => renderField(field))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Signature Pad */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Your Signature</h3>
              <p className="text-xs text-gray-500 mb-4">Draw your signature in the box below</p>
              <SignatureCanvas
                onSignatureChange={setSignatureData}
              />
            </div>

            {/* Agreement & Submit */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agree"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <label htmlFor="agree" className="text-sm text-gray-600 leading-tight cursor-pointer">
                  I agree to sign this document electronically. I understand this signature is legally binding.
                </label>
              </div>

              <Button
                onClick={handleSubmitSignature}
                disabled={!signatureData || !agreedToTerms || submitting}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold py-6"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    ✍️ Sign & Complete
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-gray-500">
                🔒 Protected by ESIGN Act compliance
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            🍑 PeachHaus Group • Property Management Made Simple
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Questions? Contact us at info@peachhausgroup.com
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SignDocument;
