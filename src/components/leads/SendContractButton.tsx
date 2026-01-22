import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileSignature, Loader2 } from "lucide-react";
import { Lead } from "@/types/leads";
import { LEASE_SAMPLE_VALUES } from "@/utils/leaseDefaults";

interface SendContractButtonProps {
  lead: Lead;
  onContractSent?: () => void;
}

interface DocumentTemplate {
  id: string;
  name: string;
  contract_type: string | null;
  is_active: boolean;
  field_mappings: any;
}

interface DetectedField {
  api_id: string;
  label: string;
  type: string;
  category: string;
  filled_by: string;
}

export function SendContractButton({ lead, onContractSent }: SendContractButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState(lead.email || "");
  const [recipientName, setRecipientName] = useState(lead.name || "");

  // Load available templates when dialog opens
  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("document_templates")
      .select("id, name, contract_type, is_active, field_mappings")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error loading templates:", error);
      return;
    }

    setTemplates(data || []);
    
    // Auto-select first template if only one exists
    if (data && data.length === 1) {
      setSelectedTemplateId(data[0].id);
    }
  };

  // Build pre-fill data from sample values and detected fields
  const buildPreFillData = (template: DocumentTemplate): Record<string, string> => {
    const preFillData: Record<string, string> = { ...LEASE_SAMPLE_VALUES };
    
    // Add recipient info
    preFillData.guest_name = recipientName;
    preFillData.tenant_name = recipientName;
    preFillData.guest_email = recipientEmail;
    preFillData.tenant_email = recipientEmail;
    
    return preFillData;
  };

  // Build detected fields array from template's field_mappings
  const buildDetectedFields = (template: DocumentTemplate): DetectedField[] => {
    const fieldMappings = template.field_mappings;
    if (!fieldMappings) return [];

    // If field_mappings has a detectedFields array, use it
    if (fieldMappings.detectedFields && Array.isArray(fieldMappings.detectedFields)) {
      return fieldMappings.detectedFields;
    }

    // Otherwise build from mapping keys
    const fields: DetectedField[] = [];
    const sampleKeys = Object.keys(LEASE_SAMPLE_VALUES);
    
    sampleKeys.forEach((key) => {
      fields.push({
        api_id: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type: 'text',
        category: getCategoryForField(key),
        filled_by: 'admin',
      });
    });

    // Add guest/signature fields
    fields.push(
      { api_id: 'guest_name', label: 'Guest Name', type: 'text', category: 'identification', filled_by: 'guest' },
      { api_id: 'guest_email', label: 'Guest Email', type: 'text', category: 'contact', filled_by: 'guest' },
      { api_id: 'guest_signature', label: 'Guest Signature', type: 'signature', category: 'signature', filled_by: 'guest' },
      { api_id: 'host_signature', label: 'Host Signature', type: 'signature', category: 'signature', filled_by: 'admin' }
    );

    return fields;
  };

  const getCategoryForField = (fieldId: string): string => {
    if (fieldId.includes('landlord') || fieldId.includes('tenant') || fieldId.includes('name')) return 'identification';
    if (fieldId.includes('property') || fieldId.includes('address') || fieldId.includes('county')) return 'property';
    if (fieldId.includes('date') || fieldId.includes('lease_start') || fieldId.includes('lease_end')) return 'dates';
    if (fieldId.includes('rent') || fieldId.includes('fee') || fieldId.includes('deposit') || fieldId.includes('payment')) return 'financial';
    if (fieldId.includes('utilities') || fieldId.includes('furnish')) return 'property';
    return 'other';
  };

  const sendContract = useMutation({
    mutationFn: async () => {
      if (!recipientEmail || !recipientName) {
        throw new Error("Recipient name and email are required");
      }

      if (!selectedTemplateId) {
        throw new Error("Please select a contract template");
      }

      // Find the selected template
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) {
        throw new Error("Selected template not found");
      }

      // Build pre-fill data with sample values
      const preFillData = buildPreFillData(template);
      const detectedFields = buildDetectedFields(template);

      console.log("Sending contract with pre-fill data:", Object.keys(preFillData));
      console.log("Detected fields count:", detectedFields.length);

      // Use create-document-for-signing edge function (same as DocumentCreateWizard)
      const { data: signingResult, error: signingError } = await supabase.functions.invoke(
        "create-document-for-signing",
        {
          body: {
            templateId: template.id,
            documentName: `${template.name} - ${recipientName}`,
            recipientName,
            recipientEmail,
            propertyId: null,
            bookingId: null,
            preFillData,
            detectedFields,
            leadId: lead.id,
          },
        }
      );

      if (signingError) throw signingError;
      if (!signingResult?.success) {
        throw new Error(signingResult?.error || "Failed to create signing session");
      }

      // Update lead and advance/reset stage to contract_out
      const { data: { user } } = await supabase.auth.getUser();
      const previousStage = lead.stage;
      const isReplacementContract = ["contract_signed", "ops_handoff", "photos_walkthrough"].includes(previousStage);
      
      await supabase
        .from("leads")
        .update({
          stage: "contract_out",
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      // Add timeline entry with replacement info if applicable
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: isReplacementContract 
          ? `New contract sent (agreement change): ${template.name}` 
          : `Contract sent: ${template.name}`,
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        previous_stage: previousStage as any,
        new_stage: "contract_out" as any,
        metadata: {
          contract_type: template.contract_type,
          template_name: template.name,
          document_id: signingResult.documentId,
          signing_url: signingResult.guestSigningUrl,
          pre_filled_fields: Object.keys(preFillData).length,
          is_replacement: isReplacementContract,
          previous_stage: previousStage,
        },
      });

      return signingResult;
    },
    onSuccess: () => {
      toast.success("Contract sent successfully with pre-filled data!");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", lead.id] });
      onContractSent?.();
    },
    onError: (error) => {
      toast.error(`Failed to send contract: ${error.message}`);
    },
  });

  // Only hide for terminal lost stage - allow new contracts at any other stage
  const hideForStages = ["lost"];
  const showButton = !hideForStages.includes(lead.stage);
  
  // Late stages show "Send New Contract" to indicate this is a replacement/change
  const isLateStage = ["contract_signed", "ops_handoff", "photos_walkthrough"].includes(lead.stage);

  if (!showButton) {
    return null;
  }

  const getContractTypeLabel = (type: string | null) => {
    switch (type) {
      case "co_hosting":
        return "Co-Hosting";
      case "full_service":
        return "Full-Service";
      case "rental_agreement":
        return "Rental Agreement";
      default:
        return type || "Other";
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={isLateStage 
          ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30" 
          : "bg-primary/10 text-primary hover:bg-primary/20"}
      >
        <FileSignature className="h-4 w-4 mr-2" />
        {isLateStage ? "Send New Contract" : "Send Contract"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isLateStage ? "Send New Contract" : "Send Contract"} to {lead.name}
            </DialogTitle>
            <DialogDescription>
              {isLateStage 
                ? "This lead has previously signed a contract. The new contract will be tracked separately and the lead will return to 'Contract Out' stage."
                : "Select the contract template and confirm recipient details. Standard lease terms will be pre-filled automatically."}
            </DialogDescription>
          </DialogHeader>
          
          {isLateStage && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">⚠️ Agreement Change</p>
              <p className="text-amber-600 dark:text-amber-300">
                This will send a new contract for signing. The previous agreement will remain in the timeline history.
              </p>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contract Template *</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contract template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.contract_type && (
                        <span className="text-muted-foreground ml-2">
                          ({getContractTypeLabel(template.contract_type)})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active templates found. Please upload templates first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Recipient Name *</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Full legal name"
              />
            </div>

            <div className="space-y-2">
              <Label>Recipient Email *</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Pre-filled automatically:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Landlord: PeachHaus Group LLC</li>
                <li>Financial terms (rent, fees, deposits)</li>
                <li>Lease dates and terms</li>
                <li>Property policies</li>
              </ul>
              <p className="mt-2 text-xs">Owner will complete their signature during signing.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendContract.mutate()}
              disabled={sendContract.isPending || !recipientEmail || !recipientName || !selectedTemplateId}
            >
              {sendContract.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Send Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
