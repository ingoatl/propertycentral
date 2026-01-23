import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink, Loader2 } from "lucide-react";

interface ScheduleOwnerCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerEmail: string;
  ownerName: string;
}

export function ScheduleOwnerCallModal({
  open,
  onOpenChange,
  ownerEmail,
  ownerName,
}: ScheduleOwnerCallModalProps) {
  const [loading, setLoading] = useState(false);

  const generateBookingLink = () => {
    const params = new URLSearchParams();
    params.set("name", ownerName);
    params.set("email", ownerEmail);
    return `https://propertycentral.lovable.app/book-owner-call?${params.toString()}`;
  };

  const handleOpenScheduler = () => {
    setLoading(true);
    window.open(generateBookingLink(), "_blank");
    setTimeout(() => {
      setLoading(false);
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule a Call
          </DialogTitle>
          <DialogDescription>
            Book a call with your property manager to discuss your property, 
            review statements, or address any concerns.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Available Topics:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Monthly statement review</li>
              <li>• Maintenance updates</li>
              <li>• Pricing strategy</li>
              <li>• Guest concerns</li>
              <li>• Property updates</li>
              <li>• General check-in</li>
            </ul>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>Call times available Monday - Friday, 11am - 5pm EST</p>
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleOpenScheduler} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Open Scheduler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
