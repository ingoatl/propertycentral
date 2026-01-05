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
import { Plus, FileText, Trash2, Upload, CheckCircle, XCircle, ExternalLink, Link2, Edit2, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { extractPdfTextWithPositions } from "@/utils/pdfTextExtractor";

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

const CONTRACT_TYPE_OPTIONS = [
  { value: "co_hosting", label: "Co-Hosting Agreement" },
  { value: "full_service", label: "Full-Service Management Agreement" },
  { value: "rental_agreement", label: "Rental/Lease Agreement" },
  { value: "addendum", label: "Addendum" },
  { value: "pet_policy", label: "Pet Policy Agreement" },
  { value: "early_termination", label: "Early Termination Agreement" },
  { value: "other", label: "Other" },
];

export function DocumentTemplatesManager() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [contractTypeOpen, setContractTypeOpen] = useState(false);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    file: null as File | null,
    contract_type: "",
    google_drive_url: "",
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

  const analyzeDocument = async (file: File): Promise<{ contract_type: string; name: string } | null> => {
    try {
      setAnalyzing(true);
      
      // Upload file temporarily to analyze
      const fileExt = file.name.split('.').pop();
      const tempFileName = `temp_${crypto.randomUUID()}.${fileExt}`;
      const tempPath = `temp/${tempFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(tempPath, file);

      if (uploadError) {
        console.error('Temp upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('signed-documents')
        .getPublicUrl(tempPath);

      // Call analyze function
      const { data, error } = await supabase.functions.invoke('analyze-document-fields', {
        body: { 
          fileUrl: urlData.publicUrl,
          detectTypeOnly: true 
        },
      });

      // Clean up temp file
      await supabase.storage.from('signed-documents').remove([tempPath]);

      if (error) {
        console.error('Analysis error:', error);
        return null;
      }

      return {
        contract_type: data?.detected_contract_type || 'other',
        name: data?.suggested_name || '',
      };
    } catch (err) {
      console.error('Error analyzing document:', err);
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Only allow PDF files
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file. DOCX files are no longer supported.');
        return;
      }
      
      setFormData({ ...formData, file });
      setDetectedType(null);
      
      // Analyze document to detect type
      const result = await analyzeDocument(file);
      if (result) {
        setDetectedType(result.contract_type);
        setFormData(prev => ({
          ...prev,
          contract_type: result.contract_type,
          name: prev.name || result.name,
        }));
        toast.success(`Detected: ${CONTRACT_TYPE_OPTIONS.find(o => o.value === result.contract_type)?.label || result.contract_type}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.file || !formData.contract_type) {
      toast.error('Please provide a name, contract type, and upload a file');
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

      // Insert template first
      const { data: insertedTemplate, error: insertError } = await supabase
        .from('document_templates')
        .insert({
          name: formData.name,
          description: formData.description || null,
          file_path: urlData.publicUrl,
          created_by: user?.id,
          is_active: true,
          contract_type: formData.contract_type,
          google_drive_url: formData.google_drive_url || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Extract text positions from PDF client-side for accurate field detection
      toast.info('Analyzing PDF for field positions...');
      
      try {
        // Extract text with positions from PDF using PDF.js
        const { textPositions, totalPages } = await extractPdfTextWithPositions(urlData.publicUrl);
        
        console.log(`Extracted ${textPositions.length} text items from ${totalPages} pages`);
        
        // Send to AI for intelligent field detection
        const { data: fieldData, error: fieldError } = await supabase.functions.invoke('detect-pdf-fields', {
          body: { 
            textPositions,
            templateId: insertedTemplate.id,
            totalPages,
          },
        });

        if (fieldError) {
          console.error('Field detection error:', fieldError);
          toast.warning('Template uploaded, but field detection failed. You can re-analyze later.');
        } else if (fieldData?.fields?.length > 0) {
          toast.success(`Detected ${fieldData.fields.length} fillable fields with accurate positions`);
        } else {
          toast.warning('No fillable fields detected. You may need to add fields manually.');
        }
      } catch (fieldErr) {
        console.error('Field detection error:', fieldErr);
        toast.warning('Could not analyze PDF for fields. You can re-analyze later.');
      }

      toast.success('Template uploaded successfully');
      setDialogOpen(false);
      setFormData({ name: "", description: "", file: null, contract_type: "", google_drive_url: "" });
      setDetectedType(null);
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
      // Check if template is in use by any documents
      const { data: usedDocs, error: checkError } = await supabase
        .from('booking_documents')
        .select('id')
        .eq('template_id', id)
        .limit(1);

      if (checkError) throw checkError;

      if (usedDocs && usedDocs.length > 0) {
        // Template is in use - just deactivate it instead
        const { error: deactivateError } = await supabase
          .from('document_templates')
          .update({ is_active: false })
          .eq('id', id);

        if (deactivateError) throw deactivateError;
        toast.success('Template deactivated (in use by existing documents)');
        loadTemplates();
        return;
      }

      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Template deleted');
      loadTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template: ' + (error.message || 'Unknown error'));
    }
  };

  const handleReanalyze = async (template: DocumentTemplate) => {
    try {
      setReanalyzing(template.id);
      
      // Extract text positions from PDF
      const { textPositions, totalPages } = await extractPdfTextWithPositions(template.file_path);
      
      console.log(`Re-analyzing: extracted ${textPositions.length} text items from ${totalPages} pages`);
      
      // Send to AI for field detection
      const { data, error } = await supabase.functions.invoke('detect-pdf-fields', {
        body: { 
          textPositions,
          templateId: template.id,
          totalPages,
        },
      });

      if (error) throw error;
      
      if (data?.fields?.length > 0) {
        toast.success(`Re-detected ${data.fields.length} fillable fields with accurate positions`);
        loadTemplates();
      } else {
        toast.warning('No fillable fields detected');
      }
    } catch (error: any) {
      console.error('Error re-analyzing:', error);
      toast.error('Failed to re-analyze document: ' + (error.message || 'Unknown error'));
    } finally {
      setReanalyzing(null);
    }
  };

  const getContractTypeBadge = (type: string | null) => {
    const option = CONTRACT_TYPE_OPTIONS.find(o => o.value === type);
    if (!option) return <Badge variant="outline">Not Set</Badge>;
    
    const colorMap: Record<string, string> = {
      co_hosting: "bg-blue-100 text-blue-700",
      full_service: "bg-purple-100 text-purple-700",
      rental_agreement: "bg-green-100 text-green-700",
      addendum: "bg-yellow-100 text-yellow-700",
      pet_policy: "bg-orange-100 text-orange-700",
      early_termination: "bg-red-100 text-red-700",
      other: "bg-gray-100 text-gray-700",
    };
    
    return (
      <Badge variant="secondary" className={colorMap[type || 'other'] || colorMap.other}>
        {option.label}
      </Badge>
    );
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
            <p className="text-muted-foreground">No templates yet. Upload your first PDF template to get started.</p>
            <p className="text-xs text-muted-foreground mt-2">
              AI will automatically detect fillable fields and their positions
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleReanalyze(template)}
                      disabled={reanalyzing === template.id}
                      title="Re-analyze document"
                    >
                      {reanalyzing === template.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
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
              Upload a PDF file. AI will automatically detect fields and their positions for signing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Document File (PDF only) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing document...</span>
                </div>
              )}
              {detectedType && !analyzing && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Sparkles className="w-4 h-4" />
                  <span>Detected: {CONTRACT_TYPE_OPTIONS.find(o => o.value === detectedType)?.label}</span>
                </div>
              )}
              {formData.file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {formData.file.name}
                </p>
              )}
            </div>

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
              <Label>Contract Type *</Label>
              <Popover open={contractTypeOpen} onOpenChange={setContractTypeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={contractTypeOpen}
                    className="w-full justify-between"
                    disabled={analyzing}
                  >
                    {formData.contract_type
                      ? CONTRACT_TYPE_OPTIONS.find((option) => option.value === formData.contract_type)?.label || formData.contract_type
                      : "Select contract type..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search or enter custom type..." />
                    <CommandList>
                      <CommandEmpty>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            setContractTypeOpen(false);
                          }}
                        >
                          Use as custom type
                        </Button>
                      </CommandEmpty>
                      <CommandGroup>
                        {CONTRACT_TYPE_OPTIONS.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={(currentValue) => {
                              setFormData({ ...formData, contract_type: currentValue });
                              setContractTypeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.contract_type === option.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                AI detected type can be overridden if needed
              </p>
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
                Link to the editable source document in Google Drive
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading || analyzing} className="gap-2">
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
