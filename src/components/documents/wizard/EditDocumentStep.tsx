import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Edit, ExternalLink, CheckCircle, FileEdit } from "lucide-react";
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

  const createDraftAndEdit = async () => {
    setCreating(true);
    try {
      // Create draft with minimal pre-fill data (just guest info)
      const preFillData: Record<string, string> = {};
      
      if (data.guestName) {
        preFillData.guest_name = data.guestName;
        preFillData.tenant_name = data.guestName;
      }
      if (data.guestEmail) {
        preFillData.guest_email = data.guestEmail;
        preFillData.tenant_email = data.guestEmail;
      }

      console.log("Creating draft for editing:", preFillData);

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
          description: "Click 'Edit Document Content' to modify the document text",
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
          Create a draft document and edit the raw text before assigning fields to signers.
        </p>
      </div>

      {!data.signwellDocumentId ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <FileEdit className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Create Draft Document</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              First, create a draft document in SignWell. You can then edit the document content
              directly before proceeding to assign fields and place signatures.
            </p>
          </div>
          <Button onClick={createDraftAndEdit} disabled={creating} size="lg">
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
              Your draft is ready. You can now edit the document content if needed.
            </p>
          </div>

          <div className="text-center space-y-4">
            <Button onClick={openEditor} size="lg" variant="default">
              <ExternalLink className="h-4 w-4 mr-2" />
              Edit Document Content
            </Button>
            <p className="text-sm text-muted-foreground">
              Opens in a new tab. Edit the text, then save and return here.
            </p>
          </div>

          {editorOpened && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                Editor Instructions
              </h4>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>Edit the document text as needed</li>
                <li>Add or modify any content</li>
                <li>Save your changes in the editor</li>
                <li>Return here and click "Next" to continue</li>
              </ul>
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                <strong>Note:</strong> In the next steps, you'll assign which fields go to the guest 
                vs. host, then place signature and text fields on the document.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditDocumentStep;
