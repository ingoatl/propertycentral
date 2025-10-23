import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, X, File, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface TaskFilePreviewProps {
  taskId: string;
  onFilesChange?: () => void;
}

export const TaskFilePreview = ({ taskId, onFilesChange }: TaskFilePreviewProps) => {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAttachments(data || []);
      
      // Load preview URLs for images
      const imageFiles = (data || []).filter(f => f.file_type.startsWith('image/'));
      const urls: Record<string, string> = {};
      
      for (const file of imageFiles) {
        const { data: urlData } = await supabase.storage
          .from('task-attachments')
          .createSignedUrl(file.file_path, 3600);
        
        if (urlData?.signedUrl) {
          urls[file.id] = urlData.signedUrl;
        }
      }
      
      setImageUrls(urls);
    } catch (error) {
      console.error("Error loading attachments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("File downloaded");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDelete = async (attachment: TaskAttachment) => {
    if (!confirm(`Delete ${attachment.file_name}?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      toast.success("File deleted");
      loadAttachments();
      onFilesChange?.();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete file");
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return ImageIcon;
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Attachments ({attachments.length})</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {attachments.map((attachment) => {
          const isImage = attachment.file_type.startsWith('image/');
          const FileIconComponent = getFileIcon(attachment.file_type);

          return (
            <div
              key={attachment.id}
              className={cn(
                "relative group border border-border rounded-lg overflow-hidden transition-all duration-300",
                hoveredFile === attachment.id && isImage ? "ring-2 ring-primary shadow-lg scale-105 z-10" : ""
              )}
              onMouseEnter={() => setHoveredFile(attachment.id)}
              onMouseLeave={() => setHoveredFile(null)}
            >
              {/* Preview */}
              <div className="aspect-square bg-muted flex items-center justify-center p-4">
                {isImage && imageUrls[attachment.id] ? (
                  <img
                    src={imageUrls[attachment.id]}
                    alt={attachment.file_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileIconComponent className="w-12 h-12 text-muted-foreground" />
                )}
              </div>

              {/* File info */}
              <div className="p-2 bg-card">
                <p className="text-xs font-medium truncate" title={attachment.file_name}>
                  {attachment.file_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(attachment.file_size / 1024).toFixed(1)} KB
                </p>
              </div>

              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload(attachment)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(attachment)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Enlarged preview on hover */}
              {hoveredFile === attachment.id && isImage && imageUrls[attachment.id] && (
                <div className="absolute left-full top-0 ml-2 w-64 h-64 pointer-events-none z-20 hidden lg:block">
                  <img
                    src={imageUrls[attachment.id]}
                    alt={attachment.file_name}
                    className="w-full h-full object-contain bg-background border-2 border-primary rounded-lg shadow-2xl"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};