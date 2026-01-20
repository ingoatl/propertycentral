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

  // Fetch leads and owners for contact search
  const { data: contacts = [] } = useQuery({
    queryKey: ["quick-contacts", search],
    queryFn: async () => {
      const results: Contact[] = [];

      // Search leads
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, phone, email")
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(10);

      if (leads) {
        results.push(
          ...leads.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone,
            email: l.email,
            type: "lead" as const,
          }))
        );
      }

      // Search owners
      const { data: owners } = await supabase
        .from("property_owners")
        .select("id, name, phone, email")
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(10);

      if (owners) {
        results.push(
          ...owners.map((o) => ({
            id: o.id,
            name: o.name,
            phone: o.phone,
            email: o.email,
            type: "owner" as const,
          }))
        );
      }

      return results;
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
    setShowVoicemail(true);
    setOpen(false);
  };

  const handleDialpadVideoMessage = () => {
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
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        {/* Contact Info */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm truncate block">{contact.name}</span>
                            {contact.phone && (
                              <span className="text-xs text-muted-foreground">
                                {formatPhoneForDisplay(contact.phone)}
                              </span>
                            )}
                          </div>
                          <Badge variant={contact.type === "lead" ? "default" : "secondary"} className="text-xs shrink-0">
                            {contact.type}
                          </Badge>
                        </div>
                        
                        {/* Communication Buttons - Always visible */}
                        {contact.phone && (
                          <div className="space-y-2">
                            {/* Primary 4 buttons */}
                            <div className="grid grid-cols-4 gap-1.5">
                              <Button
                                variant="default"
                                size="sm"
                                className="flex-col h-12 min-w-0 px-1 bg-primary hover:bg-primary/90 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCall(contact);
                                }}
                              >
                                <Phone className="h-4 w-4 shrink-0" />
                                <span className="text-[10px]">Call</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-col h-12 min-w-0 px-1 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleText(contact);
                                }}
                              >
                                <MessageSquare className="h-4 w-4 shrink-0" />
                                <span className="text-[10px]">Text</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-col h-12 min-w-0 px-1 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVoicemail(contact);
                                }}
                              >
                                <Mic className="h-4 w-4 shrink-0" />
                                <span className="text-[10px]">Voice</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-col h-12 min-w-0 px-1 touch-manipulation"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVideoMessage(contact);
                                }}
                              >
                                <Video className="h-4 w-4 shrink-0" />
                                <span className="text-[10px]">Video</span>
                              </Button>
                            </div>
                            
                            {/* Record Meeting button */}
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full gap-2 touch-manipulation"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRecordMeeting(contact);
                              }}
                            >
                              <Camera className="h-4 w-4" />
                              <span className="text-xs">Record Meeting</span>
                            </Button>
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
