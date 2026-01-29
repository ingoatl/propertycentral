import { useState, useEffect } from "react";
import { Phone, PhoneOff, User, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phoneUtils";
import { CallDialog } from "./CallDialog";

interface IncomingCallModalProps {
  isOpen: boolean;
  fromNumber: string;
  fromName: string | null;
  callSid: string;
  onAccept: () => Promise<unknown>;
  onDecline: () => Promise<void>;
  onDismiss: () => void;
}

export function IncomingCallModal({
  isOpen,
  fromNumber,
  fromName,
  callSid,
  onAccept,
  onDecline,
  onDismiss,
}: IncomingCallModalProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [ringCount, setRingCount] = useState(0);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [acceptedCallInfo, setAcceptedCallInfo] = useState<{
    name: string;
    phone: string;
  } | null>(null);

  // Ring animation counter
  useEffect(() => {
    if (!isOpen) {
      setRingCount(0);
      return;
    }

    const interval = setInterval(() => {
      setRingCount((prev) => prev + 1);
    }, 3000); // Count every 3 seconds (roughly one ring)

    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(() => {
      console.log('[IncomingCall] Auto-dismissing after timeout');
      onDismiss();
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isOpen, onDismiss]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const callInfo = await onAccept();
      if (callInfo) {
        // Open the call dialog with the accepted call
        setAcceptedCallInfo({
          name: fromName || 'Unknown Caller',
          phone: fromNumber,
        });
        setShowCallDialog(true);
      }
    } finally {
      setIsAccepting(false);
    }
  };

  if (!isOpen && !showCallDialog) return null;

  // If call was accepted, show the call dialog
  if (showCallDialog && acceptedCallInfo) {
    return (
      <CallDialog
        open={showCallDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCallDialog(false);
            setAcceptedCallInfo(null);
          }
        }}
        contactName={acceptedCallInfo.name}
        contactPhone={acceptedCallInfo.phone}
        contactType="lead"
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Animated background rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-64 h-64 rounded-full border-2 border-green-500/30 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute w-80 h-80 rounded-full border-2 border-green-500/20 animate-ping" style={{ animationDuration: '2.5s' }} />
        <div className="absolute w-96 h-96 rounded-full border-2 border-green-500/10 animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      {/* Call card */}
      <div className="relative bg-gradient-to-b from-card to-card/95 rounded-3xl p-8 shadow-2xl border border-border/50 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-300">
        {/* Caller avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
              <User className="h-12 w-12 text-white" />
            </div>
            {/* Pulsing ring around avatar */}
            <div className="absolute inset-0 rounded-full border-4 border-green-500/50 animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold text-foreground text-center">
            {fromName || 'Unknown Caller'}
          </h2>
          <p className="text-lg text-muted-foreground font-mono">
            {formatPhoneForDisplay(fromNumber)}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Incoming call • Ring {ringCount + 1}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          {/* Decline button */}
          <Button
            variant="destructive"
            size="lg"
            className={cn(
              "flex-1 h-14 rounded-full text-lg font-semibold",
              "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25"
            )}
            onClick={onDecline}
            disabled={isAccepting}
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            Decline
          </Button>

          {/* Accept button */}
          <Button
            size="lg"
            className={cn(
              "flex-1 h-14 rounded-full text-lg font-semibold",
              "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/25",
              "animate-pulse"
            )}
            onClick={handleAccept}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Phone className="h-5 w-5 mr-2" />
                Accept
              </>
            )}
          </Button>
        </div>

        {/* Call ID for debugging */}
        <p className="text-xs text-muted-foreground/50 text-center mt-4 font-mono">
          {callSid.substring(0, 20)}...
        </p>
      </div>
    </div>
  );
}
