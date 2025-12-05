import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Copy, CheckCircle, FileText, User, Building, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WizardData } from "../DocumentCreateWizard";
import { format } from "date-fns";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onComplete: () => void;
}

const ReviewCreateStep = ({ data, updateData, onComplete }: Props) => {
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const finalizeDocument = async () => {
    setFinalizing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke(
        "signwell-finalize-document",
        {
          body: {
            signwellDocumentId: data.signwellDocumentId,
          },
        }
      );

      if (error) throw error;

      if (result.success) {
        updateData({
          guestSigningUrl: result.guestSigningUrl,
          hostSigningUrl: result.hostSigningUrl,
        });
        setFinalized(true);
        toast({
          title: "Document Finalized",
          description: "Signing links are now available",
        });
      } else {
        throw new Error(result.error || "Failed to finalize document");
      }
    } catch (error: any) {
      console.error("Error finalizing:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to finalize document",
        variant: "destructive",
      });
    } finally {
      setFinalizing(false);
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

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Review & Create Document</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Review your document details and finalize to get signing links
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
                <p className="text-sm text-muted-foreground">{data.preFillData.propertyAddress}</p>
              </div>
            </div>
          </>
        )}

        {data.preFillData.leaseStartDate && data.preFillData.leaseEndDate && (
          <>
            <Separator />
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">
                  {format(new Date(data.preFillData.leaseStartDate), "MMM d, yyyy")} -{" "}
                  {format(new Date(data.preFillData.leaseEndDate), "MMM d, yyyy")}
                </h4>
                <p className="text-sm text-muted-foreground">Lease Period</p>
              </div>
            </div>
          </>
        )}

        {data.preFillData.monthlyRent && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Monthly Rent:</span>{" "}
                <strong>${data.preFillData.monthlyRent}</strong>
              </div>
              {data.preFillData.securityDeposit && (
                <div>
                  <span className="text-muted-foreground">Security Deposit:</span>{" "}
                  <strong>${data.preFillData.securityDeposit}</strong>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Guest Fields */}
      <div className="space-y-2">
        <h4 className="font-medium">Guest Required Fields</h4>
        <div className="flex flex-wrap gap-2">
          {data.guestFields.requireEmergencyContact && (
            <Badge variant="outline">Emergency Contact</Badge>
          )}
          {data.guestFields.requireVehicleInfo && <Badge variant="outline">Vehicle Info</Badge>}
          {data.guestFields.requireAcknowledgment && (
            <Badge variant="outline">Acknowledgments</Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Actions */}
      {!finalized ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Finalizing will lock the document and generate signing links
          </p>
          <Button onClick={finalizeDocument} disabled={finalizing} size="lg">
            {finalizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Finalize & Get Signing Links
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
                Document Ready for Signing!
              </h4>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              Share the guest signing link below. Once the guest signs, you'll be notified to sign
              as host.
            </p>

            <div className="space-y-3">
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

export default ReviewCreateStep;
