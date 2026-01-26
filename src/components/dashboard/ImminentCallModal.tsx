import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Video, MapPin, Clock, User, X, ExternalLink } from "lucide-react";
import { CallAlert } from "@/hooks/useCallReminders";

interface ImminentCallModalProps {
  call: CallAlert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: (alertId: string | undefined) => void;
}

export function ImminentCallModal({ call, open, onOpenChange, onDismiss }: ImminentCallModalProps) {
  const [countdown, setCountdown] = useState("");
  const [isPastDue, setIsPastDue] = useState(false);

  useEffect(() => {
    if (!call) return;

    const updateCountdown = () => {
      const diff = new Date(call.scheduled_at).getTime() - Date.now();
      
      if (diff <= 0) {
        setCountdown("NOW");
        setIsPastDue(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
        setIsPastDue(false);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [call]);

  if (!call) return null;

  const callTypeLabel = call.call_type === "discovery" 
    ? "Discovery Call" 
    : call.call_type === "owner" 
      ? "Owner Call" 
      : "Appointment";

  const handleJoin = () => {
    if (call.meeting_link) {
      window.open(call.meeting_link, "_blank");
    } else if (call.phone_number) {
      window.open(`tel:${call.phone_number}`, "_blank");
    }
    onOpenChange(false);
  };

  const handleDismiss = () => {
    onDismiss(call.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        {/* Premium gradient card */}
        <div className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/80 rounded-2xl overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
          
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <div className="relative p-8">
            {/* Pulsing icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className={`absolute inset-0 rounded-full bg-white/30 ${isPastDue ? "animate-ping" : "animate-pulse"}`} 
                     style={{ animationDuration: isPastDue ? "1s" : "2s" }} />
                <div className="relative rounded-full h-20 w-20 bg-white flex items-center justify-center shadow-lg">
                  {call.meeting_link ? (
                    <Video className="h-10 w-10 text-primary" />
                  ) : (
                    <Phone className="h-10 w-10 text-primary" />
                  )}
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="text-center mb-6">
              <p className="text-white/70 text-sm uppercase tracking-widest font-medium mb-2">
                {isPastDue ? "Call Starting" : "Starting In"}
              </p>
              <p className={`text-5xl font-bold text-white tabular-nums tracking-tight ${isPastDue ? "animate-pulse" : ""}`}>
                {countdown}
              </p>
            </div>

            {/* Call type badge */}
            <div className="flex justify-center mb-4">
              <span className="px-4 py-1.5 rounded-full bg-white/20 text-white text-sm font-medium backdrop-blur-sm">
                {callTypeLabel}
              </span>
            </div>

            {/* Contact Info Card */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm text-white mb-6">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-white/20">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{call.contact_name || "Contact"}</p>
                    {call.phone_number && (
                      <p className="text-white/70 text-sm">{call.phone_number}</p>
                    )}
                  </div>
                </div>

                {call.property_address && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white/20">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <p className="text-white/90 text-sm">{call.property_address}</p>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-white/20">
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="text-white/90 text-sm">
                    {new Date(call.scheduled_at).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "America/New_York",
                    })} EST
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold shadow-lg h-14 text-lg"
                onClick={handleJoin}
              >
                {call.meeting_link ? (
                  <>
                    <Video className="h-5 w-5 mr-2" />
                    Join Video Call
                  </>
                ) : call.phone_number ? (
                  <>
                    <Phone className="h-5 w-5 mr-2" />
                    Call Now
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-5 w-5 mr-2" />
                    View Details
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 h-14 px-6"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
