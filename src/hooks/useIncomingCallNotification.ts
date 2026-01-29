import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/ProtectedRoute";
import { toast } from "sonner";

interface IncomingCall {
  id: string;
  call_sid: string;
  from_number: string;
  from_name: string | null;
  to_number: string;
  status: string;
  ring_count: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export function useIncomingCallNotification() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);

  // Accept the incoming call - updates status and returns call info
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return null;

    try {
      // Update the notification status to answered
      await supabase
        .from('incoming_call_notifications')
        .update({ 
          status: 'answered',
          answered_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      // Call the edge function to accept the call via Twilio
      const { error } = await supabase.functions.invoke('twilio-accept-call', {
        body: { 
          callSid: incomingCall.call_sid,
          userId: user?.id 
        }
      });

      if (error) {
        console.error('Error accepting call:', error);
        toast.error('Failed to connect call');
        return null;
      }

      const callInfo = { ...incomingCall };
      setIncomingCall(null);
      setIsRinging(false);
      
      return callInfo;
    } catch (err) {
      console.error('Error accepting call:', err);
      toast.error('Failed to accept call');
      return null;
    }
  }, [incomingCall, user?.id]);

  // Decline the incoming call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from('incoming_call_notifications')
        .update({ 
          status: 'declined',
          expired_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      // Notify the edge function to forward to voicemail/AI
      await supabase.functions.invoke('twilio-decline-call', {
        body: { 
          callSid: incomingCall.call_sid,
          userId: user?.id 
        }
      });

      setIncomingCall(null);
      setIsRinging(false);
    } catch (err) {
      console.error('Error declining call:', err);
    }
  }, [incomingCall, user?.id]);

  // Dismiss without action (call expired or was handled elsewhere)
  const dismissCall = useCallback(() => {
    setIncomingCall(null);
    setIsRinging(false);
  }, []);

  // Subscribe to incoming call notifications for this user
  useEffect(() => {
    if (!user?.id) return;

    console.log('[IncomingCall] Subscribing to incoming call notifications for user:', user.id);

    // Check for any existing ringing calls when component mounts
    const checkExistingCalls = async () => {
      const { data } = await supabase
        .from('incoming_call_notifications')
        .select('*')
        .eq('to_user_id', user.id)
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        // Check if call is still fresh (less than 30 seconds old)
        const callAge = Date.now() - new Date(data.created_at).getTime();
        if (callAge < 30000) {
          console.log('[IncomingCall] Found existing ringing call:', data.call_sid);
          setIncomingCall(data as IncomingCall);
          setIsRinging(true);
        }
      }
    };

    checkExistingCalls();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incoming_call_notifications',
          filter: `to_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[IncomingCall] New incoming call:', payload.new);
          const call = payload.new as IncomingCall;
          
          if (call.status === 'ringing') {
            setIncomingCall(call);
            setIsRinging(true);
            
            // Play ringtone sound
            try {
              const audio = new Audio('/sounds/ringtone.mp3');
              audio.loop = true;
              audio.volume = 0.7;
              audio.play().catch(() => console.log('Could not play ringtone'));
              
              // Store reference to stop later
              (window as unknown as Record<string, HTMLAudioElement>).__incomingCallAudio = audio;
            } catch (e) {
              console.log('Audio not available');
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incoming_call_notifications',
          filter: `to_user_id=eq.${user.id}`,
        },
        (payload) => {
          const call = payload.new as IncomingCall;
          console.log('[IncomingCall] Call status updated:', call.status);
          
          // If call is no longer ringing, dismiss the modal
          if (call.status !== 'ringing') {
            setIncomingCall(null);
            setIsRinging(false);
            
            // Stop ringtone
            const audio = (window as unknown as Record<string, HTMLAudioElement>).__incomingCallAudio;
            if (audio) {
              audio.pause();
              audio.currentTime = 0;
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[IncomingCall] Unsubscribing from incoming calls');
      supabase.removeChannel(channel);
      
      // Stop ringtone on cleanup
      const audio = (window as unknown as Record<string, HTMLAudioElement>).__incomingCallAudio;
      if (audio) {
        audio.pause();
      }
    };
  }, [user?.id]);

  return {
    incomingCall,
    isRinging,
    acceptCall,
    declineCall,
    dismissCall,
  };
}
