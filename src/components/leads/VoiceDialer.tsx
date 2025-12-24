import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Phone, Delete, Loader2, PhoneOff, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Device, Call } from "@twilio/voice-sdk";

interface VoiceDialerProps {
  defaultMessage?: string;
}

const VoiceDialer = ({ defaultMessage }: VoiceDialerProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [open, setOpen] = useState(false);
  
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dialPad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

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
    // Send DTMF tone if on call
    if (callRef.current && isOnCall) {
      callRef.current.sendDigits(digit);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber("");
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

      // Format phone number
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Phone className="h-4 w-4" />
          Dialer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle className="text-center">Voice Dialer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Phone number display */}
          <div className="relative">
            <Input
              value={formatPhoneDisplay(phoneNumber)}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter phone number"
              className="text-center text-xl font-medium h-14 pr-10"
              disabled={isOnCall}
            />
            {phoneNumber && !isOnCall && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleBackspace}
              >
                <Delete className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Call status */}
          {isOnCall && (
            <div className="text-center text-green-600 font-medium">
              Connected • {formatDuration(callDuration)}
            </div>
          )}

          {/* Dial pad */}
          <div className="grid grid-cols-3 gap-2">
            {dialPad.flat().map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-14 text-xl font-medium"
                onClick={() => handleDigitPress(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isOnCall && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClear}
                disabled={!phoneNumber || isConnecting}
              >
                Clear
              </Button>
            )}
            
            {isOnCall ? (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleEndCall}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
            ) : (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleCall}
                disabled={isConnecting || !phoneNumber}
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <PhoneCall className="h-4 w-4 mr-2" />
                    Call
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceDialer;
