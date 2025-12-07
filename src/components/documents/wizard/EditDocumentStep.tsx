import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardData } from "../DocumentCreateWizard";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

interface CustomClause {
  id: string;
  title: string;
  content: string;
}

const EditDocumentStep = ({ data, updateData }: Props) => {
  const [customClauses, setCustomClauses] = useState<CustomClause[]>(
    data.customClauses || []
  );

  const addCustomClause = () => {
    const newClause: CustomClause = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
    };
    const updated = [...customClauses, newClause];
    setCustomClauses(updated);
    updateData({ customClauses: updated });
  };

  const updateClause = (id: string, field: "title" | "content", value: string) => {
    const updated = customClauses.map((c) =>
      c.id === id ? { ...c, [field]: value } : c
    );
    setCustomClauses(updated);
    updateData({ customClauses: updated });
  };

  const removeClause = (id: string) => {
    const updated = customClauses.filter((c) => c.id !== id);
    setCustomClauses(updated);
    updateData({ customClauses: updated });
  };

  // Group fields by category for display
  const fieldsByCategory = data.detectedFields.reduce((acc, field) => {
    const cat = field.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(field);
    return acc;
  }, {} as Record<string, typeof data.detectedFields>);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Edit Document Content</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Review the document structure and add any custom terms or modifications.
        </p>
      </div>

      {/* Template Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">{data.templateName || "Selected Template"}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                This template contains {data.detectedFields.length} fields that will be filled during the process.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detected Fields Summary */}
      {data.detectedFields.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Document Fields</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(fieldsByCategory).map(([category, fields]) => (
              <div key={category} className="p-3 border rounded-lg bg-background">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  {category.replace(/_/g, " ")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {fields.map((field) => (
                    <Badge key={field.api_id} variant="secondary" className="text-xs">
                      {field.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Terms Input */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Additional Terms & Conditions</Label>
        <Textarea
          placeholder="Add any additional terms, conditions, or notes that should be included in this specific agreement..."
          value={data.additionalTerms || ""}
          onChange={(e) => updateData({ additionalTerms: e.target.value })}
          className="min-h-[120px]"
        />
        <p className="text-xs text-muted-foreground">
          These terms will be appended to the document before signing.
        </p>
      </div>

      {/* Custom Clauses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Custom Clauses</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomClause}
            className="gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Clause
          </Button>
        </div>

        {customClauses.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No custom clauses added. Click "Add Clause" to include specific provisions for this agreement.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {customClauses.map((clause, index) => (
              <Card key={clause.id} className="relative">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder={`Clause ${index + 1} Title (e.g., "Pet Policy")`}
                        value={clause.title}
                        onChange={(e) => updateClause(clause.id, "title", e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeClause(clause.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Enter the clause content..."
                    value={clause.content}
                    onChange={(e) => updateClause(clause.id, "content", e.target.value)}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Special Instructions */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Special Instructions (Internal)</Label>
        <Textarea
          placeholder="Add any internal notes or special instructions for this document (not included in the final agreement)..."
          value={data.internalNotes || ""}
          onChange={(e) => updateData({ internalNotes: e.target.value })}
          className="min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground">
          Internal use only - these notes won't appear in the signed document.
        </p>
      </div>
    </div>
  );
};

export default EditDocumentStep;
