import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Upload, CheckCircle, XCircle } from "lucide-react";

interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  signwell_template_id: string | null;
  is_active: boolean;
  created_at: string;
}

export function DocumentTemplatesManager() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    file: null as File | null,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a PDF or DOCX file');
        return;
      }
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.file) {
      toast.error('Please provide a name and upload a file');
      return;
    }

    try {
      setUploading(true);

      // Upload file to storage
      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(filePath, formData.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('signed-documents')
        .getPublicUrl(filePath);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create template record
      const { error: insertError } = await supabase
        .from('document_templates')
        .insert({
          name: formData.name,
          description: formData.description || null,
          file_path: urlData.publicUrl,
          created_by: user?.id,
          is_active: true,
        });

      if (insertError) throw insertError;

      toast.success('Template uploaded successfully');
      setDialogOpen(false);
      setFormData({ name: "", description: "", file: null });
      loadTemplates();
    } catch (error: any) {
      console.error('Error uploading template:', error);
      toast.error(error.message || 'Failed to upload template');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (template: DocumentTemplate) => {
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;
      toast.success(`Template ${template.is_active ? 'deactivated' : 'activated'}`);
      loadTemplates();
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template deleted');
      loadTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Templates</h2>
          <p className="text-muted-foreground">Manage agreement templates for e-signatures</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Template
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No templates yet. Upload your first template to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={template.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(template)}
                    >
                      {template.is_active ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(template.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <a 
                  href={template.file_path} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View Document
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document Template</DialogTitle>
            <DialogDescription>
              Upload a PDF or DOCX file to use as an agreement template
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Innkeeper Agreement"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Standard agreement for mid-term rentals..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Document File (PDF or DOCX) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {formData.file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {formData.file.name}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading} className="gap-2">
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
