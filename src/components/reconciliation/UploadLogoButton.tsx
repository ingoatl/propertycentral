import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadLogoToSupabase } from "@/lib/uploadLogoToSupabase";
import { useState } from "react";

export const UploadLogoButton = () => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    setIsUploading(true);
    const toastId = toast.loading("Uploading logo to Supabase storage...");
    
    try {
      const result = await uploadLogoToSupabase();
      
      if (result.success) {
        toast.success("Logo uploaded successfully! Emails will now show the logo.", { id: toastId });
      } else {
        toast.error(`Failed to upload logo: ${result.error}`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Button
      onClick={handleUpload}
      disabled={isUploading}
      variant="outline"
      size="sm"
    >
      <Upload className="w-4 h-4 mr-2" />
      {isUploading ? "Uploading..." : "Upload Logo to Storage"}
    </Button>
  );
};
