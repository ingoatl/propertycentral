import { useState, useRef } from "react";
import { Paperclip, X, Loader2, FileIcon, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface AttachmentUploaderProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function AttachmentUploader({
  attachments,
  onAttachmentsChange,
  maxFiles = 5,
  maxSizeMB = 10,
}: AttachmentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from("message-attachments")
          .upload(fileName, file);

        if (error) {
          console.error("Upload error:", error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("message-attachments")
          .getPublicUrl(data.path);

        newAttachments.push({
          id: data.path,
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
        });
      }

      onAttachmentsChange([...attachments, ...newAttachments]);
      
      if (newAttachments.length > 0) {
        toast.success(`${newAttachments.length} file(s) uploaded`);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    try {
      await supabase.storage
        .from("message-attachments")
        .remove([attachmentId]);

      onAttachmentsChange(attachments.filter(a => a.id !== attachmentId));
      toast.success("Attachment removed");
    } catch (error) {
      console.error("Remove error:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (type: string) => type.startsWith("image/");

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || attachments.length >= maxFiles}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1 text-xs"
            >
              {isImage(attachment.type) ? (
                <Image className="h-3.5 w-3.5 text-primary" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="max-w-[100px] truncate">{attachment.name}</span>
              <span className="text-muted-foreground">
                ({formatFileSize(attachment.size)})
              </span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
