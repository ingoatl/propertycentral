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

const EditDocumentStep = ({ data, updateData }: Props) => {
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

      console.log("Creating draft for editing with preFillData:", preFillData);

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
            guestFields: [],
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
          description: "You can now edit the document content in SignWell's editor",
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

  const openEditor = () => {
    if (data.embeddedEditUrl) {
      window.open(data.embeddedEditUrl, "_blank");
      setEditorOpened(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Edit Document Content</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Create a draft and edit the document text before assigning fields. You can modify any content in the visual editor.
        </p>
      </div>

      {!data.signwellDocumentId ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Edit className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Create Draft to Edit</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create a draft document in SignWell. You'll be able to edit the text content, add or remove sections, 
              and make any changes before proceeding to field assignment.
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
              Your draft is ready. Open the editor to review and modify the document content.
            </p>
          </div>

          <div className="text-center space-y-4">
            <Button onClick={openEditor} size="lg" variant="default">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Document Editor
            </Button>
            <p className="text-sm text-muted-foreground">
              The editor will open in a new tab. Edit the text content as needed.
            </p>
          </div>

          {editorOpened && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                What you can do in the editor:
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Edit any text in the document</li>
                <li>Add or remove paragraphs</li>
                <li>Correct typos or update terms</li>
                <li>Review the pre-filled values</li>
              </ul>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-3">
                <strong>When done:</strong> Save your changes in the editor, then return here and click "Next" to proceed with field assignment.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditDocumentStep;
