import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Copy, CheckCircle, FileText, User, Building, Calendar, Mail, Eye, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WizardData } from "../DocumentCreateWizard";
import { format } from "date-fns";
import { getFieldLabelInfo } from "@/utils/fieldLabelMapping";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onComplete: () => void;
}

const CreateAndSendStep = ({ data, updateData, onComplete }: Props) => {
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const { toast } = useToast();

  // Load template PDF URL for preview
  useEffect(() => {
    const loadPdf = async () => {
      if (!data.templateId) return;
      
      try {
        const { data: template } = await supabase
          .from("document_templates")
          .select("file_path")
          .eq("id", data.templateId)
          .single();
        
        if (template?.file_path) {
          setPdfUrl(template.file_path);
        }
      } catch (error) {
        console.error("Failed to load PDF:", error);
      }
    };
    loadPdf();
  }, [data.templateId]);

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

      console.log("Creating document with preFillData:", preFillData);

      // Use our native signing solution
      const { data: result, error } = await supabase.functions.invoke(
        "create-document-for-signing",
        {
          body: {
            templateId: data.templateId,
            documentName: data.documentName || data.templateName,
            recipientName: data.guestName,
            recipientEmail: data.guestEmail,
            propertyId: data.propertyId,
            bookingId: data.bookingId,
            preFillData,
            detectedFields: data.detectedFields,
          },
        }
      );

      if (error) throw error;

      if (result.success) {
        updateData({
          guestSigningUrl: result.guestSigningUrl,
          hostSigningUrl: result.hostSigningUrl,
        });
        toast({
          title: "Document Created & Sent!",
          description: "Signing invitation has been emailed to the guest",
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Get values from fieldValues
  const propertyAddress = data.fieldValues.property_address as string || "";
  const leaseStartDate = data.fieldValues.lease_start_date as string || "";
  const leaseEndDate = data.fieldValues.lease_end_date as string || "";
  const monthlyRent = data.fieldValues.monthly_rent as string || "";
  const securityDeposit = data.fieldValues.security_deposit as string || "";

  // Get filled admin fields for display
  const filledFields = Object.entries(data.fieldValues)
    .filter(([_, value]) => value && typeof value === "string" && value.toString().trim() !== "")
    .map(([key, value]) => {
      const field = data.detectedFields.find(f => f.api_id === key);
      const labelInfo = getFieldLabelInfo(key, field?.label || key);
      return {
        key,
        label: labelInfo.label,
        value: value as string,
      };
    });

  // Get guest fields from detected fields
  const guestFields = data.detectedFields.filter((f) => f.filled_by === "guest");
  const guestFieldCategories = [...new Set(guestFields.map((f) => f.category))];

  const isDocumentCreated = !!data.guestSigningUrl;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Create & Send Document</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Review your document with pre-filled values and send for signing
        </p>
      </div>

      {/* Document Preview Toggle */}
      <div className="flex gap-2">
        <Button 
          variant={showPreview ? "default" : "outline"} 
          size="sm" 
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? "Hide Preview" : "Preview Document"}
        </Button>
      </div>

      {/* PDF Preview */}
      {showPreview && pdfUrl && (
        <div className="border rounded-lg overflow-hidden bg-muted/20">
          <div className="bg-muted p-2 flex items-center justify-between">
            <span className="text-sm font-medium">Document Preview</span>
            <span className="text-xs text-muted-foreground">
              {numPages} {numPages === 1 ? "page" : "pages"}
            </span>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="p-4 flex flex-col items-center gap-4">
              <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
                {Array.from(new Array(numPages), (_, index) => (
                  <Page 
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={500}
                    className="shadow-lg mb-4"
                  />
                ))}
              </Document>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Pre-filled Values Summary */}
      {filledFields.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Pre-filled Document Values ({filledFields.length})</h4>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filledFields.slice(0, 12).map((field) => (
                <div key={field.key} className="text-sm">
                  <span className="text-muted-foreground">{field.label}:</span>{" "}
                  <span className="font-medium">{field.value}</span>
                </div>
              ))}
              {filledFields.length > 12 && (
                <div className="text-sm text-muted-foreground italic">
                  +{filledFields.length - 12} more fields...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          <p className="text-xs text-muted-foreground">
            These fields will be completed by the guest when they sign the document
          </p>
          <div className="flex flex-wrap gap-2">
            {guestFieldCategories.map((category) => (
              <Badge key={category} variant="outline" className="capitalize">
                {category.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Signing Process Info */}
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <strong>How signing works:</strong> The guest will receive an email with a secure link to 
          review and sign the document. Once they sign, you'll be notified to counter-sign.
        </AlertDescription>
      </Alert>

      <Separator />

      {/* Actions */}
      {!isDocumentCreated ? (
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Ready to send? The guest will receive a signing invitation via email.
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
              A signing invitation has been sent to <strong>{data.guestEmail}</strong>. 
              You can also share the signing link directly if needed.
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
