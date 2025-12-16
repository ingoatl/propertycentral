import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OFFBOARDING_REASONS = [
  { value: "owner_terminated", label: "Owner Terminated Contract" },
  { value: "property_sold", label: "Property Sold" },
  { value: "poor_performance", label: "Poor Performance" },
  { value: "owner_self_managing", label: "Owner Self-Managing" },
  { value: "market_conditions", label: "Market Conditions" },
  { value: "other", label: "Other" },
] as const;

interface OffboardPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: {
    id: string;
    name: string;
    address: string;
  } | null;
  onSuccess: () => void;
}

export function OffboardPropertyDialog({ open, onOpenChange, property, onSuccess }: OffboardPropertyDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOffboard = async () => {
    if (!property || !reason || !confirmed) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const offboardedBy = user?.email || "Unknown";

      // Update property status to Inactive and set offboarding fields
      const { error: updateError } = await supabase
        .from("properties")
        .update({
          property_type: "Inactive",
          offboarded_at: new Date().toISOString(),
          offboarding_reason: OFFBOARDING_REASONS.find(r => r.value === reason)?.label || reason,
          offboarding_notes: notes || null,
        })
        .eq("id", property.id);

      if (updateError) throw updateError;

      // Send notification email to Alex
      const { error: emailError } = await supabase.functions.invoke("send-offboarding-notification", {
        body: {
          propertyId: property.id,
          propertyName: property.name,
          propertyAddress: property.address,
          reason: OFFBOARDING_REASONS.find(r => r.value === reason)?.label || reason,
          notes,
          offboardedBy,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        toast.warning("Property offboarded but email notification failed");
      } else {
        toast.success("Property offboarded and Alex has been notified");
      }

      // Reset form and close
      setReason("");
      setNotes("");
      setConfirmed(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Offboarding error:", error);
      toast.error(error.message || "Failed to offboard property");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setNotes("");
    setConfirmed(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Offboard Property
          </DialogTitle>
          <DialogDescription>
            This will mark the property as inactive and notify Alex to disconnect it from all listing platforms.
          </DialogDescription>
        </DialogHeader>

        {property && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="font-semibold text-foreground">{property.name}</p>
              <p className="text-sm text-muted-foreground">{property.address}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Offboarding *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {OFFBOARDING_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional instructions or context for Alex..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                <strong>This action will:</strong>
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>Mark the property as "Inactive"</li>
                <li>Send an email to Alex with disconnection checklist</li>
                <li>Create an offboarding task in Property Central</li>
                <li>Move the property to the "Offboarded" section</li>
              </ul>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <Label htmlFor="confirm" className="text-sm cursor-pointer leading-relaxed">
                I confirm that I want to offboard this property and notify Alex to disconnect it from all platforms.
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleOffboard}
            disabled={!reason || !confirmed || loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Offboarding...
              </>
            ) : (
              "Offboard Property"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
