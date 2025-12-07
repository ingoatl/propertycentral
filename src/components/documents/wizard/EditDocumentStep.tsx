import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { WizardData } from "../DocumentCreateWizard";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const EditDocumentStep = ({ data, updateData }: Props) => {
  const hasContent = data.documentContent && data.documentContent.trim().length > 0;
  const isLoading = data.templateId && !hasContent;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-lg font-medium">Edit Document Content</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Edit the raw document text below. This is the full content that will be sent for signing.
        </p>
      </div>

      {/* Template Info */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{data.templateName || "Selected Template"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Raw Document Editor */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Document Text</Label>
        {isLoading ? (
          <div className="min-h-[500px] border rounded-md flex items-center justify-center bg-muted/30">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading document content...</span>
            </div>
          </div>
        ) : (
          <Textarea
            placeholder="Document content will appear here after selecting a template..."
            value={data.documentContent || ""}
            onChange={(e) => updateData({ documentContent: e.target.value })}
            className="min-h-[500px] font-mono text-sm leading-relaxed resize-y"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Use placeholders like [[guest_name]], [[property_address]], [[monthly_rent]] for dynamic fields.
        </p>
      </div>
    </div>
  );
};

export default EditDocumentStep;
