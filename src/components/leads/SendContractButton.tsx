import { useState } from "react";
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

type ContractType = "cohosting_agreement" | "management_agreement";

export function SendContractButton({ lead, onContractSent }: SendContractButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [contractType, setContractType] = useState<ContractType>("cohosting_agreement");
  const [recipientEmail, setRecipientEmail] = useState(lead.email || "");
  const [recipientName, setRecipientName] = useState(lead.name || "");

  const sendContract = useMutation({
    mutationFn: async () => {
      if (!recipientEmail || !recipientName) {
        throw new Error("Recipient name and email are required");
      }

      // 1. Find the appropriate template based on contract type
      const { data: templates, error: templateError } = await supabase
        .from("document_templates")
        .select("*")
        .eq("contract_type", contractType)
        .eq("is_active", true)
        .limit(1);

      if (templateError) throw templateError;
      if (!templates || templates.length === 0) {
        throw new Error(`No active template found for ${contractType}`);
      }

      const template = templates[0];

      // 2. Create or get the property owner
      let ownerId: string | null = lead.owner_id || null;

      if (!ownerId) {
        // Check if owner exists with this email
        const { data: existingOwner } = await supabase
          .from("property_owners")
          .select("id")
          .eq("email", recipientEmail)
          .maybeSingle();

        if (existingOwner) {
          ownerId = existingOwner.id;
        } else {
          // Create new owner
          const { data: newOwner, error: ownerError } = await supabase
            .from("property_owners")
            .insert({
              name: recipientName,
              email: recipientEmail,
              phone: lead.phone,
              payment_method: "ach",
              service_type: contractType === "management_agreement" ? "full_service" : "cohosting",
            })
            .select()
            .single();

          if (ownerError) throw ownerError;
          ownerId = newOwner.id;

          // Link owner to lead
          await supabase
            .from("leads")
            .update({ owner_id: ownerId })
            .eq("id", lead.id);
        }
      }

      // 3. Create the booking document record
      const { data: bookingDoc, error: docError } = await supabase
        .from("booking_documents")
        .insert({
          template_id: template.id,
          owner_id: ownerId,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          document_name: `${template.name} - ${recipientName}`,
          document_type: "contract",
          contract_type: contractType,
          status: "draft",
          is_draft: true,
        })
        .select()
        .single();

      if (docError) throw docError;

      // 4. Create SignWell document
      const { data: signwellResult, error: signwellError } = await supabase.functions.invoke(
        "signwell-create-document",
        {
          body: {
            bookingId: null,
            templateId: template.id,
            guestName: recipientName,
            guestEmail: recipientEmail,
            hostName: "PeachHaus Group",
            hostEmail: "anja@peachhausgroup.com",
            fieldValues: [],
            documentId: bookingDoc.id,
          },
        }
      );

      if (signwellError) throw signwellError;

      // 5. Update lead with SignWell document ID and advance stage
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from("leads")
        .update({
          signwell_document_id: signwellResult.signwellDocumentId,
          stage: "contract_out",
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      // 6. Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `Contract sent: ${contractType === "management_agreement" ? "Full-Service Management" : "Co-Hosting"} agreement`,
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        previous_stage: lead.stage,
        new_stage: "contract_out",
        metadata: {
          contract_type: contractType,
          signwell_document_id: signwellResult.signwellDocumentId,
          document_id: bookingDoc.id,
        },
      });

      // 7. Send notification email to lead about the contract
      await supabase.functions.invoke("send-lead-notification", {
        body: {
          leadId: lead.id,
          type: "email",
          subject: "Your Property Management Agreement from PeachHaus",
          message: `Hi ${recipientName.split(" ")[0]},

Thank you for choosing PeachHaus to help manage your property! We're excited to partner with you.

We've prepared your ${contractType === "management_agreement" ? "Full-Service Property Management" : "Co-Hosting"} agreement. Please review and sign the document at your earliest convenience.

You'll receive a separate email from SignWell with the signing link.

If you have any questions about the agreement, please don't hesitate to reach out. We're here to help!

Looking forward to working together.`,
        },
      });

      return signwellResult;
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

  // Only show button for appropriate stages
  const showButton = ["call_attended", "send_contract"].includes(lead.stage);

  if (!showButton) {
    return null;
  }

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
              Select the contract type and confirm recipient details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contract Type</Label>
              <Select
                value={contractType}
                onValueChange={(v) => setContractType(v as ContractType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cohosting_agreement">
                    Co-Hosting Agreement
                  </SelectItem>
                  <SelectItem value="management_agreement">
                    Full-Service Management Agreement
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {contractType === "management_agreement"
                  ? "Full-service: We handle everything, owner receives payouts"
                  : "Co-hosting: Owner manages bookings, we assist with operations"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Full legal name"
              />
            </div>

            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            {lead.property_address && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Property</p>
                <p className="text-sm text-muted-foreground">{lead.property_address}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendContract.mutate()}
              disabled={sendContract.isPending || !recipientEmail || !recipientName}
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
