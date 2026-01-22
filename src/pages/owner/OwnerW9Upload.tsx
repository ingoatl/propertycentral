import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, ExternalLink } from "lucide-react";

const IRS_W9_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf";

export default function OwnerW9Upload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [file, setFile] = useState<File | null>(null);
  const [taxName, setTaxName] = useState("");
  const [einLast4, setEinLast4] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [dragActive, setDragActive] = useState(false);

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
          // Remove data URL prefix
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

      setOwnerName(data.ownerName || "");
      setUploaded(true);
      toast.success("W-9 uploaded successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload W-9");
    } finally {
      setUploading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Upload Link</CardTitle>
            <CardDescription>
              This upload link is invalid or has expired. Please request a new W-9 email from PeachHaus.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (uploaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">W-9 Uploaded Successfully!</CardTitle>
            <CardDescription className="text-base">
              Thank you{ownerName ? `, ${ownerName.split(" ")[0]}` : ""}! Your W-9 has been securely received. 
              You'll receive a confirmation email shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              We'll use this information to prepare your 1099 for tax purposes. 
              If you have any questions, contact us at ingo@peachhausgroup.com.
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
            <p className="text-xs text-muted-foreground text-center">
              🔒 Your document is encrypted and stored securely. 
              We only use this information for tax reporting purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
