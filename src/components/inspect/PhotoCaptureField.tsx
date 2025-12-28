import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PhotoCaptureFieldProps {
  inspectionId: string;
  fieldKey: string;
  photoLabel: string;
  photoType: 'capture' | 'upload' | 'both';
  existingPhotoUrl?: string;
  onPhotoUploaded: (url: string) => void;
}

export const PhotoCaptureField: React.FC<PhotoCaptureFieldProps> = ({
  inspectionId,
  fieldKey,
  photoLabel,
  photoType,
  existingPhotoUrl,
  onPhotoUploaded
}) => {
  const [photoPreview, setPhotoPreview] = useState<string | null>(existingPhotoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.warn('File too large. Max 10MB allowed.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${inspectionId}/${fieldKey}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('inspection-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('inspection-photos')
        .getPublicUrl(fileName);

      // Save photo record to database
      const { error: dbError } = await supabase.from('inspection_photos').insert({
        inspection_id: inspectionId,
        field_key: fieldKey,
        photo_url: urlData.publicUrl,
        caption: photoLabel
      });

      if (dbError) throw dbError;

      onPhotoUploaded(urlData.publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      setPhotoPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoPreview(null);
    // Note: We could also delete from storage here, but keeping for audit trail
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Photo Label */}
      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
        <ImageIcon className="h-4 w-4" />
        {photoLabel}
      </p>

      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Photo Preview or Capture Buttons */}
      {photoPreview ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-primary/30">
          <img
            src={photoPreview}
            alt="Captured"
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm"
              onClick={handleRemovePhoto}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="absolute bottom-2 left-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/90 text-white rounded-full text-sm font-medium">
              <Check className="h-4 w-4" />
              Photo captured
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          {isUploading ? (
            <div className="flex-1 h-28 rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center bg-muted/50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {(photoType === 'capture' || photoType === 'both') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={triggerCamera}
                  className={cn(
                    "flex-1 h-28 rounded-xl border-2 border-dashed flex-col gap-2",
                    "hover:border-primary hover:bg-primary/5 transition-all",
                    "active:scale-98 min-h-[112px]"
                  )}
                >
                  <Camera className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">Take Photo</span>
                </Button>
              )}
              {(photoType === 'upload' || photoType === 'both') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={triggerFileUpload}
                  className={cn(
                    "flex-1 h-28 rounded-xl border-2 border-dashed flex-col gap-2",
                    "hover:border-primary hover:bg-primary/5 transition-all",
                    "active:scale-98 min-h-[112px]"
                  )}
                >
                  <Upload className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">Upload</span>
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
