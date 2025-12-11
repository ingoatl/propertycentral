import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Copy, CheckCircle, FileText, User, Building, Calendar, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WizardData } from "../DocumentCreateWizard";
import { format } from "date-fns";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onComplete: () => void;
}

const CreateAndSendStep = ({ data, updateData, onComplete }: Props) => {
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const createDocument = async () => {
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

      console.log("Creating document with preFillData:", preFillData);

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
          guestSigningUrl: result.guestSigningUrl,
          hostSigningUrl: result.hostSigningUrl,
        });
        toast({
          title: "Document Created & Sent!",
          description: "Signing links have been emailed to both parties",
        });
      } else {
        throw new Error(result.error || "Failed to create document");
      }
    } catch (error: unknown) {
      console.error("Error creating document:", error);
      const message = error instanceof Error ? error.message : "Failed to create document";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copyGuestLink = async () => {
    if (data.guestSigningUrl) {
      await navigator.clipboard.writeText(data.guestSigningUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Guest signing link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startNew = () => {
    onComplete();
    window.location.reload();
  };

  // Get values from fieldValues
  const propertyAddress = data.fieldValues.property_address as string || "";
  const leaseStartDate = data.fieldValues.lease_start_date as string || "";
  const leaseEndDate = data.fieldValues.lease_end_date as string || "";
  const monthlyRent = data.fieldValues.monthly_rent as string || "";
  const securityDeposit = data.fieldValues.security_deposit as string || "";

  // Get guest fields from detected fields
  const guestFields = data.detectedFields.filter((f) => f.filled_by === "guest");
  const guestFieldCategories = [...new Set(guestFields.map((f) => f.category))];

  const isDocumentCreated = !!data.signwellDocumentId && !!data.guestSigningUrl;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Create & Send Document</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Review your document details and create the document for signing
        </p>
      </div>

      {/* Summary */}
      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">{data.documentName || data.templateName}</h4>
            <p className="text-sm text-muted-foreground">Document Name</p>
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">{data.guestName}</h4>
            <p className="text-sm text-muted-foreground">{data.guestEmail}</p>
          </div>
        </div>

        {data.propertyName && (
          <>
            <Separator />
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">{data.propertyName}</h4>
                <p className="text-sm text-muted-foreground">{propertyAddress}</p>
              </div>
            </div>
          </>
        )}

        {leaseStartDate && leaseEndDate && (
          <>
            <Separator />
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">
                  {format(new Date(leaseStartDate), "MMM d, yyyy")} -{" "}
                  {format(new Date(leaseEndDate), "MMM d, yyyy")}
                </h4>
                <p className="text-sm text-muted-foreground">Lease Period</p>
              </div>
            </div>
          </>
        )}

        {monthlyRent && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Monthly Rent:</span>{" "}
                <strong>${monthlyRent}</strong>
              </div>
              {securityDeposit && (
                <div>
                  <span className="text-muted-foreground">Security Deposit:</span>{" "}
                  <strong>${securityDeposit}</strong>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Guest Fields */}
      {guestFields.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Guest Required Fields ({guestFields.length})</h4>
          <div className="flex flex-wrap gap-2">
            {guestFieldCategories.map((category) => (
              <Badge key={category} variant="outline" className="capitalize">
                {category.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Auto Signature Page Info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-sm text-blue-800 dark:text-blue-200">
            Automatic Signing Process
          </span>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          SignWell will add a signature page at the end of the document. Both guest and host will 
          receive email invitations with their signing links. No manual field placement required.
        </p>
      </div>

      <Separator />

      {/* Actions */}
      {!isDocumentCreated ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Creating the document will send signing invitations to both parties
          </p>
          <Button onClick={createDocument} disabled={creating} size="lg">
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating & Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Create & Send for Signing
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-green-800 dark:text-green-200">
                Document Sent for Signing!
              </h4>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              Signing invitations have been sent to both parties via email. You can also share the 
              guest signing link directly if needed.
            </p>

            <div className="space-y-3">
              <Label className="text-xs text-green-700 dark:text-green-300">Guest Signing Link:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded text-xs truncate">
                  {data.guestSigningUrl}
                </code>
                <Button size="sm" onClick={copyGuestLink}>
                  {copied ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" onClick={startNew}>
              Create Another Document
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateAndSendStep;
