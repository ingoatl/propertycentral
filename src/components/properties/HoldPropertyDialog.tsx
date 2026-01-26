import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PauseCircle, Loader2, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HOLD_REASONS = [
  { value: "awaiting_owner_response", label: "Awaiting Owner Response" },
  { value: "contract_negotiation", label: "Contract Negotiation" },
  { value: "seasonal_pause", label: "Seasonal Pause" },
  { value: "pending_repairs", label: "Pending Repairs" },
  { value: "owner_traveling", label: "Owner Traveling" },
  { value: "other", label: "Other" },
] as const;

interface HoldPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: {
    id: string;
    name: string;
    address: string;
    propertyType?: string;
  } | null;
  onSuccess: () => void;
  mode?: "hold" | "reactivate";
}

export function HoldPropertyDialog({ 
  open, 
  onOpenChange, 
  property, 
  onSuccess,
  mode = "hold" 
}: HoldPropertyDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [reactivateType, setReactivateType] = useState<"Client-Managed" | "Company-Owned">("Client-Managed");

  const handleHold = async () => {
    if (!property || !reason) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update({
          property_type: "On-Hold",
          on_hold_at: new Date().toISOString(),
          on_hold_reason: HOLD_REASONS.find(r => r.value === reason)?.label || reason + (notes ? `: ${notes}` : ""),
        })
        .eq("id", property.id);

      if (error) throw error;

      toast.success(`"${property.name}" is now on hold`);
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error("Hold error:", error);
      toast.error(error.message || "Failed to place property on hold");
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!property) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update({
          property_type: reactivateType,
          on_hold_at: null,
          on_hold_reason: null,
        })
        .eq("id", property.id);

      if (error) throw error;

      toast.success(`"${property.name}" has been reactivated`);
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error("Reactivate error:", error);
      toast.error(error.message || "Failed to reactivate property");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setNotes("");
    setReactivateType("Client-Managed");
    onOpenChange(false);
  };

  if (mode === "reactivate") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <PlayCircle className="w-5 h-5" />
              Reactivate Property
            </DialogTitle>
            <DialogDescription>
              This will resume all syncs and onboarding tasks for this property.
            </DialogDescription>
          </DialogHeader>

          {property && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg border">
                <p className="font-semibold text-foreground">{property.name}</p>
                <p className="text-sm text-muted-foreground">{property.address}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reactivate-type">Property Type</Label>
                <Select value={reactivateType} onValueChange={(v: "Client-Managed" | "Company-Owned") => setReactivateType(v)}>
                  <SelectTrigger id="reactivate-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Client-Managed">Client-Managed</SelectItem>
                    <SelectItem value="Company-Owned">Company-Owned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>This will:</strong>
                </p>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 list-disc list-inside mt-2">
                  <li>Resume syncing to Communications Hub</li>
                  <li>Include property in onboarding tasks</li>
                  <li>Re-enable all automations</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleReactivate}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reactivating...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Reactivate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <PauseCircle className="w-5 h-5" />
            Put Property On Hold
          </DialogTitle>
          <DialogDescription>
            This will pause all syncs and exclude this property from onboarding tasks.
          </DialogDescription>
        </DialogHeader>

        {property && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="font-semibold text-foreground">{property.name}</p>
              <p className="text-sm text-muted-foreground">{property.address}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Hold *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {HOLD_REASONS.map((r) => (
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
                placeholder="Optional notes about this hold..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>While on hold:</strong>
              </p>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside mt-2">
                <li>Property won't sync to Communications Hub</li>
                <li>Onboarding tasks will be paused</li>
                <li>Property appears in "On Hold" section</li>
                <li>You can reactivate at any time</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleHold}
            disabled={!reason || loading}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Placing on Hold...
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 mr-2" />
                Put On Hold
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
