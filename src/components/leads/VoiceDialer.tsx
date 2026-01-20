import { useState, useCallback } from "react";
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
import { Phone, Delete, Loader2, PhoneOff, PhoneCall, MessageSquare, User, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/ProtectedRoute";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { formatPhoneForDisplay, cleanPhoneNumber } from "@/lib/phoneUtils";

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
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'search' | 'dialer'>('search');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  const { isConnecting, isOnCall, callDuration, makeCall, endCall, sendDigits, formatDuration } = useTwilioDevice();

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
          .select('id, name, phone, property_address, stage')
          .not('phone', 'is', null)
          .neq('stage', 'ops_handoff') // Exclude ops_handoff leads - they are now owners
      ]);

      const owners: ContactRecord[] = (ownersResult.data || []).map(o => ({
        id: o.id,
        name: o.name,
        phone: o.phone,
        type: 'owner' as const,
        address: o.properties?.[0]?.address || undefined,
      }));

      // Create a set of owner phone numbers to deduplicate
      const ownerPhones = new Set(
        owners.map(o => cleanPhoneNumber(o.phone || '')).filter(Boolean)
      );

      const leads: ContactRecord[] = (leadsResult.data || [])
        .filter(l => {
          // Exclude leads whose phone matches an existing owner
          const cleanedPhone = cleanPhoneNumber(l.phone || '');
          return !ownerPhones.has(cleanedPhone);
        })
        .map(l => ({
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

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
    sendDigits(digit);
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

  const handleCallContact = async (contact: ContactRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (contact.phone) {
      const cleanedPhone = cleanPhoneNumber(contact.phone);
      setPhoneNumber(cleanedPhone);
      setSelectedContact(contact);
      setView('dialer');
      await makeCall(cleanedPhone);
    }
  };

  const handleTextContact = async (contact: ContactRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!contact.phone) {
      toast.error("No phone number available");
      return;
    }

    const message = prompt("Enter your message:");
    if (!message) return;

    setIsSendingSMS(true);
    try {
      let formattedPhone = cleanPhoneNumber(contact.phone);
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

  const handleSelectContact = (contact: ContactRecord) => {
    if (contact.phone) {
      const cleanedPhone = cleanPhoneNumber(contact.phone);
      setPhoneNumber(cleanedPhone);
      setSelectedContact(contact);
      setView('dialer');
    }
  };

  // Using formatPhoneForDisplay from phoneUtils

  const handleCall = async () => {
    await makeCall(phoneNumber);
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

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && isOnCall) {
      // Don't close if on a call
      return;
    }
    if (!newOpen) {
      endCall();
      setPhoneNumber("");
      setSelectedContact(null);
      setView('search');
      setSearchQuery("");
    }
    setOpen(newOpen);
  }, [isOnCall, endCall]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size={isMobile ? "icon" : "default"}
          className={cn(
            "gap-2",
            isMobile ? "h-10 w-10 min-h-[44px] min-w-[44px]" : ""
          )}
        >
          <Phone className="h-4 w-4" />
          {!isMobile && "Dialer"}
        </Button>
      </DialogTrigger>
      <DialogContent 
        className={cn(
          "p-4",
          isMobile 
            ? "fixed inset-0 w-full h-full max-w-none max-h-none rounded-none m-0 flex flex-col" 
            : "sm:max-w-[380px]"
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-center text-xl">Voice Dialer</DialogTitle>
        </DialogHeader>
        
        <div className={cn(
          "space-y-4 flex-1 flex flex-col",
          isMobile && "pb-[env(safe-area-inset-bottom)]"
        )}>
          {view === 'search' && !isOnCall ? (
            <div className="flex-1 flex flex-col">
              <Command className="rounded-xl border flex-1">
                <CommandInput 
                  placeholder="Search owners, leads, addresses..." 
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  className={isMobile ? "h-12 text-base" : ""}
                />
                <CommandList className={isMobile ? "max-h-none flex-1" : "max-h-64"}>
                  <CommandEmpty>No contacts found.</CommandEmpty>
                  <CommandGroup>
                    {filteredContacts.slice(0, isMobile ? 20 : 15).map((contact) => (
                      <CommandItem
                        key={`${contact.type}-${contact.id}`}
                        onSelect={() => handleSelectContact(contact)}
                        className={cn(
                          "cursor-pointer",
                          isMobile ? "py-4 px-3" : "py-2"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn(
                            "rounded-full bg-muted flex items-center justify-center shrink-0",
                            isMobile ? "h-10 w-10" : "h-8 w-8"
                          )}>
                            {contact.type === 'owner' ? (
                              <Home className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                            ) : (
                              <User className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "font-medium truncate",
                                isMobile ? "text-base" : "text-sm"
                              )}>{contact.name}</p>
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-xs shrink-0",
                                contact.type === 'owner' ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-700"
                              )}>{contact.type}</span>
                            </div>
                            <p className={cn(
                              "text-muted-foreground",
                              isMobile ? "text-sm" : "text-xs"
                            )}>{formatPhoneForDisplay(contact.phone)}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "rounded-full bg-green-100 hover:bg-green-200 text-green-700",
                                isMobile ? "h-10 w-10" : "h-8 w-8"
                              )}
                              onClick={(e) => handleCallContact(contact, e)}
                              disabled={isConnecting}
                            >
                              <Phone className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700",
                                isMobile ? "h-10 w-10" : "h-8 w-8"
                              )}
                              onClick={(e) => handleTextContact(contact, e)}
                              disabled={isSendingSMS}
                            >
                              <MessageSquare className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                            </Button>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              
              <Button 
                variant="outline" 
                className={cn(
                  "w-full mt-4",
                  isMobile ? "h-14 text-base" : ""
                )}
                onClick={() => setView('dialer')}
              >
                <Phone className="h-5 w-5 mr-2" />
                Manual dial
              </Button>
            </div>
          ) : (
            <div className={cn(
              "flex-1 flex flex-col min-h-0 overflow-y-auto",
              isMobile && "pb-4"
            )}>
              {selectedContact && !isOnCall && (
                <div className="p-4 bg-muted rounded-xl mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "rounded-full bg-primary/10 flex items-center justify-center",
                      isMobile ? "h-12 w-12" : "h-10 w-10"
                    )}>
                      {selectedContact.type === 'owner' ? (
                        <Home className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
                      ) : (
                        <User className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        isMobile ? "text-lg" : "text-base"
                      )}>{selectedContact.name}</p>
                      {selectedContact.address && (
                        <p className={cn(
                          "text-muted-foreground truncate",
                          isMobile ? "text-sm" : "text-xs"
                        )}>{selectedContact.address}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
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
                <div className="text-center text-green-600 font-semibold text-lg py-3">
                  Connected • {formatDuration(callDuration)}
                </div>
              )}

              <div className={cn(
                "grid grid-cols-3 my-4",
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

              <div className={cn(
                "flex gap-3 shrink-0 pt-4",
                isMobile ? "" : ""
              )}>
                {!isOnCall && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleClear}
                      disabled={isConnecting}
                      className={isMobile ? "h-14 w-14" : "h-12 w-12"}
                    >
                      <User className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSendSMS}
                      disabled={!phoneNumber || isSendingSMS || isConnecting}
                      className={isMobile ? "h-14 w-14" : "h-12 w-12"}
                    >
                      {isSendingSMS ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-5 w-5" />
                      )}
                    </Button>
                  </>
                )}
                
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceDialer;
