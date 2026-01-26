import { useState, useRef, useCallback, useEffect } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhoneForTwilio, cleanPhoneNumber } from "@/lib/phoneUtils";

interface UseTwilioDeviceOptions {
  onCallStart?: (callSid?: string) => void;
  onCallEnd?: () => void;
  onCallError?: (error: Error) => void;
  leadId?: string | null;
  ownerId?: string | null;
  contactPhone?: string;
}

type CallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'disconnected';

export function useTwilioDevice(options: UseTwilioDeviceOptions = {}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);
  
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
        throw new Error(error.message || 'Failed to get call token');
      }
      if (!data?.token) {
        throw new Error('No token received from server');
      }
      
      const device = new Device(data.token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
      });

      device.on('registered', () => {
        console.log('Twilio device registered');
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
    setCallStatus('idle');
    setCallDuration(0);
    setCurrentCallSid(null);
    options.onCallEnd?.();
  }, [options]);

  const sendDigits = useCallback((digit: string) => {
    if (callRef.current && isOnCall) {
      callRef.current.sendDigits(digit);
    }
  }, [isOnCall]);

  const makeCall = useCallback(async (phoneNumber: string, leadId?: string | null, ownerId?: string | null): Promise<boolean> => {
    const cleaned = cleanPhoneNumber(phoneNumber);
    if (cleaned.length < 10) {
      toast.error("Please enter a valid phone number");
      return false;
    }

    setIsConnecting(true);
    setCallStatus('connecting');

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

      // Listen for ringing - this fires when the recipient's phone is ringing
      call.on('ringing', () => {
        console.log('Phone is ringing...');
        setCallStatus('ringing');
        setIsConnecting(false);
        setIsOnCall(true); // Show as active but "ringing"
        toast.info('Ringing...');
      });

      call.on('accept', async () => {
        console.log('Call accepted - recipient answered');
        setCallStatus('connected');
        
        // Get the CallSid from Twilio
        const callSid = call.parameters?.CallSid;
        console.log('Call SID:', callSid);
        setCurrentCallSid(callSid);
        
        // Create a communication record so we can track this call
        if (callSid) {
          try {
            const effectiveLeadId = leadId ?? options.leadId;
            const effectiveOwnerId = ownerId ?? options.ownerId;
            const effectivePhone = phoneNumber || options.contactPhone;
            
            console.log('Creating communication record for call:', { callSid, effectiveLeadId, effectiveOwnerId, effectivePhone });
            
            const { error: insertError } = await supabase
              .from('lead_communications')
              .insert({
                external_id: callSid,
                communication_type: 'call',
                direction: 'outbound',
                body: `Outbound call to ${effectivePhone}`,
                status: 'in-progress',
                lead_id: effectiveLeadId || null,
                owner_id: effectiveOwnerId || null,
                metadata: { 
                  to_number: formattedPhone,
                  initiated_at: new Date().toISOString()
                }
              });
            
            if (insertError) {
              console.error('Error creating call record:', insertError);
            } else {
              console.log('Call record created successfully');
            }
          } catch (err) {
            console.error('Failed to create call record:', err);
          }
        }
        
        setIsOnCall(true);
        setIsConnecting(false);
        setCallDuration(0);
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        toast.success('Call connected');
        options.onCallStart?.(callSid);
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
      setCallStatus('idle');
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
    callStatus,
    callDuration,
    currentCallSid,
    makeCall,
    endCall,
    sendDigits,
    formatDuration,
  };
}
