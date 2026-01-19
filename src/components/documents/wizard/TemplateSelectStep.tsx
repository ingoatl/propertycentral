import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { getFieldAssignment } from "@/utils/fieldAssignment";
import { extractDocumentFields } from "@/utils/documentFieldExtractor";

interface Template {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  is_active: boolean | null;
  field_mappings: DetectedField[] | null;
}

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const TemplateSelectStep = ({ data, updateData }: Props) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingTemplateId, setAnalyzingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: templatesData, error } = await supabase
        .from("document_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      // Parse field_mappings - preserve ALL position data
      const parsedTemplates = (templatesData || []).map(t => {
        let parsedMappings: DetectedField[] | null = null;
        if (Array.isArray(t.field_mappings)) {
          parsedMappings = (t.field_mappings as any[]).map(f => ({
            api_id: f.api_id,
            label: f.label,
            type: f.type,
            filled_by: f.filled_by,
            category: f.category,
            description: f.description,
            required: f.required,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            page: f.page,
          } as DetectedField));
        }
        return {
          ...t,
          field_mappings: parsedMappings,
        };
      });
      
      console.log('[TemplateSelectStep] Loaded templates:', parsedTemplates.length);
      setTemplates(parsedTemplates);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Analyze template using client-side PDF.js extraction
   * This is the primary method - extracts REAL coordinates from PDF
   */
  const analyzeTemplateClient = async (template: Template): Promise<DetectedField[]> => {
    const filePath = template.file_path;
    const isPdf = filePath.toLowerCase().endsWith('.pdf');
    
    if (!isPdf) {
      // For non-PDF files, fall back to server-side analysis
      return analyzeTemplateServer(template.id, true);
    }

    // Get the full URL for the PDF
    const { data: urlData } = supabase.storage
      .from('onboarding-documents')
      .getPublicUrl(filePath);
    
    const pdfUrl = urlData?.publicUrl;
    if (!pdfUrl) {
      throw new Error("Could not get document URL");
    }

    console.log('[TemplateSelectStep] Extracting fields client-side from:', pdfUrl);

    try {
      // Use the unified document field extractor
      const result = await extractDocumentFields(pdfUrl);
      
      console.log('[TemplateSelectStep] Client extraction result:', {
        fields: result.fields.length,
        hasAcroForm: result.hasAcroForm,
        documentType: result.documentType,
        totalPages: result.totalPages,
      });

      if (result.fields.length > 0) {
        // Send to server to save and optionally enhance
        const { data: response, error } = await supabase.functions.invoke("analyze-document-fields", {
          body: { 
            templateId: template.id,
            extractedFields: result.fields,
            textContent: result.textLines.map(l => l.text).join(' '),
            totalPages: result.totalPages,
            hasAcroForm: result.hasAcroForm,
          },
        });

        if (error) {
          console.error("Server enhancement error:", error);
          // Still use client-extracted fields
          return result.fields as DetectedField[];
        }

        return response?.fields || result.fields;
      }

      // If no fields found client-side, fall back to server
      return analyzeTemplateServer(template.id, true);
    } catch (clientError) {
      console.error("Client-side extraction failed:", clientError);
      // Fall back to server-side analysis
      return analyzeTemplateServer(template.id, true);
    }
  };

  /**
   * Server-side analysis (fallback for non-PDF or when client fails)
   */
  const analyzeTemplateServer = async (templateId: string, forceReanalyze: boolean = false): Promise<DetectedField[]> => {
    const { data: response, error } = await supabase.functions.invoke("analyze-document-fields", {
      body: { templateId, forceReanalyze },
    });

    if (error) throw error;
    
    if (response?.success && response?.fields) {
      return response.fields;
    }
    
    throw new Error(response?.error || "Failed to analyze document");
  };

  const selectTemplate = async (template: Template) => {
    setAnalyzingTemplateId(template.id);

    // Set basic template info immediately
    updateData({
      templateId: template.id,
      templateName: template.name,
      documentName: template.name,
    });

    try {
      // Fetch document content for editing
      const { data: textResponse, error: textError } = await supabase.functions.invoke("extract-document-text", {
        body: { templateId: template.id },
      });
      
      if (!textError && textResponse?.success && textResponse?.content) {
        updateData({ documentContent: textResponse.content });
      }

      // Check if we have cached field mappings with positions
      if (template.field_mappings && template.field_mappings.length > 0) {
        console.log('[TemplateSelectStep] Using cached field mappings:', template.field_mappings.length);
        const processedFields = applyDefaultAssignments(template.field_mappings);
        updateData({ detectedFields: processedFields });
        toast.success(`Loaded ${processedFields.length} fields from template`);
      } else {
        // Analyze the document to detect fields
        toast.info("Analyzing document to detect fields...");
        const fields = await analyzeTemplateClient(template);
        
        if (fields.length > 0) {
          const processedFields = applyDefaultAssignments(fields);
          updateData({ detectedFields: processedFields });
          toast.success(`Detected ${fields.length} fields in document`);
          
          // Update local template cache
          setTemplates(prev => 
            prev.map(t => t.id === template.id ? { ...t, field_mappings: fields } : t)
          );
        } else {
          toast.warning("No fillable fields detected in document");
        }
      }
    } catch (error) {
      console.error("Error analyzing template:", error);
      toast.error("Failed to analyze document");
    } finally {
      setAnalyzingTemplateId(null);
    }
  };

  // Apply smart defaults - preserve position data
  const applyDefaultAssignments = (fields: DetectedField[]): DetectedField[] => {
    return fields.map(field => {
      const assignedTo = getFieldAssignment(field.api_id, field.label, field.category);
      return { ...field, filled_by: assignedTo };
    });
  };

  const handleReanalyze = async (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    setAnalyzingTemplateId(template.id);
    toast.info("Re-analyzing document...");
    
    try {
      // Clear cached fields in database
      await supabase
        .from("document_templates")
        .update({ field_mappings: null })
        .eq("id", template.id);
      
      // Re-analyze using client-side extraction
      const fields = await analyzeTemplateClient(template);
      
      if (fields.length > 0) {
        // Update wizard data if this template is selected
        if (data.templateId === template.id) {
          const processedFields = applyDefaultAssignments(fields);
          updateData({ detectedFields: processedFields });
        }
        
        // Update local template cache
        setTemplates(prev => 
          prev.map(t => t.id === template.id ? { ...t, field_mappings: fields } : t)
        );
        
        const signatureFields = fields.filter(f => f.category === "signature" || f.type === "signature").length;
        toast.success(`Detected ${fields.length} fields (${signatureFields} signatures)`);
      } else {
        toast.warning("No fields detected");
      }
    } catch (error) {
      console.error("Re-analysis error:", error);
      toast.error("Failed to re-analyze document");
    } finally {
      setAnalyzingTemplateId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Label className="text-lg font-medium">Select a Document Template</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Templates Available</h3>
        <p className="text-muted-foreground">
          Please create a template in the Templates tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-lg font-medium">Select a Document Template</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the template for your document. Fields and signatures will be automatically detected.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => {
          const isSelected = data.templateId === template.id;
          const isAnalyzing = analyzingTemplateId === template.id;
          const hasFields = template.field_mappings && template.field_mappings.length > 0;
          const signatureCount = template.field_mappings?.filter(f => f.category === "signature" || f.type === "signature").length || 0;
          
          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:border-primary ${
                isSelected ? "border-primary ring-2 ring-primary/20" : ""
              } ${isAnalyzing ? "opacity-70" : ""}`}
              onClick={() => !isAnalyzing && selectTemplate(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isSelected ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{template.name}</h4>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    {hasFields && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.field_mappings!.length} fields • {signatureCount} signatures
                      </p>
                    )}
                  </div>
                </div>
                
                {hasFields && (
                  <div className="mt-3 pt-3 border-t flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleReanalyze(e, template)}
                      disabled={isAnalyzing}
                      className="text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`} />
                      Re-analyze Fields
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TemplateSelectStep;
