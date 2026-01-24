import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, X, Loader2, Video, Image, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  photo_url: string;
  photo_type: string;
  media_type?: string;
  created_at: string;
}

interface VendorMultiPhotoUploadProps {
  workOrderId: string;
  photoType: "before" | "during" | "after";
  existingPhotos: Photo[];
  maxPhotos?: number;
  vendorName?: string;
  onPhotosUploaded?: () => void;
  className?: string;
}

const VendorMultiPhotoUpload = ({
  workOrderId,
  photoType,
  existingPhotos,
  maxPhotos = 10,
  vendorName = "Vendor",
  onPhotosUploaded,
  className,
}: VendorMultiPhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setUploading(true);
      setUploadProgress(0);
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith("video/");
        const fileExt = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const fileName = `${workOrderId}/${photoType}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("work-order-photos")
          .upload(fileName, file, {
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("work-order-photos")
          .getPublicUrl(fileName);

        // Insert photo record with media_type
        const { error: insertError } = await supabase
          .from("work_order_photos")
          .insert({
            work_order_id: workOrderId,
            photo_url: publicUrl,
            photo_type: photoType,
            media_type: isVideo ? "video" : "photo",
            uploaded_by: vendorName,
            uploaded_by_type: "vendor",
          });

        if (insertError) throw insertError;
        uploadedUrls.push(publicUrl);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `${files.length} ${photoType} ${files.length === 1 ? "media" : "media files"} uploaded`,
        performed_by_type: "vendor",
        performed_by_name: vendorName,
      });

      return uploadedUrls;
    },
    onSuccess: (urls) => {
      toast.success(`${urls.length} ${photoType} ${urls.length === 1 ? "file" : "files"} uploaded`);
      queryClient.invalidateQueries({ queryKey: ["work-order-photos", workOrderId] });
      setUploading(false);
      setUploadProgress(0);
      onPhotosUploaded?.();
    },
    onError: (error) => {
      toast.error("Upload failed: " + (error as Error).message);
      setUploading(false);
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = maxPhotos - existingPhotos.length;
    if (files.length > remainingSlots) {
      toast.warning(`You can only upload ${remainingSlots} more files`);
      return;
    }

    // Validate file sizes (max 50MB for videos, 10MB for photos)
    const invalidFiles = files.filter((file) => {
      if (file.type.startsWith("video/")) {
        return file.size > 50 * 1024 * 1024;
      }
      return file.size > 10 * 1024 * 1024;
    });

    if (invalidFiles.length > 0) {
      toast.error("Some files are too large. Max 50MB for videos, 10MB for photos.");
      return;
    }

    uploadMutation.mutate(files);
    e.target.value = "";
  };

  const photoCount = existingPhotos.filter(p => p.media_type !== "video").length;
  const videoCount = existingPhotos.filter(p => p.media_type === "video").length;

  const typeLabels = {
    before: "Before",
    during: "During",
    after: "After",
  };

  const typeTips = {
    before: "📷 Show the issue clearly from multiple angles",
    during: "🔧 Document the work in progress",
    after: "✅ Show the completed repair",
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {typeLabels[photoType]} Photos/Videos
        </span>
        <div className="flex gap-1">
          {photoCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Image className="h-3 w-3 mr-1" />{photoCount}
            </Badge>
          )}
          {videoCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Video className="h-3 w-3 mr-1" />{videoCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Tip */}
      <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
        {typeTips[photoType]}
      </p>

      {/* Media Grid */}
      {existingPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {existingPhotos.map((media) => (
            <div
              key={media.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted border"
            >
              {media.media_type === "video" ? (
                <div className="w-full h-full flex items-center justify-center bg-foreground">
                  <Video className="h-6 w-6 text-background" />
                  <video
                    src={media.photo_url}
                    className="absolute inset-0 w-full h-full object-cover opacity-70"
                    muted
                    preload="metadata"
                  />
                </div>
              ) : (
                <img
                  src={media.photo_url}
                  alt={`${photoType} photo`}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute bottom-1 right-1">
                <CheckCircle className="h-4 w-4 text-primary drop-shadow-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {existingPhotos.length < maxPhotos && (
        <>
          <Button
            variant="outline"
            className="w-full h-12 touch-manipulation"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading {uploadProgress}%
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Add {typeLabels[photoType]} Photos/Video
              </>
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}

      {existingPhotos.length >= maxPhotos && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum {maxPhotos} files reached
        </p>
      )}
    </div>
  );
};

export default VendorMultiPhotoUpload;
