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

interface SendContractButtonProps {
  lead: Lead;
  onContractSent?: () => void;
}

interface DocumentTemplate {
  id: string;
  name: string;
  contract_type: string | null;
  is_active: boolean;
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
      .select("id, name, contract_type, is_active")
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

      // NOTE: Owner record will be created ONLY when agreement is fully executed
      // (in the submit-signature edge function after all parties sign)

      // Create the booking document record (no owner_id yet)
      const { data: bookingDoc, error: docError } = await supabase
        .from("booking_documents")
        .insert({
          template_id: template.id,
          owner_id: null, // Owner will be created upon full agreement execution
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          document_name: `${template.name} - ${recipientName}`,
          document_type: "contract",
          contract_type: template.contract_type,
          status: "draft",
          is_draft: true,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Create signing session using our custom signing solution
      const { data: signingResult, error: signingError } = await supabase.functions.invoke(
        "create-signing-session",
        {
          body: {
            documentId: bookingDoc.id,
            templateId: template.id,
            ownerName: recipientName,
            ownerEmail: recipientEmail,
            leadId: lead.id,
          },
        }
      );

      if (signingError) throw signingError;

      // Update lead and advance stage
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("leads")
        .update({
          stage: "contract_out",
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `Contract sent: ${template.name}`,
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        previous_stage: lead.stage,
        new_stage: "contract_out",
        metadata: {
          contract_type: template.contract_type,
          template_name: template.name,
          document_id: bookingDoc.id,
          signing_url: signingResult.signingUrl,
        },
      });

      return signingResult;
    },
    onSuccess: () => {
      toast.success("Contract sent successfully!");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", lead.id] });
      onContractSent?.();
    },
    onError: (error) => {
      toast.error(`Failed to send contract: ${error.message}`);
    },
  });

  // Show button for most stages except completed ones
  const hideForStages = ["contract_signed", "ops_handoff", "lost"];
  const showButton = !hideForStages.includes(lead.stage);

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
        className="bg-primary/10 text-primary hover:bg-primary/20"
      >
        <FileSignature className="h-4 w-4 mr-2" />
        Send Contract
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Contract to {lead.name}</DialogTitle>
            <DialogDescription>
              Select the contract template and confirm recipient details. The owner will fill in their address, property details, and select their package during signing.
            </DialogDescription>
          </DialogHeader>

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
              <p className="font-medium text-foreground mb-1">Owner will fill during signing:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Their mailing address</li>
                <li>Property address</li>
                <li>Service package selection</li>
                <li>Signature</li>
              </ul>
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
