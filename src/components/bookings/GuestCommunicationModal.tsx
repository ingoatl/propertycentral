import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, MessageSquare, Sparkles, Loader2, RefreshCw, Send } from "lucide-react";
import { format } from "date-fns";

interface GuestInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  propertyName: string;
  monthlyRent?: number;
  startDate?: string;
  endDate?: string;
}

interface UserPhoneAssignment {
  phone_number: string;
  display_name: string;
  phone_type: string;
}

interface GuestCommunicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: GuestInfo | null;
  mode: 'text' | 'call';
}

const MESSAGE_TYPES = [
  { id: 'check_in', label: 'Welcome Check-in', icon: '👋' },
  { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { id: 'payment', label: 'Payment Reminder', icon: '💳' },
  { id: 'check_out', label: 'Departure', icon: '✈️' },
  { id: 'general', label: 'General', icon: '💬' },
  { id: 'custom', label: 'Custom', icon: '✏️' },
] as const;

// GHL number for SMS, Twilio for calls
const GHL_SMS_NUMBER = '+14048005932';
const TWILIO_CALL_NUMBER = '+14049241CALL'; // placeholder, actual Twilio number from assignments

export const GuestCommunicationModal = ({
  open,
  onOpenChange,
  guest,
  mode,
}: GuestCommunicationModalProps) => {
  const [smsPhone, setSmsPhone] = useState<string>(GHL_SMS_NUMBER);
  const [callPhone, setCallPhone] = useState<UserPhoneAssignment | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [messageType, setMessageType] = useState<string>('general');
  const [contextInput, setContextInput] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(true);

  // Load user's assigned phone number for calls only and user name
  useEffect(() => {
    const loadUserData = async () => {
      setLoadingPhone(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user profile for name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.first_name) {
          setUserName(profile.first_name);
        }

        // Get Twilio phone for calls
        const { data } = await supabase
          .from('user_phone_assignments')
          .select('phone_number, display_name, phone_type')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('phone_type', { ascending: true });

        if (data && data.length > 0) {
          // Find Twilio phone (personal type or the 404-924 number)
          const twilioPhone = data.find(p => 
            p.phone_number.includes('4049241') || p.phone_type === 'personal'
          );
          setCallPhone(twilioPhone || data[0]);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoadingPhone(false);
      }
    };

    if (open) {
      loadUserData();
      setGeneratedMessage('');
      setMessageType('general');
      setContextInput('');
    }
  }, [open]);

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleGenerateMessage = async () => {
    if (!guest) return;
    if (!contextInput.trim()) {
      toast.error('Please enter what you want to say');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-guest-message', {
        body: {
          guestName: guest.name,
          propertyName: guest.propertyName,
          monthlyRent: guest.monthlyRent,
          startDate: guest.startDate,
          endDate: guest.endDate,
          messageType,
          customDescription: contextInput, // Always use the context input
          tone: 'friendly',
          senderName: userName || 'PeachHaus Team', // Pass user's name for signature
        },
      });

      if (error) throw error;
      setGeneratedMessage(data.message);
    } catch (error: any) {
      console.error('Error generating message:', error);
      toast.error('Failed to generate message');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!guest) return;
    
    // Use generated message if available, otherwise use context input directly
    const messageToSend = generatedMessage || contextInput;
    
    if (!messageToSend.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('ghl-send-sms', {
        body: {
          phone: guest.phone,
          message: messageToSend,
          fromNumber: smsPhone, // Always use GHL 404-800 number for SMS
        },
      });

      if (error) throw error;

      toast.success(`Message sent to ${guest.name}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleCall = () => {
    if (!guest?.phone) return;
    // Open phone dialer
    window.open(`tel:${guest.phone}`, '_self');
  };

  if (!guest) return null;

  const firstName = guest.name.split(' ')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'text' ? (
              <MessageSquare className="w-5 h-5 text-green-600" />
            ) : (
              <Phone className="w-5 h-5 text-blue-600" />
            )}
            {mode === 'text' ? 'Message' : 'Call'} {guest.name}
          </DialogTitle>
          <DialogDescription>
            @ {guest.propertyName}
          </DialogDescription>
        </DialogHeader>

        {mode === 'call' ? (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">
                {formatPhoneDisplay(guest.phone)}
              </p>
              {callPhone && (
                <p className="text-sm text-muted-foreground">
                  Calling from: {formatPhoneDisplay(callPhone.phone_number)}
                  <Badge variant="outline" className="ml-2 text-xs">
                    Twilio
                  </Badge>
                </p>
              )}
            </div>
            <Button
              onClick={handleCall}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Phone className="w-4 h-4 mr-2" />
              Start Call
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* From Number - Always GHL for SMS */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Sending from:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {formatPhoneDisplay(smsPhone)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  GHL SMS
                </Badge>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <Label>Message Type</Label>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_TYPES.map((type) => (
                  <Button
                    key={type.id}
                    variant={messageType === type.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMessageType(type.id)}
                    className="gap-1"
                  >
                    <span>{type.icon}</span>
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Context Input - Always visible */}
            <div className="space-y-2">
              <Label>What do you want to say?</Label>
              <Textarea
                value={contextInput}
                onChange={(e) => setContextInput(e.target.value)}
                placeholder={`Enter your message idea and AI will refine it for ${firstName}...`}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The AI will refine your message with a warm, professional tone
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerateMessage}
              disabled={isGenerating || !contextInput.trim()}
              variant="outline"
              className="w-full gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating ? 'Refining with AI...' : 'Refine with AI'}
            </Button>

            {/* Generated Message */}
            {generatedMessage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message Preview</Label>
                  <span className="text-xs text-muted-foreground">
                    {generatedMessage.length} chars
                  </span>
                </div>
                <Textarea
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateMessage}
                    disabled={isGenerating}
                    className="gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'text' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={(!generatedMessage && !contextInput.trim()) || isSending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSending ? 'Sending...' : 'Send via GHL'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
