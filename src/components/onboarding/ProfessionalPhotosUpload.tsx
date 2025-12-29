import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfessionalPhotosUploadProps {
  taskId: string;
  onFilesUploaded?: () => void;
}

const PHOTO_REQUIREMENTS = [
  "Exterior Arrival Shot",
  "Main Living Area (Hero Room)",
  "Signature / Selling Feature",
  "Primary Bedroom (Master)",
  "Kitchen (Wide Angle)"
];

export const ProfessionalPhotosUpload = ({ taskId, onFilesUploaded }: ProfessionalPhotosUploadProps) => {
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: number]: string }>({});
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const handleFileSelect = async (photoIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50MB limit");
      return;
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(photoIndex);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const photoName = PHOTO_REQUIREMENTS[photoIndex].toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
      const fileName = `${user.id}/${taskId}/${photoName}_${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: `${photoIndex + 1}. ${PHOTO_REQUIREMENTS[photoIndex]} - ${file.name}`,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      // Visual feedback - green checkmark shows in button, no toast needed
      setUploadedFiles(prev => ({ ...prev, [photoIndex]: file.name }));
      
      // Trigger callback to refresh the preview
      onFilesUploaded?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Marketing Images (5 Required)</Label>
      
      <div className="space-y-3">
        {PHOTO_REQUIREMENTS.map((requirement, index) => (
          <div key={index} className="space-y-2">
            <Label className="text-sm font-medium">
              {index + 1}. {requirement}
            </Label>
            <div className="flex gap-2 items-center">
              <input
                ref={el => fileInputRefs.current[index] = el}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(index, e)}
                className="hidden"
                id={`photo-upload-${index}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRefs.current[index]?.click()}
                disabled={uploading === index}
                className="flex-1 justify-start text-left"
              >
                {uploading === index ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : uploadedFiles[index] ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    {uploadedFiles[index]}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </>
                )}
              </Button>
              {!uploadedFiles[index] && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  No file chosen
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        * If there is no strong signature feature, #3 becomes Dining + Living combined or best secondary space.
      </p>
    </div>
  );
};
