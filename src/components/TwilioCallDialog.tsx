import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Delete, Loader2, PhoneOff, PhoneCall, User, Minimize2, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Device, Call } from "@twilio/voice-sdk";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface TwilioCallDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string | null;
  contactName: string;
  contactAddress?: string | null;
  onCallComplete?: () => void;
  metadata?: {
    communicationId?: string;
    ownerId?: string;
    leadId?: string;
  };
}

// Minimized call indicator component
function MinimizedCallIndicator({ 
  contactName, 
  duration, 
  onMaximize,
  onEndCall,
}: { 
  contactName: string; 
  duration: number; 
  onMaximize: () => void;
  onEndCall: () => void;
}) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 bg-green-600 text-white rounded-full shadow-lg flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-green-700 transition-colors"
      onClick={onMaximize}
    >
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="font-medium text-sm">{contactName}</span>
      <span className="text-sm opacity-80">{formatDuration(duration)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-white hover:bg-green-800 ml-1"
        onClick={(e) => {
          e.stopPropagation();
          onEndCall();
        }}
      >
        <PhoneOff className="h-3 w-3" />
      </Button>
      <Maximize2 className="h-4 w-4 ml-1" />
    </div>
  );
}

export function TwilioCallDialog({
  isOpen,
  onOpenChange,
  phoneNumber: initialPhoneNumber,
  contactName,
  contactAddress,
  onCallComplete,
  metadata,
}: TwilioCallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const isMobile = useIsMobile();
  
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dialPad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  // Set phone number when dialog opens
  useEffect(() => {
    if (isOpen && initialPhoneNumber) {
      setPhoneNumber(initialPhoneNumber.replace(/\D/g, ''));
    }
  }, [isOpen, initialPhoneNumber]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  const initializeDevice = async () => {
    try {
      console.log('Getting Twilio token...');
      const { data, error } = await supabase.functions.invoke('twilio-token', {
        body: { identity: `peachhaus-${Date.now()}` }
      });

      if (error) throw error;
      if (!data?.token) throw new Error('No token received');

      console.log('Token received, initializing device...');
      
      const device = new Device(data.token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
      });

      device.on('registered', () => {
        console.log('Device registered successfully');
      });

      device.on('error', (err) => {
        console.error('Device error:', err);
        toast.error('Call device error: ' + err.message);
      });

      await device.register();
      deviceRef.current = device;
      
      return device;
    } catch (error) {
      console.error('Failed to initialize device:', error);
      throw error;
    }
  };

  const handleEndCall = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsOnCall(false);
    setIsConnecting(false);
    setCallDuration(0);
  }, []);

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
    if (callRef.current && isOnCall) {
      callRef.current.sendDigits(digit);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCall = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setIsConnecting(true);

    try {
      let device = deviceRef.current;
      
      if (!device) {
        device = await initializeDevice();
      }

      let formattedPhone = phoneNumber.replace(/\D/g, "");
      if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
        formattedPhone = '1' + formattedPhone;
      }
      formattedPhone = '+' + formattedPhone;

      console.log('Making call to:', formattedPhone);

      // Include metadata in call params for tracking
      const callParams: Record<string, string> = {
        To: formattedPhone
      };
      
      if (metadata?.communicationId) {
        callParams.communication_id = metadata.communicationId;
      }
      if (metadata?.ownerId) {
        callParams.owner_id = metadata.ownerId;
      }
      if (metadata?.leadId) {
        callParams.lead_id = metadata.leadId;
      }

      const call = await device.connect({
        params: callParams
      });

      callRef.current = call;

      call.on('accept', () => {
        console.log('Call accepted');
        setIsOnCall(true);
        setIsConnecting(false);
        setCallDuration(0);
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        toast.success('Call connected');
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        handleEndCall();
        // Trigger callback after call ends
        if (onCallComplete) {
          toast.success(`Call with ${contactName} completed`);
          onCallComplete();
        }
        onOpenChange(false);
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        handleEndCall();
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        toast.error('Call error: ' + err.message);
        handleEndCall();
      });

    } catch (error) {
      console.error('Failed to make call:', error);
      toast.error('Failed to initiate call: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsConnecting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isOnCall) {
      // Minimize instead of closing if on a call
      setIsMinimized(true);
      return;
    }
    if (!newOpen) {
      handleEndCall();
    }
    onOpenChange(newOpen);
  };

  const handleMaximize = () => {
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  // Extract first name for display, handling "Unknown" patterns
  const displayName = (() => {
    if (!contactName) return 'Contact';
    if (contactName.toLowerCase().includes('unknown')) return 'Contact';
    return contactName;
  })();

  return (
    <>
      {/* Minimized call indicator */}
      {isMinimized && isOnCall && (
        <MinimizedCallIndicator
          contactName={displayName}
          duration={callDuration}
          onMaximize={handleMaximize}
          onEndCall={() => {
            handleEndCall();
            setIsMinimized(false);
            onOpenChange(false);
            onCallComplete?.();
          }}
        />
      )}

      <Dialog open={isOpen && !isMinimized} onOpenChange={handleOpenChange}>
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
            <div className="flex items-center justify-between">
              <div className="w-8" /> {/* Spacer */}
              <DialogTitle className="text-center text-xl">Call {displayName}</DialogTitle>
              {isOnCall && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleMinimize}
                  title="Minimize call"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              )}
              {!isOnCall && <div className="w-8" />}
            </div>
          </DialogHeader>
          
          <div className={cn(
            "space-y-4 flex-1 flex flex-col",
            isMobile && "justify-center pb-[env(safe-area-inset-bottom)]"
          )}>
            {/* Contact info */}
            <div className="p-4 bg-muted rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-lg truncate">{displayName}</p>
                  {contactAddress && (
                    <p className="text-sm text-muted-foreground truncate">{contactAddress}</p>
                  )}
                </div>
              </div>
            </div>
          
          {/* Phone input */}
          <div className="relative">
            <Input
              value={formatPhoneDisplay(phoneNumber)}
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
                onClick={handleEndCall}
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
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}