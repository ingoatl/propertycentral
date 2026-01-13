import { useState, useRef, useCallback, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneForTwilio, cleanPhoneNumber } from "@/lib/phoneUtils";

interface UseTwilioDeviceOptions {
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onCallError?: (error: Error) => void;
}

export function useTwilioDevice(options: UseTwilioDeviceOptions = {}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      const { data, error } = await supabase.functions.invoke('twilio-token', {
        body: { 
          identity: `peachhaus-${Date.now()}`,
          userId 
        }
      });

      if (error) {
        console.error('Twilio token error:', error);
        throw new Error(error.message || 'Failed to get call token');
      }
      if (!data?.token) {
        console.error('No token in response:', data);
        throw new Error('No token received from server');
      }

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
        options.onCallError?.(err);
      });

      await device.register();
      deviceRef.current = device;
      
      return device;
    } catch (error) {
      console.error('Failed to initialize device:', error);
      throw error;
    }
  };

  const endCall = useCallback(() => {
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
    options.onCallEnd?.();
  }, [options]);

  const sendDigits = useCallback((digit: string) => {
    if (callRef.current && isOnCall) {
      callRef.current.sendDigits(digit);
    }
  }, [isOnCall]);

  const makeCall = useCallback(async (phoneNumber: string): Promise<boolean> => {
    const cleaned = cleanPhoneNumber(phoneNumber);
    if (cleaned.length < 10) {
      toast.error("Please enter a valid phone number");
      return false;
    }

    setIsConnecting(true);

    try {
      let device = deviceRef.current;
      
      if (!device) {
        device = await initializeDevice();
      }

      const formattedPhone = formatPhoneForTwilio(cleaned);

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
        options.onCallStart?.();
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        endCall();
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        endCall();
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        toast.error('Call error: ' + err.message);
        endCall();
        options.onCallError?.(err);
      });

      return true;
    } catch (error) {
      console.error('Failed to make call:', error);
      toast.error('Failed to initiate call: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsConnecting(false);
      return false;
    }
  }, [endCall, options]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    isConnecting,
    isOnCall,
    callDuration,
    makeCall,
    endCall,
    sendDigits,
    formatDuration,
  };
}
