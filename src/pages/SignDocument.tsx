import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, FileText, Shield } from "lucide-react";
import SignatureCanvas from "@/components/signing/SignatureCanvas";

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
      }
    } catch (err: any) {
      console.error("Error validating token:", err);
      setError(err.message || "Failed to validate signing link");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSignature = async () => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Document Viewer */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-white" />
                  <div>
                    <h2 className="font-semibold text-white">{data?.documentName}</h2>
                    <p className="text-sm text-amber-100">Please review before signing</p>
                  </div>
                </div>
              </div>
              
              {data?.pdfUrl ? (
                <div className="h-[600px]">
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
                    <p className="text-sm">Please contact us if you need a copy</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signing Panel */}
          <div className="lg:col-span-1 space-y-6">
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

            {/* Signature Pad */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Your Signature</h3>
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
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            🍑 PeachHaus Group • Property Management Made Simple
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Questions? Contact us at contracts@peachhausgroup.com
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SignDocument;
