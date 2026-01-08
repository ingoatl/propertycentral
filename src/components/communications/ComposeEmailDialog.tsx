import { useState } from "react";
import { Send, Mail, Loader2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  type: "lead" | "owner";
}

const EMAIL_TEMPLATES = [
  {
    label: "Follow Up",
    subject: "Following up on our conversation",
    content: `Hi {{name}},

I wanted to follow up on our recent conversation about property management services. 

Do you have any questions I can help answer? I'm happy to schedule a call at your convenience.

Best regards,
The PeachHaus Team`,
  },
  {
    label: "Property Info",
    subject: "Your Property Management Information",
    content: `Hi {{name}},

Thank you for your interest in PeachHaus property management services. 

I'd love to learn more about your property and discuss how we can help maximize your rental income while taking care of all the details.

Would you be available for a brief call this week?

Best regards,
The PeachHaus Team`,
  },
  {
    label: "Thank You",
    subject: "Thank you for your time",
    content: `Hi {{name}},

Thank you for taking the time to speak with me today. I really enjoyed learning about your property.

As discussed, I'll follow up with the next steps shortly. In the meantime, please don't hesitate to reach out if you have any questions.

Best regards,
The PeachHaus Team`,
  },
];

export function ComposeEmailDialog({
  open,
  onOpenChange,
}: ComposeEmailDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();

  // Fetch leads and owners for contact selection
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["email-contacts", searchQuery],
    queryFn: async () => {
      const results: Contact[] = [];

      // Fetch leads
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, email")
        .not("email", "is", null)
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

      if (leads) {
        leads.forEach((lead) => {
          if (lead.email) {
            results.push({
              id: lead.id,
              name: lead.name,
              email: lead.email,
              type: "lead",
            });
          }
        });
      }

      // Fetch property owners
      const { data: owners } = await supabase
        .from("property_owners")
        .select("id, name, email")
        .not("email", "is", null)
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

      if (owners) {
        owners.forEach((owner) => {
          if (owner.email) {
            results.push({
              id: owner.id,
              name: owner.name,
              email: owner.email,
              type: "owner",
            });
          }
        });
      }

      return results;
    },
    enabled: open,
  });

  const sendEmail = useMutation({
    mutationFn: async () => {
      if (!selectedContact) throw new Error("Please select a contact");

      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          to: selectedContact.email,
          toName: selectedContact.name,
          subject,
          body,
          contactType: selectedContact.type,
          contactId: selectedContact.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully!");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedContact(null);
    setSubject("");
    setBody("");
    setSearchQuery("");
  };

  const applyTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
    if (!selectedContact) {
      toast.error("Please select a contact first");
      return;
    }
    const firstName = selectedContact.name.split(" ")[0];
    setSubject(template.subject);
    setBody(template.content.replace(/{{name}}/g, firstName));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact Selection */}
          {!selectedContact ? (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  placeholder="Search for a lead or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <ScrollArea className="h-48 border rounded-md">
                {contactsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {searchQuery ? "No contacts found" : "Type to search contacts"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {contacts.map((contact) => (
                      <div
                        key={`${contact.type}-${contact.id}`}
                        onClick={() => setSelectedContact(contact)}
                        className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3"
                      >
                        <div className="p-2 rounded-full bg-muted">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-muted-foreground">{contact.email}</p>
                        </div>
                        <Badge variant={contact.type === "lead" ? "default" : "secondary"}>
                          {contact.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <>
              {/* Selected contact display */}
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm">To:</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {selectedContact.name} &lt;{selectedContact.email}&gt;
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-auto text-xs"
                  onClick={() => setSelectedContact(null)}
                >
                  Change
                </Button>
              </div>

              {/* Quick templates */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quick Templates</label>
                <div className="flex flex-wrap gap-2">
                  {EMAIL_TEMPLATES.map((template, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate(template)}
                      className="text-xs"
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Subject input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input
                  placeholder="Email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Body input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Type your email message..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
              </div>

              {/* Send button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => sendEmail.mutate()}
                  disabled={!subject.trim() || !body.trim() || sendEmail.isPending}
                >
                  {sendEmail.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {sendEmail.isPending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
