import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Delete, Loader2, PhoneOff, PhoneCall, User, Home, Circle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { formatPhoneForDisplay, cleanPhoneNumber } from "@/lib/phoneUtils";
import { Badge } from "@/components/ui/badge";

interface CallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  contactType?: 'lead' | 'owner';
  contactAddress?: string | null;
}

const dialPad = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export function CallDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  contactType = 'lead',
  contactAddress,
}: CallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const isMobile = useIsMobile();
  
  const { isConnecting, isOnCall, callDuration, makeCall, endCall, sendDigits, formatDuration } = useTwilioDevice();

  // Set phone number when dialog opens
  useEffect(() => {
    if (open && contactPhone) {
      setPhoneNumber(cleanPhoneNumber(contactPhone));
    }
  }, [open, contactPhone]);

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
    sendDigits(digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  // Using formatPhoneForDisplay from phoneUtils

  const handleCall = async () => {
    await makeCall(phoneNumber);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isOnCall) {
      // Don't close if on a call
      return;
    }
    if (!newOpen) {
      endCall();
      setPhoneNumber("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={cn(
          "p-4",
          isMobile 
            ? "fixed inset-0 w-full h-full max-w-none max-h-none rounded-none m-0 flex flex-col" 
            : "sm:max-w-[380px]"
        )} 
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-center text-xl">Call {contactName}</DialogTitle>
        </DialogHeader>
        
        <div className={cn(
          "space-y-4 flex-1 flex flex-col",
          isMobile && "justify-center pb-[env(safe-area-inset-bottom)]"
        )}>
          {/* Contact info */}
          <div className="p-4 bg-muted rounded-xl">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                {contactType === 'owner' ? (
                  <Home className="h-6 w-6 text-primary" />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-lg truncate">{contactName}</p>
                {contactAddress && (
                  <p className="text-sm text-muted-foreground truncate">{contactAddress}</p>
                )}
              </div>
            </div>
          </div>

          {/* Recording indicator when on call */}
          {isOnCall && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-600">Recording</span>
              <Badge variant="secondary" className="text-xs">
                Auto-transcribed
              </Badge>
            </div>
          )}
          
          {/* Phone input */}
          <div className="relative">
            <Input
              value={formatPhoneForDisplay(phoneNumber)}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter phone number"
              className={cn(
                "text-center font-medium pr-12",
                isMobile ? "text-2xl h-16" : "text-xl h-14"
              )}
              disabled={isOnCall}
            />
            {phoneNumber && !isOnCall && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={handleBackspace}
              >
                <Delete className="h-5 w-5" />
              </Button>
            )}
          </div>

          {isOnCall && (
            <div className="text-center text-green-600 font-semibold text-lg py-2">
              Connected • {formatDuration(callDuration)}
            </div>
          )}

          {/* Dial pad */}
          <div className={cn(
            "grid grid-cols-3",
            isMobile ? "gap-3" : "gap-2"
          )}>
            {dialPad.flat().map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className={cn(
                  "font-semibold rounded-2xl active:scale-95 transition-transform",
                  isMobile ? "h-16 text-2xl" : "h-14 text-xl"
                )}
                onClick={() => handleDigitPress(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>

          {/* Call buttons */}
          <div className="flex gap-3 pt-2">
            {isOnCall ? (
              <Button
                variant="destructive"
                className={cn(
                  "flex-1 font-semibold",
                  isMobile ? "h-14 text-lg" : "h-12"
                )}
                onClick={endCall}
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                End Call
              </Button>
            ) : (
              <Button
                className={cn(
                  "flex-1 bg-green-600 hover:bg-green-700 font-semibold",
                  isMobile ? "h-14 text-lg" : "h-12"
                )}
                onClick={handleCall}
                disabled={isConnecting || !phoneNumber}
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <PhoneCall className="h-5 w-5 mr-2" />
                    Call
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Recording info */}
          <p className="text-xs text-center text-muted-foreground">
            All calls are automatically recorded and transcribed via Twilio
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
