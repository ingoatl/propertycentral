import { useState } from "react";
import { Phone, MessageSquare, X, Delete, Users, Grid3X3, Mic, Video } from "lucide-react";
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

  // Using formatPhoneForDisplay from phoneUtils

  const handleDialpadCall = () => {
    if (phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    // Create a manual contact and open the call dialog
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

              <ScrollArea className="max-h-[300px]">
                {search.length < 2 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No contacts found
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {contacts.map((contact) => (
                      <div
                        key={`${contact.type}-${contact.id}`}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{contact.name}</span>
                            <Badge variant={contact.type === "lead" ? "default" : "secondary"} className="text-xs">
                              {contact.type}
                            </Badge>
                          </div>
                          {contact.phone && (
                            <div className="text-xs text-muted-foreground truncate">
                              {formatPhoneForDisplay(contact.phone)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {contact.phone && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCall(contact)}
                                title="Call"
                              >
                                <Phone className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleText(contact)}
                                title="Text"
                              >
                                <MessageSquare className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleVoicemail(contact)}
                                title="Voice Message"
                              >
                                <Mic className="h-4 w-4 text-amber-600" />
                              </Button>
                              {contact.type === "owner" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleVoicemail(contact)}
                                  title="Video Message"
                                >
                                  <Video className="h-4 w-4 text-purple-600" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
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
                    className="h-12 text-xl font-medium"
                    onClick={() => handleDigitPress(digit)}
                  >
                    {digit}
                  </Button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleDialpadCall}
                  disabled={phoneNumber.length < 10}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDialpadSMS}
                  disabled={phoneNumber.length < 10}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Text
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDialpadVoicemail}
                  disabled={phoneNumber.length < 10}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  VM
                </Button>
              </div>
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

      {/* Voicemail Dialog */}
      {selectedContact && selectedContact.phone && (
        <SendVoicemailDialog
          open={showVoicemail}
          onOpenChange={setShowVoicemail}
          recipientPhone={selectedContact.phone}
          recipientName={selectedContact.name}
          leadId={selectedContact.type === "lead" ? selectedContact.id : undefined}
          ownerId={selectedContact.type === "owner" ? selectedContact.id : undefined}
        />
      )}
    </>
  );
}
