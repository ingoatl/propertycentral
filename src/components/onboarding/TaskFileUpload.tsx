import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, File, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskFileUploadProps {
  taskId: string;
  onFilesUploaded?: () => void;
}

export const TaskFileUpload = ({ taskId, onFilesUploaded }: TaskFileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check file sizes (max 10MB per file)
    const invalidFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error("Some files exceed 10MB limit");
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadPromises = selectedFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${taskId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
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
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      });

      await Promise.all(uploadPromises);

      toast.success(`${selectedFiles.length} file(s) uploaded successfully`);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onFilesUploaded?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Attachments</Label>
      
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          Select Files
        </Button>
        
        {selectedFiles.length > 0 && (
          <Button
            type="button"
            onClick={uploadFiles}
            disabled={uploading}
            className="min-w-[100px]"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              `Upload (${selectedFiles.length})`
            )}
          </Button>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2 max-h-[150px] overflow-y-auto">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm"
            >
              <File className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};