import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { WizardData } from "../DocumentCreateWizard";
import { FileEdit, ExternalLink, Info, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const EditDocumentStep = ({ data, updateData }: Props) => {
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(data.embeddedEditUrl);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const createDraftForEditing = async () => {
    if (!data.templateId) {
      toast.error("Please select a template first");
      return;
    }

    setIsCreatingDraft(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("signwell-create-draft-document", {
        body: {
          templateId: data.templateId,
          recipientName: data.guestName || "Guest",
          recipientEmail: data.guestEmail || "guest@example.com",
          documentName: data.documentName || data.templateName || "Document",
          preFillData: {},
          propertyId: data.propertyId,
          bookingId: data.bookingId,
        },
      });

      if (error) throw error;

      if (response?.success && response?.embeddedEditUrl) {
        setEditorUrl(response.embeddedEditUrl);
        updateData({
          signwellDocumentId: response.signwellDocumentId,
          embeddedEditUrl: response.embeddedEditUrl,
        });
        toast.success("Draft created! Click 'Open Editor' to edit the document.");
      } else {
        throw new Error(response?.error || "Failed to create draft");
      }
    } catch (error) {
      console.error("Error creating draft:", error);
      toast.error("Failed to create draft document");
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const openEditor = () => {
    if (editorUrl) {
      window.open(editorUrl, "_blank", "width=1200,height=800");
      setIsEditorOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium flex items-center gap-2">
          <FileEdit className="h-5 w-5" />
          Edit Document Text
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Open the document editor to modify any text content before adding signature fields. Make your edits, then close the editor and continue.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> This step allows you to edit the raw document text (names, dates, terms, etc.) directly in SignWell's editor. After editing, you'll assign field responsibilities and place signature fields in later steps.
        </AlertDescription>
      </Alert>

      {/* Template Info */}
      <div className="p-4 bg-muted rounded-lg border">
        <p className="text-sm">
          <strong>Template:</strong> {data.templateName || "Not selected"}
        </p>
        {data.guestName && (
          <p className="text-sm mt-1">
            <strong>Guest:</strong> {data.guestName} ({data.guestEmail})
          </p>
        )}
      </div>

      {/* Create Draft / Open Editor */}
      <div className="space-y-4">
        {!editorUrl ? (
          <Button
            onClick={createDraftForEditing}
            disabled={isCreatingDraft || !data.templateId}
            className="w-full"
            size="lg"
          >
            {isCreatingDraft ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Draft...
              </>
            ) : (
              <>
                <FileEdit className="h-4 w-4 mr-2" />
                Create Draft for Editing
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <Check className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Draft created successfully!
              </span>
            </div>

            <Button
              onClick={openEditor}
              className="w-full"
              size="lg"
              variant={isEditorOpen ? "outline" : "default"}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isEditorOpen ? "Re-open Editor" : "Open Editor to Edit Document"}
            </Button>

            {isEditorOpen && (
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  After editing the document text, close the editor window and click <strong>Next</strong> to continue with field assignment and signature placement.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Skip Option */}
      {!editorUrl && (
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            If you don't need to edit the document text, you can skip this step and proceed directly to field assignment.
          </p>
        </div>
      )}
    </div>
  );
};

export default EditDocumentStep;
