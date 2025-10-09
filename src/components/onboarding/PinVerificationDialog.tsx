import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export const PinVerificationDialog = ({
  open,
  onOpenChange,
  onVerified,
}: PinVerificationDialogProps) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleVerify = () => {
    if (pin === "4201") {
      onVerified();
      onOpenChange(false);
      setPin("");
      setError(false);
    } else {
      setError(true);
      toast.error("Incorrect PIN");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter PIN</DialogTitle>
          <DialogDescription>
            Enter the PIN code to manage this task
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleVerify();
            }}
            className={error ? "border-red-500" : ""}
            maxLength={4}
          />
          <Button onClick={handleVerify} className="w-full">
            Verify
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
