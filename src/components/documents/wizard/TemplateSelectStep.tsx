import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WizardData, DetectedField } from "../DocumentCreateWizard";

interface Template {
  id: string;
  name: string;
  description: string | null;
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
      
      // Parse field_mappings from JSON - cast through unknown for safety
      const parsedTemplates = (templatesData || []).map(t => ({
        ...t,
        field_mappings: (Array.isArray(t.field_mappings) ? t.field_mappings as unknown as DetectedField[] : null),
      }));
      
      setTemplates(parsedTemplates);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeTemplateFields = async (templateId: string): Promise<DetectedField[]> => {
    try {
      setAnalyzingTemplateId(templateId);
      
      const { data: response, error } = await supabase.functions.invoke("analyze-document-fields", {
        body: { templateId },
      });

      if (error) throw error;
      
      if (response?.success && response?.fields) {
        return response.fields;
      }
      
      throw new Error(response?.error || "Failed to analyze document");
    } catch (error) {
      console.error("Error analyzing template:", error);
      toast.error("Failed to analyze document fields");
      return [];
    } finally {
      setAnalyzingTemplateId(null);
    }
  };

  const selectTemplate = async (template: Template) => {
    // Set basic template info immediately
    updateData({
      templateId: template.id,
      templateName: template.name,
      documentName: template.name,
    });

    // Check if we already have cached field mappings
    if (template.field_mappings && template.field_mappings.length > 0) {
      updateData({
        detectedFields: template.field_mappings,
      });
      toast.success(`Loaded ${template.field_mappings.length} fields from template`);
    } else {
      // Analyze the document to detect fields
      toast.info("Analyzing document to detect fields...");
      const fields = await analyzeTemplateFields(template.id);
      
      if (fields.length > 0) {
        updateData({
          detectedFields: fields,
        });
        toast.success(`Detected ${fields.length} fields in document`);
        
        // Update local template cache
        setTemplates(prev => 
          prev.map(t => t.id === template.id ? { ...t, field_mappings: fields } : t)
        );
      }
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
          Choose the template for your document. Fields will be automatically detected.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => {
          const isSelected = data.templateId === template.id;
          const isAnalyzing = analyzingTemplateId === template.id;
          const hasFields = template.field_mappings && template.field_mappings.length > 0;
          
          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:border-primary ${
                isSelected ? "border-primary ring-2 ring-primary/20" : ""
              } ${isAnalyzing ? "opacity-70" : ""}`}
              onClick={() => !isAnalyzing && selectTemplate(template)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
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
                      {template.field_mappings!.length} fields detected
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TemplateSelectStep;
