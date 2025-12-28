import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Delete, Loader2, PhoneOff, PhoneCall, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Device, Call } from "@twilio/voice-sdk";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface DirectCallButtonProps {
  leadId: string;
  leadPhone: string | null;
  leadName: string;
  leadAddress?: string | null;
}

const DirectCallButton = ({ leadId, leadPhone, leadName, leadAddress }: DirectCallButtonProps) => {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
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
    if (open && leadPhone) {
      setPhoneNumber(leadPhone.replace(/\D/g, ''));
    }
  }, [open, leadPhone]);

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

      const call = await device.connect({
        params: {
          To: formattedPhone
        }
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
      // Don't close if on a call
      return;
    }
    if (!newOpen) {
      handleEndCall();
    }
    setOpen(newOpen);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!leadPhone) {
      toast.error("Lead has no phone number");
      return;
    }
    setOpen(true);
  };

  if (!leadPhone) {
    return null;
  }

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 min-h-[44px] min-w-[44px]"
        onClick={handleClick}
      >
        <Phone className="h-4 w-4" />
      </Button>

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
            <DialogTitle className="text-center text-xl">Call {leadName}</DialogTitle>
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
                  <p className="font-medium text-lg truncate">{leadName}</p>
                  {leadAddress && (
                    <p className="text-sm text-muted-foreground truncate">{leadAddress}</p>
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

            {/* Dial pad - larger on mobile */}
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

            {/* Call buttons - larger on mobile */}
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
};

export default DirectCallButton;
