import React, { useState, useRef } from 'react';
import { Drawer } from 'vaul';
import { Camera, Upload, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { InspectionField } from '@/types/inspection';

interface IssueCaptureDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: InspectionField | null;
  onSubmit: (data: {
    detail: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    photo?: File;
  }) => Promise<void>;
}

export const IssueCaptureDrawer: React.FC<IssueCaptureDrawerProps> = ({
  open,
  onOpenChange,
  field,
  onSubmit
}) => {
  const [detail, setDetail] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        detail,
        severity,
        photo: photo || undefined
      });
      // Reset form
      setDetail('');
      setSeverity('medium');
      setPhoto(null);
      setPhotoPreview(null);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleClose = () => {
    setDetail('');
    setSeverity('medium');
    setPhoto(null);
    setPhotoPreview(null);
    onOpenChange(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl outline-none">
          <div className="p-4 pt-2">
            {/* Drag handle */}
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-4" />
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Issue Found</h2>
                  {field && (
                    <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                      {field.label}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Form */}
            <div className="space-y-4">
              {/* Severity */}
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Minor issue</SelectItem>
                    <SelectItem value="medium">Medium - Should fix soon</SelectItem>
                    <SelectItem value="high">High - Fix before next guest</SelectItem>
                    <SelectItem value="critical">Critical - Fix immediately</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Describe the issue..."
                  className="rounded-xl min-h-[100px] resize-none"
                />
              </div>
              
              {/* Photo */}
              <div className="space-y-2">
                <Label>Photo (optional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Issue photo"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-12 rounded-xl"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      Take Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-12 rounded-xl"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                          fileInputRef.current.setAttribute('capture', 'environment');
                        }
                      }}
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Upload
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "w-full h-14 rounded-2xl text-base font-semibold",
                  "bg-primary hover:bg-primary/90"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Log Issue & Continue'
                )}
              </Button>
            </div>
            
            {/* Bottom safe area */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
