import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, ExternalLink, CheckCircle, PenTool, User, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WizardData } from "../DocumentCreateWizard";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const VisualEditorStep = ({ data, updateData }: Props) => {
  const [creating, setCreating] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);
  const { toast } = useToast();

  const createDraftDocument = async () => {
    setCreating(true);
    try {
      // Build pre-fill data from ALL fieldValues
      const preFillData: Record<string, string> = {};
      
      for (const [fieldId, value] of Object.entries(data.fieldValues)) {
        if (value && typeof value === "string" && value.trim()) {
          preFillData[fieldId] = value.trim();
        }
      }

      // Add guest info
      if (data.guestName) {
        preFillData.guest_name = data.guestName;
        preFillData.tenant_name = data.guestName;
      }
      if (data.guestEmail) {
        preFillData.guest_email = data.guestEmail;
        preFillData.tenant_email = data.guestEmail;
      }

      // Get guest fields for reference
      const guestFields = data.detectedFields
        .filter((f) => f.filled_by === "guest")
        .map((f) => ({
          api_id: f.api_id,
          label: f.label,
          type: f.type,
          category: f.category,
        }));

      console.log("Creating draft with preFillData:", preFillData);

      const { data: result, error } = await supabase.functions.invoke(
        "signwell-create-draft-document",
        {
          body: {
            templateId: data.templateId,
            documentName: data.documentName || data.templateName,
            recipientName: data.guestName,
            recipientEmail: data.guestEmail,
            propertyId: data.propertyId,
            bookingId: data.bookingId,
            preFillData,
            guestFields,
            detectedFields: data.detectedFields,
          },
        }
      );

      if (error) throw error;

      if (result.success) {
        updateData({
          signwellDocumentId: result.signwellDocumentId,
          embeddedEditUrl: result.embeddedEditUrl,
        });
        toast({
          title: "Draft Created",
          description: "Click 'Open Visual Editor' to place all fields on the document",
        });
      } else {
        throw new Error(result.error || "Failed to create draft document");
      }
    } catch (error: unknown) {
      console.error("Error creating draft:", error);
      const message = error instanceof Error ? error.message : "Failed to create draft document";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const openVisualEditor = () => {
    if (data.embeddedEditUrl) {
      window.open(data.embeddedEditUrl, "_blank");
      setEditorOpened(true);
    }
  };

  // Get signature fields grouped by signer
  const signatureFields = data.detectedFields.filter((f) => f.category === "signature");
  const guestSignatureFields = signatureFields.filter(f => f.filled_by === "guest");
  const hostSignatureFields = signatureFields.filter(f => f.filled_by === "admin");
  
  // Get non-signature guest fields
  const guestTextFields = data.detectedFields.filter(
    (f) => f.filled_by === "guest" && f.category !== "signature" && f.type !== "signature"
  );

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Visual Field Editor</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Create a draft document, then use SignWell's visual editor to place all fields including signatures.
        </p>
      </div>

      {/* Fields to Place Summary */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Fields to place in the visual editor:</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Guest Fields */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm text-blue-800 dark:text-blue-200">Guest (Signer 1)</span>
            </div>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              {guestSignatureFields.map((f) => (
                <li key={f.api_id} className="flex items-center gap-1">
                  {f.type === "signature" ? <PenTool className="h-3 w-3" /> : <span>•</span>}
                  {f.label}
                </li>
              ))}
              {guestTextFields.map((f) => (
                <li key={f.api_id}>• {f.label}</li>
              ))}
              {guestSignatureFields.length === 0 && guestTextFields.length === 0 && (
                <li className="text-muted-foreground">No guest fields detected</li>
              )}
            </ul>
          </div>

          {/* Host Fields */}
          <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm text-purple-800 dark:text-purple-200">Host (Signer 2)</span>
            </div>
            <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1">
              {hostSignatureFields.map((f) => (
                <li key={f.api_id} className="flex items-center gap-1">
                  {f.type === "signature" ? <PenTool className="h-3 w-3" /> : <span>•</span>}
                  {f.label}
                </li>
              ))}
              {hostSignatureFields.length === 0 && (
                <li className="text-muted-foreground">No host signature fields detected</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {!data.signwellDocumentId ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Edit className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Ready to Create Draft</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create a draft document in SignWell. You'll then use the visual editor to drag and drop 
              signature fields, text fields, and dates onto the exact locations in your document.
            </p>
          </div>
          <Button onClick={createDraftDocument} disabled={creating} size="lg">
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Draft...
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Create Draft Document
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-800 dark:text-green-200">
                Draft Document Created
              </h4>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your draft document is ready. Open the visual editor to place all fields on the document.
            </p>
          </div>

          <div className="text-center space-y-4">
            <Button onClick={openVisualEditor} size="lg" variant="default">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Visual Editor
            </Button>
            <p className="text-sm text-muted-foreground">
              The editor will open in a new tab.
            </p>
          </div>

          {editorOpened && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-3">
                Visual Editor Checklist
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    For Guest (Signer 1):
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                    <li>Add <Badge variant="outline" className="text-xs">Signature</Badge> field</li>
                    <li>Add <Badge variant="outline" className="text-xs">Text</Badge> for printed name</li>
                    <li>Add <Badge variant="outline" className="text-xs">Date</Badge> for signing date</li>
                    {guestTextFields.length > 0 && (
                      <li>Add text fields for: {guestTextFields.map(f => f.label).join(", ")}</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                    For Host (Signer 2):
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                    <li>Add <Badge variant="outline" className="text-xs">Signature</Badge> field</li>
                    <li>Add <Badge variant="outline" className="text-xs">Text</Badge> for printed name</li>
                    <li>Add <Badge variant="outline" className="text-xs">Date</Badge> for signing date</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-700">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>When done:</strong> Save in the editor, then return here and click "Next" to finalize.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisualEditorStep;
