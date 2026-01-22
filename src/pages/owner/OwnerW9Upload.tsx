import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  CheckCircle2,
  Loader2, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  Clock,
  DollarSign
} from "lucide-react";

const IRS_W9_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf";

interface OwnerData {
  id: string;
  name: string;
  email: string;
  payments_ytd: number;
}

export default function OwnerW9Upload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [taxName, setTaxName] = useState("");
  const [einLast4, setEinLast4] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("No upload token provided. Please use the link from your email.");
        setLoading(false);
        return;
      }

      try {
        // Validate token and get owner info
        const { data: tokenData, error: tokenError } = await supabase
          .from("owner_w9_tokens")
          .select("owner_id, expires_at, used_at")
          .eq("token", token)
          .single();

        if (tokenError || !tokenData) {
          setError("Invalid or expired upload link. Please request a new one from PeachHaus.");
          setLoading(false);
          return;
        }

        const tokenRecord = tokenData as { owner_id: string; expires_at: string; used_at: string | null };

        // Check if expired
        if (new Date(tokenRecord.expires_at) < new Date()) {
          setError("This upload link has expired. Please contact PeachHaus for a new link.");
          setLoading(false);
          return;
        }

        // Check if already used
        if (tokenRecord.used_at) {
          setUploaded(true);
          setLoading(false);
          return;
        }

        // Get owner info
        const { data: ownerData, error: ownerError } = await supabase
          .from("property_owners")
          .select("id, name, email, payments_ytd")
          .eq("id", tokenRecord.owner_id)
          .single();

        if (ownerError || !ownerData) {
          setError("Owner not found. Please contact PeachHaus.");
          setLoading(false);
          return;
        }

        setOwner(ownerData);
        setLoading(false);
      } catch (err) {
        console.error("Token validation error:", err);
        setError("An error occurred. Please try again later.");
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        toast.error("Please upload a PDF file");
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        toast.error("Please upload a PDF file");
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !token) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fileBase64 = await base64Promise;

      const { data, error } = await supabase.functions.invoke("process-owner-w9-upload", {
        body: {
          token,
          fileName: file.name,
          fileBase64,
          taxName: taxName || undefined,
          einLast4: einLast4 || undefined,
        },
      });

      if (error) throw error;

      setUploaded(true);
      toast.success("W-9 uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload W-9");
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <div className="text-center">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-12 mx-auto mb-6"
          />
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your upload link...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img 
              src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-10 mx-auto mb-4"
            />
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Upload Link Issue</CardTitle>
            <CardDescription className="text-base">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Need help? Contact us at <a href="mailto:info@peachhausgroup.com" className="text-primary hover:underline">info@peachhausgroup.com</a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (uploaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img 
              src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-10 mx-auto mb-4"
            />
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">W-9 Uploaded Successfully!</CardTitle>
            <CardDescription className="text-base">
              Thank you{owner ? `, ${owner.name.split(" ")[0]}` : ""}! Your W-9 has been securely received. 
              You'll receive a confirmation email shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                🔒 Your document is encrypted and stored securely. 
                We'll use this information to prepare your 1099 for tax purposes.
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              If you have any questions, contact us at{" "}
              <a href="mailto:ingo@peachhausgroup.com" className="text-primary hover:underline">
                ingo@peachhausgroup.com
              </a>
            </p>
            <Button variant="outline" onClick={() => window.close()}>
              Close This Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">Upload Your W-9</h1>
          <p className="text-muted-foreground mt-2">
            Securely submit your W-9 form for tax reporting
          </p>
        </div>

        {/* Owner Info Card */}
        {owner && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Uploading for</p>
                  <p className="font-semibold text-lg">{owner.name}</p>
                  <p className="text-sm text-muted-foreground">{owner.email}</p>
                </div>
                {owner.payments_ytd > 0 && (
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>YTD Payments</span>
                    </div>
                    <p className="font-bold text-xl text-primary">{formatCurrency(owner.payments_ytd)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Steps */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-medium text-primary">1</span>
                </div>
                <span className="text-muted-foreground">Download</span>
              </div>
              <div className="flex-1 h-0.5 bg-border mx-2" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-medium text-primary">2</span>
                </div>
                <span className="text-muted-foreground">Fill Out</span>
              </div>
              <div className="flex-1 h-0.5 bg-border mx-2" />
              <div className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${file ? "bg-green-500 text-white" : "bg-primary text-primary-foreground"}`}>
                  {file ? <CheckCircle className="w-4 h-4" /> : <span className="font-medium">3</span>}
                </div>
                <span className={file ? "text-green-600 font-medium" : "text-foreground font-medium"}>Upload</span>
              </div>
              <div className="flex-1 h-0.5 bg-border mx-2" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="font-medium text-muted-foreground">4</span>
                </div>
                <span className="text-muted-foreground">Done</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Need to Complete Your W-9?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you haven't filled out your W-9 yet, download the official IRS form below. 
              Fill it out, save it as a PDF, then upload it here.
            </p>
            <Button variant="outline" asChild className="gap-2">
              <a href={IRS_W9_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                Download IRS W-9 Form
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Completed W-9</CardTitle>
            <CardDescription>
              Upload your signed W-9 form as a PDF file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                ${file ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}
              `}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-2">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <p className="font-medium text-green-600">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    Choose Different File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                  <p className="font-medium">Drag & drop your W-9 here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (PDF only)
                  </p>
                </div>
              )}
            </div>

            {/* Optional Fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tax-name">Name on W-9 (optional)</Label>
                <Input
                  id="tax-name"
                  placeholder="e.g., John Smith or ABC Properties LLC"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your legal name or business name as it appears on the W-9
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ein-last4">Last 4 of SSN/EIN (optional)</Label>
                <Input
                  id="ein-last4"
                  placeholder="e.g., 1234"
                  maxLength={4}
                  value={einLast4}
                  onChange={(e) => setEinLast4(e.target.value.replace(/\D/g, ""))}
                />
                <p className="text-xs text-muted-foreground">
                  For verification purposes only
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Submit W-9
                </>
              )}
            </Button>

            {/* Security Note */}
            <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
              <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Secure Upload</p>
                <p>Your document is encrypted and stored securely. 
                We only use this information for tax reporting purposes in accordance with IRS requirements.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA</p>
          <p className="mt-1">Questions? Email <a href="mailto:info@peachhausgroup.com" className="text-primary hover:underline">info@peachhausgroup.com</a></p>
        </div>
      </div>
    </div>
  );
}
