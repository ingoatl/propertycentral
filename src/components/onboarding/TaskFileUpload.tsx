import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, File, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaskFileUploadProps {
  taskId: string;
  taskTitle?: string;
  projectId?: string;
  propertyId?: string;
  onFilesUploaded?: () => void;
  onAnalysisStarted?: () => void;
}

export const TaskFileUpload = ({ 
  taskId, 
  taskTitle = "", 
  projectId, 
  propertyId,
  onFilesUploaded, 
  onAnalysisStarted 
}: TaskFileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if this is a permit/license task
  const isPermitTask = taskTitle.toLowerCase().includes("permit") || 
                       taskTitle.toLowerCase().includes("license") ||
                       taskTitle.toLowerCase().includes("str license");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check file sizes (max 50MB per file)
    const invalidFiles = files.filter(f => f.size > 50 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error("Some files exceed 50MB limit");
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle permit upload with AI analysis
  const handlePermitUpload = async (userId: string) => {
    for (const file of selectedFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${taskId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload to task-attachments bucket
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save metadata to task_attachments table
      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: userId,
        });

      if (dbError) throw dbError;

      // Get property_id from project if not provided
      let actualPropertyId = propertyId;
      if (!actualPropertyId && projectId) {
        const { data: project } = await supabase
          .from("onboarding_projects")
          .select("property_id")
          .eq("id", projectId)
          .maybeSingle();
        actualPropertyId = project?.property_id || undefined;
      }

      if (actualPropertyId) {
        // Create a property_documents entry for the permit (use upsert to handle duplicates)
        const { data: docEntry, error: docError } = await supabase
          .from("property_documents")
          .upsert({
            property_id: actualPropertyId,
            project_id: projectId,
            file_name: file.name,
            file_path: fileName,
            file_type: fileExt || "pdf",
            document_type: "str_permit",
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "property_id,file_name",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (docError) {
          console.error("Failed to create/update document entry:", docError);
          // Try to find existing document entry
          const { data: existingDoc } = await supabase
            .from("property_documents")
            .select("id")
            .eq("property_id", actualPropertyId)
            .eq("document_type", "str_permit")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingDoc) {
            // Use existing document, trigger analysis
            onAnalysisStarted?.();
            toast.info("Analyzing permit with AI...", { duration: 3000 });

            const { data: result, error: analysisError } = await supabase.functions.invoke("analyze-permit", {
              body: {
                documentId: existingDoc.id,
                propertyId: actualPropertyId,
                filePath: fileName,
                bucket: "task-attachments",
              },
            });

            if (analysisError) {
              console.error("Permit analysis error:", analysisError);
              toast.error("Failed to analyze permit");
            } else if (result?.success) {
              toast.success(result.message || "Permit analyzed successfully");
            } else {
              toast.warning("Could not extract permit details. Please enter expiration date manually.");
            }
          }
          continue;
        }

        // Notify that analysis is starting
        onAnalysisStarted?.();
        toast.info("Analyzing permit with AI...", { duration: 3000 });

        // Call the AI analysis function with the task-attachments bucket
        const { data: result, error: analysisError } = await supabase.functions.invoke("analyze-permit", {
          body: {
            documentId: docEntry.id,
            propertyId: actualPropertyId,
            filePath: fileName,
            bucket: "task-attachments",
          },
        });

        if (analysisError) {
          console.error("Permit analysis error:", analysisError);
          toast.error("Failed to analyze permit");
        } else if (result?.success) {
          toast.success(result.message || "Permit analyzed successfully");
        } else {
          toast.warning("Could not extract permit details. Please enter expiration date manually.");
        }
      }
    }
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

      // For permit tasks, we need to handle differently
      if (isPermitTask && projectId) {
        // Upload to task-attachments but also trigger permit analysis
        await handlePermitUpload(user.id);
      } else {
        // Standard upload flow
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
      }

      // Visual feedback only - no toast, parent will see files in preview
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Trigger callback to refresh the preview
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