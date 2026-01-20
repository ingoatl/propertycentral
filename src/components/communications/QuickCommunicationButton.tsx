import { useState } from "react";
import { Phone, MessageSquare, X, Delete, Users, Grid3X3, Mic, Video, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SendSMSDialog } from "./SendSMSDialog";
import { CallDialog } from "./CallDialog";
import { SendVoicemailDialog } from "./SendVoicemailDialog";
import { MeetingsDialog } from "./MeetingsDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatPhoneForDisplay } from "@/lib/phoneUtils";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: "lead" | "owner";
}

const dialPad = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export function QuickCommunicationButton() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showSMS, setShowSMS] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [showVoicemail, setShowVoicemail] = useState(false);
  const [showVideoMessage, setShowVideoMessage] = useState(false);
  const [showRecordMeeting, setShowRecordMeeting] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "dialpad">("search");

  // Helper to normalize phone numbers for comparison
  const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/\D/g, '').slice(-10);
  };

  // Fetch leads and owners for contact search with deduplication
  const { data: contacts = [] } = useQuery({
    queryKey: ["quick-contacts", search],
    queryFn: async () => {
      // Fetch owners first (they take priority)
      const { data: owners } = await supabase
        .from("property_owners")
        .select("id, name, phone, email")
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(10);

      const ownerContacts: Contact[] = (owners || []).map((o) => ({
        id: o.id,
        name: o.name,
        phone: o.phone,
        email: o.email,
        type: "owner" as const,
      }));

      // Create a set of owner phone numbers and names for deduplication
      const ownerPhones = new Set(
        ownerContacts.map(o => cleanPhoneNumber(o.phone || '')).filter(Boolean)
      );
      const ownerNames = new Set(
        ownerContacts.map(o => o.name.toLowerCase().trim())
      );

      // Fetch leads, excluding ops_handoff stage
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, phone, email, stage")
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        .neq('stage', 'ops_handoff')
        .limit(10);

      // Filter out leads that match owners by phone OR name
      const leadContacts: Contact[] = (leads || [])
        .filter(l => {
          const cleanedPhone = cleanPhoneNumber(l.phone || '');
          const normalizedName = l.name.toLowerCase().trim();
          // Exclude if phone matches OR name matches an owner
          const phoneMatch = cleanedPhone && ownerPhones.has(cleanedPhone);
          const nameMatch = ownerNames.has(normalizedName);
          return !phoneMatch && !nameMatch;
        })
        .map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          type: "lead" as const,
        }));

      // Return owners first, then leads
      return [...ownerContacts, ...leadContacts];
    },
    enabled: search.length >= 2,
  });

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleDialpadCall = () => {
    if (phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSelectedContact({
      id: "manual",
      name: formatPhoneForDisplay(phoneNumber),
      phone: phoneNumber,
      email: null,
      type: "lead",
    });
    setShowCall(true);
    setOpen(false);
  };

  const handleDialpadSMS = () => {
    if (phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSelectedContact({
      id: "manual",
      name: formatPhoneForDisplay(phoneNumber),
      phone: phoneNumber,
      email: null,
      type: "lead",
    });
    setShowSMS(true);
    setOpen(false);
  };

  const handleCall = (contact: Contact) => {
    if (!contact.phone) {
      toast.error("No phone number available");
      return;
    }
    setSelectedContact(contact);
    setShowCall(true);
    setOpen(false);
  };

  const handleText = (contact: Contact) => {
    setSelectedContact(contact);
    setShowSMS(true);
    setOpen(false);
  };

  const handleVoicemail = (contact: Contact) => {
    if (!contact.phone) {
      toast.error("No phone number available");
      return;
    }
    setSelectedContact(contact);
    setShowVoicemail(true);
    setOpen(false);
  };

  const handleVideoMessage = (contact: Contact) => {
    if (!contact.phone) {
      toast.error("No phone number available");
      return;
    }
    setSelectedContact(contact);
    setShowVideoMessage(true);
    setOpen(false);
  };

  const handleRecordMeeting = (contact: Contact) => {
    setSelectedContact(contact);
    setShowRecordMeeting(true);
    setOpen(false);
  };

  const handleDialpadVoicemail = () => {
    // Clean and validate phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (cleanedPhone.length > 10) {
      toast.error(`Phone number too long: ${cleanedPhone.length} digits (max 10)`);
      return;
    }
    setSelectedContact({
      id: "manual",
      name: formatPhoneForDisplay(cleanedPhone),
      phone: cleanedPhone,
      email: null,
      type: "lead",
    });
    setShowVoicemail(true);
    setOpen(false);
  };

  const handleDialpadVideoMessage = () => {
    // Clean and validate phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (cleanedPhone.length > 10) {
      toast.error(`Phone number too long: ${cleanedPhone.length} digits (max 10)`);
      return;
    }
    setSelectedContact({
      id: "manual",
      name: formatPhoneForDisplay(cleanedPhone),
      phone: cleanedPhone,
      email: null,
      type: "lead",
    });
    setShowVideoMessage(true);
    setOpen(false);
  };

  const handleDialpadRecordMeeting = () => {
    if (phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSelectedContact({
      id: "manual",
      name: formatPhoneForDisplay(phoneNumber),
      phone: phoneNumber,
      email: null,
      type: "lead",
    });
    setShowRecordMeeting(true);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="default" 
            size="sm" 
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Dial / Text</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "dialpad")}>
            <div className="border-b px-2 pt-2">
              <TabsList className="w-full">
                <TabsTrigger value="search" className="flex-1 gap-2">
                  <Users className="h-4 w-4" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="dialpad" className="flex-1 gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Dialpad
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="search" className="m-0">
              <div className="p-3 border-b">
                <Input
                  placeholder="Search leads or owners..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <ScrollArea className="max-h-[350px]">
                {search.length < 2 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No contacts found
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {contacts.map((contact) => (
                      <div
                        key={`${contact.type}-${contact.id}`}
                        className="p-3 rounded-2xl bg-card border border-border/50 hover:bg-muted/30 transition-all duration-150"
                      >
                        {/* Contact Info - Apple style */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {contact.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm text-foreground block truncate">{contact.name}</span>
                            {contact.phone && (
                              <span className="text-xs text-muted-foreground">
                                {formatPhoneForDisplay(contact.phone)}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            contact.type === "owner" 
                              ? "bg-secondary text-secondary-foreground" 
                              : "bg-primary/10 text-primary"
                          }`}>
                            {contact.type}
                          </span>
                        </div>
                        {/* Communication Buttons - Always visible */}
                        {contact.phone && (
                          <div className="space-y-2.5">
                            {/* Apple-style action buttons */}
                            <div className="grid grid-cols-4 gap-2">
                              <button
                                className="flex flex-col items-center justify-center h-14 rounded-xl bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all duration-150 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCall(contact);
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center mb-1">
                                  <Phone className="h-4 w-4 text-primary-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-foreground">Call</span>
                              </button>
                              <button
                                className="flex flex-col items-center justify-center h-14 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all duration-150 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleText(contact);
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mb-1">
                                  <MessageSquare className="h-4 w-4 text-secondary-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-foreground">Text</span>
                              </button>
                              <button
                                className="flex flex-col items-center justify-center h-14 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all duration-150 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVoicemail(contact);
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mb-1">
                                  <Mic className="h-4 w-4 text-secondary-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-foreground">Voice</span>
                              </button>
                              <button
                                className="flex flex-col items-center justify-center h-14 rounded-xl bg-muted hover:bg-muted/80 active:scale-95 transition-all duration-150 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVideoMessage(contact);
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center mb-1">
                                  <Video className="h-4 w-4 text-secondary-foreground" />
                                </div>
                                <span className="text-[10px] font-medium text-foreground">Video</span>
                              </button>
                            </div>
                            
                            {/* Record Meeting button - Apple style */}
                            <button
                              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] transition-all duration-150 touch-manipulation"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRecordMeeting(contact);
                              }}
                            >
                              <Camera className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-medium text-foreground">Record Meeting</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dialpad" className="m-0 p-3 space-y-3">
              {/* Phone number display */}
              <div className="relative">
                <Input
                  value={formatPhoneForDisplay(phoneNumber)}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter phone number"
                  className="text-center text-xl font-medium h-12 pr-10"
                />
                {phoneNumber && (
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

              {/* Dial pad */}
              <div className="grid grid-cols-3 gap-2">
                {dialPad.flat().map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="h-12 text-xl font-medium touch-manipulation"
                    onClick={() => handleDigitPress(digit)}
                  >
                    {digit}
                  </Button>
                ))}
              </div>

              {/* Action buttons - 4-button grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <Button
                  size="sm"
                  className="flex-col h-12 min-w-0 px-1 bg-primary hover:bg-primary/90 touch-manipulation"
                  onClick={handleDialpadCall}
                  disabled={phoneNumber.length < 10}
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] truncate">Call</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-col h-12 min-w-0 px-1 touch-manipulation"
                  onClick={handleDialpadSMS}
                  disabled={phoneNumber.length < 10}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] truncate">Text</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-col h-12 min-w-0 px-1 touch-manipulation"
                  onClick={handleDialpadVoicemail}
                  disabled={phoneNumber.length < 10}
                >
                  <Mic className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] truncate">Voice</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-col h-12 min-w-0 px-1 touch-manipulation"
                  onClick={handleDialpadVideoMessage}
                  disabled={phoneNumber.length < 10}
                >
                  <Video className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] truncate">Video</span>
                </Button>
              </div>

              {/* Record Meeting button */}
              <Button
                size="sm"
                variant="secondary"
                className="w-full gap-2 touch-manipulation"
                onClick={handleDialpadRecordMeeting}
                disabled={phoneNumber.length < 10}
              >
                <Camera className="h-4 w-4" />
                <span className="text-xs">Record Meeting</span>
              </Button>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {/* Call Dialog */}
      {selectedContact && (
        <CallDialog
          open={showCall}
          onOpenChange={setShowCall}
          contactName={selectedContact.name}
          contactPhone={selectedContact.phone || ""}
          contactType={selectedContact.type}
        />
      )}

      {/* SMS Dialog */}
      {selectedContact && (
        <SendSMSDialog
          open={showSMS}
          onOpenChange={setShowSMS}
          contactName={selectedContact.name}
          contactPhone={selectedContact.phone || ""}
          contactType={selectedContact.type}
          contactId={selectedContact.id}
        />
      )}

      {/* Voice Message Dialog */}
      {selectedContact && selectedContact.phone && (
        <SendVoicemailDialog
          open={showVoicemail}
          onOpenChange={setShowVoicemail}
          recipientPhone={selectedContact.phone}
          recipientName={selectedContact.name}
          leadId={selectedContact.type === "lead" && selectedContact.id !== "manual" ? selectedContact.id : undefined}
          ownerId={selectedContact.type === "owner" && selectedContact.id !== "manual" ? selectedContact.id : undefined}
        />
      )}

      {/* Video Message Dialog - Uses SendVoicemailDialog with video tab */}
      {selectedContact && selectedContact.phone && (
        <SendVoicemailDialog
          open={showVideoMessage}
          onOpenChange={setShowVideoMessage}
          recipientPhone={selectedContact.phone}
          recipientName={selectedContact.name}
          leadId={selectedContact.type === "lead" && selectedContact.id !== "manual" ? selectedContact.id : undefined}
          ownerId={selectedContact.type === "owner" && selectedContact.id !== "manual" ? selectedContact.id : undefined}
        />
      )}

      {/* Record Meeting Dialog */}
      {selectedContact && (
        <MeetingsDialog
          open={showRecordMeeting}
          onOpenChange={setShowRecordMeeting}
          contactName={selectedContact.name}
          contactEmail={selectedContact.email}
        />
      )}
    </>
  );
}
