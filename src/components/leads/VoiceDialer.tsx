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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Phone, Delete, Loader2, PhoneOff, PhoneCall, MessageSquare, Search, User, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Device, Call } from "@twilio/voice-sdk";
import { useQuery } from "@tanstack/react-query";

interface VoiceDialerProps {
  defaultMessage?: string;
}

interface ContactRecord {
  id: string;
  name: string;
  phone: string | null;
  type: 'owner' | 'lead';
  address?: string;
}

const VoiceDialer = ({ defaultMessage }: VoiceDialerProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOnCall, setIsOnCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'search' | 'dialer'>('search');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dialPad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  // Fetch owners and leads for search
  const { data: contacts = [] } = useQuery({
    queryKey: ['dialer-contacts'],
    queryFn: async () => {
      const [ownersResult, leadsResult] = await Promise.all([
        supabase
          .from('property_owners')
          .select('id, name, phone, properties(address)')
          .not('phone', 'is', null),
        supabase
          .from('leads')
          .select('id, name, phone, property_address')
          .not('phone', 'is', null)
      ]);

      const owners: ContactRecord[] = (ownersResult.data || []).map(o => ({
        id: o.id,
        name: o.name,
        phone: o.phone,
        type: 'owner' as const,
        address: o.properties?.[0]?.address || undefined,
      }));

      const leads: ContactRecord[] = (leadsResult.data || []).map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        type: 'lead' as const,
        address: l.property_address || undefined,
      }));

      return [...owners, ...leads];
    },
    enabled: open,
  });

  // Filter contacts based on search
  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.address?.toLowerCase().includes(q)
    );
  });

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

  const handleClear = () => {
    setPhoneNumber("");
    setSelectedContact(null);
    setView('search');
    setSearchQuery("");
  };

  const handleSelectContact = (contact: ContactRecord) => {
    if (contact.phone) {
      setPhoneNumber(contact.phone.replace(/\D/g, ''));
      setSelectedContact(contact);
      setView('dialer');
    }
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

  const handleSendSMS = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    const message = prompt("Enter your message:");
    if (!message) return;

    setIsSendingSMS(true);
    try {
      let formattedPhone = phoneNumber.replace(/\D/g, "");
      if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
        formattedPhone = '1' + formattedPhone;
      }
      formattedPhone = '+' + formattedPhone;

      const { error } = await supabase.functions.invoke('send-review-sms', {
        body: {
          to: formattedPhone,
          body: message,
        }
      });

      if (error) throw error;
      toast.success('SMS sent successfully');
    } catch (error) {
      console.error('Failed to send SMS:', error);
      toast.error('Failed to send SMS');
    } finally {
      setIsSendingSMS(false);
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
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-center">Voice Dialer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {view === 'search' && !isOnCall ? (
            <>
              <Command className="rounded-lg border">
                <CommandInput 
                  placeholder="Search owners, leads, addresses..." 
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-64">
                  <CommandEmpty>No contacts found.</CommandEmpty>
                  <CommandGroup>
                    {filteredContacts.slice(0, 15).map((contact) => (
                      <CommandItem
                        key={`${contact.type}-${contact.id}`}
                        onSelect={() => handleSelectContact(contact)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {contact.type === 'owner' ? (
                            <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{contact.name}</p>
                            {contact.address && (
                              <p className="text-xs text-muted-foreground truncate">{contact.address}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{contact.phone}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setView('dialer')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Manual dial
              </Button>
            </>
          ) : (
            <>
              {selectedContact && !isOnCall && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedContact.type === 'owner' ? (
                      <Home className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedContact.name}</p>
                      {selectedContact.address && (
                        <p className="text-xs text-muted-foreground truncate">{selectedContact.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
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

              {isOnCall && (
                <div className="text-center text-green-600 font-medium">
                  Connected • {formatDuration(callDuration)}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {dialPad.flat().map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="h-12 text-xl font-medium"
                    onClick={() => handleDigitPress(digit)}
                  >
                    {digit}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                {!isOnCall && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleClear}
                      disabled={isConnecting}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSendSMS}
                      disabled={!phoneNumber || isSendingSMS || isConnecting}
                    >
                      {isSendingSMS ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </Button>
                  </>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceDialer;
