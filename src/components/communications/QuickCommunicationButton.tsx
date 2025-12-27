import { useState } from "react";
import { Phone, MessageSquare, Search, X } from "lucide-react";
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
import VoiceDialer from "@/components/leads/VoiceDialer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: "lead" | "owner";
}

export function QuickCommunicationButton() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showSMS, setShowSMS] = useState(false);
  const [showDialer, setShowDialer] = useState(false);

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

  const handleCall = (contact: Contact) => {
    // Open the dialer with pre-filled number - we'll use a different approach
    setSelectedContact(contact);
    // Just close the popover - the dialer is a separate component
    setOpen(false);
  };

  const handleText = (contact: Contact) => {
    setSelectedContact(contact);
    setShowSMS(true);
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
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads or owners..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
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
                          {contact.phone}
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
                          >
                            <Phone className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleText(contact)}
                          >
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

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
    </>
  );
}
