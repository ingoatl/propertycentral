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
      
      // Load preview URLs for images (bucket is private, need signed URLs)
      const urls: Record<string, string> = {};
      
      for (const file of (data || [])) {
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
      toast.error("Failed to load attachments");
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
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {attachments.map((attachment) => {
          const isImage = attachment.file_type.startsWith('image/');
          const FileIconComponent = getFileIcon(attachment.file_type);

          return (
            <div
              key={attachment.id}
              className="relative group"
              onMouseEnter={() => setHoveredFile(attachment.id)}
              onMouseLeave={() => setHoveredFile(null)}
            >
              {/* Small preview - always visible */}
              <div className={cn(
                "aspect-square border border-border rounded-lg overflow-hidden transition-all duration-200",
                "hover:ring-2 hover:ring-primary hover:shadow-md cursor-pointer"
              )}>
                <div className="w-full h-full bg-muted flex items-center justify-center p-2">
                  {isImage && imageUrls[attachment.id] ? (
                    <img
                      src={imageUrls[attachment.id]}
                      alt={attachment.file_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // If image fails to load, hide it and show icon instead
                        e.currentTarget.style.display = 'none';
                        const icon = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                        if (icon) icon.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <FileIconComponent className={cn(
                    "w-6 h-6 text-muted-foreground fallback-icon",
                    isImage && imageUrls[attachment.id] && "hidden"
                  )} />
                </div>

                {/* Actions overlay - shows on hover */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownload(attachment)}
                    className="h-6 w-6 p-0"
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(attachment)}
                    className="h-6 w-6 p-0"
                    title="Delete"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* File name tooltip on hover */}
              <div className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground",
                "text-xs rounded shadow-lg whitespace-nowrap pointer-events-none transition-opacity z-30",
                "opacity-0 group-hover:opacity-100"
              )}>
                <div className="max-w-[200px] truncate">{attachment.file_name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {(attachment.file_size / 1024).toFixed(1)} KB
                </div>
              </div>

              {/* Enlarged preview on hover - for all files with URLs */}
              {hoveredFile === attachment.id && imageUrls[attachment.id] && (
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] max-w-[90vw] h-[500px] max-h-[90vh] pointer-events-none z-50 hidden lg:block">
                  {isImage ? (
                    <img
                      src={imageUrls[attachment.id]}
                      alt={attachment.file_name}
                      className="w-full h-full object-contain bg-background/95 backdrop-blur-sm border-4 border-primary rounded-lg shadow-2xl"
                    />
                  ) : (
                    <div className="w-full h-full bg-background/95 backdrop-blur-sm border-4 border-primary rounded-lg shadow-2xl flex items-center justify-center p-8">
                      <div className="text-center">
                        <FileIconComponent className="w-24 h-24 mx-auto mb-4 text-primary" />
                        <p className="text-lg font-medium">{attachment.file_name}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {(attachment.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};