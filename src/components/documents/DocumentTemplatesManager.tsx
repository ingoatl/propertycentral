import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Upload, CheckCircle, XCircle, ExternalLink, Link2, Info, Copy, Edit2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  signwell_template_id: string | null;
  is_active: boolean;
  created_at: string;
  contract_type: string | null;
  google_drive_url: string | null;
}

export function DocumentTemplatesManager() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    file: null as File | null,
    contract_type: "co_hosting" as string,
    google_drive_url: "",
  });

  const webhookUrl = `https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/signwell-webhook`;

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

      const fileExt = formData.file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(filePath, formData.file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('signed-documents')
        .getPublicUrl(filePath);

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('document_templates')
        .insert({
          name: formData.name,
          description: formData.description || null,
          file_path: urlData.publicUrl,
          created_by: user?.id,
          is_active: true,
          contract_type: formData.contract_type,
          google_drive_url: formData.google_drive_url || null,
        });

      if (insertError) throw insertError;

      toast.success('Template uploaded successfully');
      setDialogOpen(false);
      setFormData({ name: "", description: "", file: null, contract_type: "co_hosting", google_drive_url: "" });
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

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  };

  const getContractTypeBadge = (type: string | null) => {
    switch (type) {
      case 'co_hosting':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Co-Hosting</Badge>;
      case 'full_service':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Full-Service</Badge>;
      default:
        return <Badge variant="outline">Not Set</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* SignWell Webhook Setup Info */}
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>SignWell Webhook Configuration</span>
          <Button variant="ghost" size="sm" onClick={() => setShowWebhookInfo(!showWebhookInfo)}>
            {showWebhookInfo ? 'Hide' : 'Show Details'}
          </Button>
        </AlertTitle>
        {showWebhookInfo && (
          <AlertDescription className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure this webhook URL in your SignWell dashboard to receive document status updates:
            </p>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <code className="flex-1 text-xs break-all">{webhookUrl}</code>
              <Button variant="ghost" size="icon" onClick={copyWebhookUrl} className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Steps to configure:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to <a href="https://www.signwell.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary underline">SignWell API Settings</a></li>
                <li>Click "Add Webhook Endpoint"</li>
                <li>Paste the webhook URL above</li>
                <li>Select events: <code>document_completed</code>, <code>document_signed</code>, <code>document_viewed</code></li>
              </ol>
            </div>
          </AlertDescription>
        )}
      </Alert>

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
            <p className="text-xs text-muted-foreground mt-2">
              Tip: Use DOCX files with [[placeholder]] tags for dynamic field replacement
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      {getContractTypeBadge(template.contract_type)}
                    </div>
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
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-3">
                  <a 
                    href={template.file_path} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-3 h-3" />
                    View Document
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {template.google_drive_url && (
                    <a 
                      href={template.google_drive_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit in Google Drive
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {!template.google_drive_url && (
                  <p className="text-xs text-muted-foreground">
                    No Google Drive link configured. You can add one to easily edit the source document.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document Template</DialogTitle>
            <DialogDescription>
              Upload a PDF or DOCX file to use as an agreement template. DOCX files can include [[placeholder]] tags for dynamic fields.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Co-Hosting Agreement"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract_type">Contract Type *</Label>
              <Select 
                value={formData.contract_type} 
                onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contract type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="co_hosting">Co-Hosting Agreement</SelectItem>
                  <SelectItem value="full_service">Full-Service Management Agreement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Standard agreement for co-hosting partners..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="google_drive_url" className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Google Drive Link (Optional)
              </Label>
              <Input
                id="google_drive_url"
                type="url"
                value={formData.google_drive_url}
                onChange={(e) => setFormData({ ...formData, google_drive_url: e.target.value })}
                placeholder="https://docs.google.com/document/d/..."
              />
              <p className="text-xs text-muted-foreground">
                Link to the editable source document in Google Drive for future updates
              </p>
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
