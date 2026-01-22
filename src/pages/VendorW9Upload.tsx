import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ShieldCheck,
  Clock
} from "lucide-react";

interface VendorData {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
}

export default function VendorW9Upload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("No upload token provided. Please use the link from your email.");
        setLoading(false);
        return;
      }

      try {
        // Validate token and get vendor info
        const { data: tokenData, error: tokenError } = await supabase
          .from("vendor_w9_tokens")
          .select("vendor_id, expires_at, used_at")
          .eq("token", token)
          .single();

        if (tokenError || !tokenData) {
          setError("Invalid or expired upload link. Please request a new one.");
          setLoading(false);
          return;
        }

        // Check if expired
        if (new Date(tokenData.expires_at) < new Date()) {
          setError("This upload link has expired. Please contact PeachHaus for a new link.");
          setLoading(false);
          return;
        }

        // Check if already used
        if (tokenData.used_at) {
          setSuccess(true);
          setLoading(false);
          return;
        }

        // Get vendor info
        const { data: vendorData, error: vendorError } = await supabase
          .from("vendors")
          .select("id, name, company_name, email")
          .eq("id", tokenData.vendor_id)
          .single();

        if (vendorError || !vendorData) {
          setError("Vendor not found. Please contact PeachHaus.");
          setLoading(false);
          return;
        }

        setVendor(vendorData);
        setLoading(false);
      } catch (err) {
        console.error("Token validation error:", err);
        setError("An error occurred. Please try again later.");
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a PDF or image file (JPG, PNG)");
        return;
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !vendor || !token) return;

    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `vendor-w9/${vendor.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("onboarding-documents")
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Update vendor record
      const { error: updateError } = await supabase
        .from("vendors")
        .update({
          w9_on_file: true,
          w9_received_at: new Date().toISOString(),
          w9_file_path: fileName,
        })
        .eq("id", vendor.id);

      if (updateError) {
        throw updateError;
      }

      // Mark token as used
      await supabase
        .from("vendor_w9_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      setSuccess(true);
      toast.success("W-9 uploaded successfully!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload W-9. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Unable to Process</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              If you need assistance, please contact us at{" "}
              <a href="mailto:ingo@peachhausgroup.com" className="text-primary hover:underline">
                ingo@peachhausgroup.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-700">W-9 Received!</CardTitle>
            <CardDescription>
              Thank you for submitting your W-9. We have received it and will process it for your 1099.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Your document has been securely stored. You can close this page.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              If you have any questions, contact us at{" "}
              <a href="mailto:ingo@peachhausgroup.com" className="text-primary hover:underline">
                ingo@peachhausgroup.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center border-b">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-10 mx-auto mb-4"
          />
          <CardTitle>Upload Your W-9</CardTitle>
          <CardDescription>
            Securely submit your W-9 form for tax reporting
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Vendor Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{vendor?.company_name || vendor?.name}</p>
                <p className="text-sm text-muted-foreground">{vendor?.email}</p>
              </div>
            </div>
          </div>

          {/* Why We Need This */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              We need your W-9 to issue your 1099-NEC for payments received. Please submit by <strong>December 15th</strong>.
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="space-y-4">
            <Label htmlFor="w9-file">Upload Completed W-9</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                id="w9-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="w9-file" className="cursor-pointer">
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-primary" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Badge variant="secondary">Click to change file</Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="font-medium">Click to upload your W-9</p>
                    <p className="text-sm text-muted-foreground">
                      PDF, JPG, or PNG (max 10MB)
                    </p>
                  </div>
                )}
              </label>
            </div>

            <Button 
              onClick={handleUpload} 
              disabled={!selectedFile || uploading}
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
          </div>

          {/* Download IRS Form Link */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Need a blank W-9 form?
            </p>
            <a 
              href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Download from IRS.gov →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
