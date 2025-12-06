import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Edit, ExternalLink, CheckCircle } from "lucide-react";
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
      // Build pre-fill data from ALL fieldValues (not just admin fields)
      // Include both admin-filled values and any pre-populated guest info
      const preFillData: Record<string, string> = {};
      
      // Add all field values from the wizard
      for (const [fieldId, value] of Object.entries(data.fieldValues)) {
        if (value && typeof value === "string" && value.trim()) {
          preFillData[fieldId] = value.trim();
        }
      }

      // Add guest info to pre-fill data with multiple aliases
      if (data.guestName) {
        preFillData.guest_name = data.guestName;
        preFillData.tenant_name = data.guestName;
      }
      if (data.guestEmail) {
        preFillData.guest_email = data.guestEmail;
        preFillData.tenant_email = data.guestEmail;
      }

      // Get guest fields that the tenant needs to fill during signing
      const guestFields = data.detectedFields
        .filter((f) => f.filled_by === "guest")
        .map((f) => ({
          api_id: f.api_id,
          label: f.label,
          type: f.type,
          category: f.category,
        }));

      console.log("Creating draft with preFillData:", preFillData);
      console.log("Guest fields for signing:", guestFields);

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
          description: "Click 'Open Visual Editor' to place signature fields",
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

  // Count fields by type
  const adminFieldCount = data.detectedFields.filter((f) => f.filled_by === "admin").length;
  const guestFieldCount = data.detectedFields.filter((f) => f.filled_by === "guest").length;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Visual Field Editor</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Create a draft document with your pre-filled data, then add signature fields in the visual editor.
        </p>
      </div>

      {/* Field Summary */}
      {data.detectedFields.length > 0 && (
        <div className="p-4 bg-muted rounded-lg border">
          <h4 className="font-medium mb-2">Fields to be included:</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• {adminFieldCount} pre-filled fields (admin values)</li>
            <li>• {guestFieldCount} fields for guest to complete</li>
          </ul>
        </div>
      )}

      {!data.signwellDocumentId ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Edit className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Ready to Create Draft</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create a draft document with your pre-filled data. You'll then be able to visually
              place signature fields and other form elements.
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
              Your draft document has been created. Open the visual editor to place signature
              fields, text fields, and checkboxes on the document.
            </p>
          </div>

          <div className="text-center space-y-4">
            <Button onClick={openVisualEditor} size="lg" variant="default">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Visual Editor
            </Button>
            <p className="text-sm text-muted-foreground">
              The editor will open in a new tab. Place your fields and save when done.
            </p>
          </div>

          {editorOpened && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                Editor Instructions
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Drag and drop signature fields onto the document</li>
                <li>Assign each field to either "Guest" or "Host"</li>
                <li>Add text fields for guest to fill (emergency contact, vehicle info)</li>
                <li>Add checkboxes for acknowledgments</li>
                <li>Click "Save" in the editor when finished</li>
                <li>Return here and click "Next" to review and finalize</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisualEditorStep;
