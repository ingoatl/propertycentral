import { useIncomingCallNotification } from "@/hooks/useIncomingCallNotification";
import { IncomingCallModal } from "./IncomingCallModal";

/**
 * Global provider component that listens for incoming call notifications
 * and displays the incoming call modal when a call is detected.
 * 
 * This should be rendered once at the app level (e.g., in App.tsx or a layout component).
 */
export function IncomingCallProvider() {
  const {
    incomingCall,
    isRinging,
    acceptCall,
    declineCall,
    dismissCall,
  } = useIncomingCallNotification();

  if (!incomingCall || !isRinging) {
    return null;
  }

  return (
    <IncomingCallModal
      isOpen={isRinging}
      fromNumber={incomingCall.from_number}
      fromName={incomingCall.from_name}
      callSid={incomingCall.call_sid}
      onAccept={acceptCall}
      onDecline={declineCall}
      onDismiss={dismissCall}
    />
  );
}
