import { useState, useEffect } from "react";
import {
  Send,
  Mail,
  MessageSquare,
  Loader2,
  User,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  Search,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UnifiedComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "sms" | "email" | "ai";
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
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

const SMS_TEMPLATES = [
  {
    label: "Check-in",
    content: "Hi {{name}}, just checking in to see if you have any questions. Let me know if there's anything I can help with!",
  },
  {
    label: "Follow Up",
    content: "Hi {{name}}, following up on our recent conversation. Would you have some time this week to discuss further?",
  },
  {
    label: "Schedule",
    content: "Hi {{name}}, I'd love to schedule a call to discuss your property. What times work best for you this week?",
  },
  {
    label: "Thanks",
    content: "Hi {{name}}, thank you for your time today. I'll follow up with the information we discussed shortly.",
  },
];

export function UnifiedComposeDialog({
  open,
  onOpenChange,
  defaultTab = "email",
}: UnifiedComposeDialogProps) {
  const [activeTab, setActiveTab] = useState<"sms" | "email" | "ai">(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Email state
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // SMS state
  const [smsMessage, setSmsMessage] = useState("");

  // AI Compose state
  const [aiContext, setAiContext] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiBody, setAiBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const queryClient = useQueryClient();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedContact(null);
      setSearchQuery("");
      setSubject("");
      setEmailBody("");
      setSmsMessage("");
      setAiContext("");
      setAiSubject("");
      setAiBody("");
      setIsExpanded(false);
    }
  }, [open]);

  // Fetch contacts (leads and owners)
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["compose-contacts", searchQuery],
    queryFn: async () => {
      const results: Contact[] = [];

      // Fetch leads
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, email, phone")
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(15);

      if (leads) {
        leads.forEach((lead) => {
          results.push({
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            type: "lead",
          });
        });
      }

      // Fetch property owners
      const { data: owners } = await supabase
        .from("property_owners")
        .select("id, name, email, phone")
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(15);

      if (owners) {
        owners.forEach((owner) => {
          results.push({
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
            type: "owner",
          });
        });
      }

      return results;
    },
    enabled: open,
  });

  // Send Email mutation
  const sendEmail = useMutation({
    mutationFn: async () => {
      if (!selectedContact?.email) throw new Error("No email address");
      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          to: selectedContact.email,
          toName: selectedContact.name,
          subject: activeTab === "ai" ? aiSubject : subject,
          body: activeTab === "ai" ? aiBody : emailBody,
          contactType: selectedContact.type,
          contactId: selectedContact.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent!");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  // Send SMS mutation
  const sendSms = useMutation({
    mutationFn: async () => {
      if (!selectedContact?.phone) throw new Error("No phone number");
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          leadId: selectedContact.type === "lead" ? selectedContact.id : undefined,
          ownerId: selectedContact.type === "owner" ? selectedContact.id : undefined,
          phone: selectedContact.phone,
          message: smsMessage,
          fromNumber: "+14048005932",
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send SMS");
      return data;
    },
    onSuccess: () => {
      toast.success("SMS sent!");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send SMS: ${error.message}`);
    },
  });

  // Generate AI draft
  const generateAIDraft = async () => {
    if (!selectedContact || !aiContext.trim()) {
      toast.error("Please select a contact and provide context");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compose-email", {
        body: {
          recipientName: selectedContact.name,
          recipientEmail: selectedContact.email,
          context: aiContext,
          includeCalendarLink: aiContext.toLowerCase().includes("schedule") || aiContext.toLowerCase().includes("call"),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiSubject(data.subject || "");
      setAiBody(data.body || "");
      toast.success("AI draft generated!");
    } catch (error: any) {
      toast.error(`Failed to generate draft: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Apply templates
  const applyEmailTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
    if (!selectedContact) return;
    const firstName = selectedContact.name.split(" ")[0];
    setSubject(template.subject);
    setEmailBody(template.content.replace(/{{name}}/g, firstName));
  };

  const applySmsTemplate = (template: typeof SMS_TEMPLATES[0]) => {
    if (!selectedContact) return;
    const firstName = selectedContact.name.split(" ")[0];
    setSmsMessage(template.content.replace(/{{name}}/g, firstName));
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const characterCount = smsMessage.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  const canSend = () => {
    if (!selectedContact) return false;
    if (activeTab === "sms") return !!smsMessage.trim() && !!selectedContact.phone;
    if (activeTab === "email") return !!subject.trim() && !!emailBody.trim() && !!selectedContact.email;
    if (activeTab === "ai") return !!aiSubject.trim() && !!aiBody.trim() && !!selectedContact.email;
    return false;
  };

  const handleSend = () => {
    if (activeTab === "sms") {
      sendSms.mutate();
    } else {
      sendEmail.mutate();
    }
  };

  const isPending = sendEmail.isPending || sendSms.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "p-0 gap-0 overflow-hidden transition-all duration-200",
        isExpanded ? "max-w-4xl h-[90vh]" : "max-w-lg max-h-[85vh]"
      )}>
        {/* Gmail-style Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">New Message</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Message Type Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sms" | "email" | "ai")} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b h-auto p-0">
            <TabsTrigger 
              value="email" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3 gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger 
              value="sms" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3 gap-2"
              disabled={selectedContact ? !selectedContact.phone : false}
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              AI Compose
            </TabsTrigger>
          </TabsList>

          {/* Contact Selection */}
          {!selectedContact ? (
            <div className="p-4 space-y-3 flex-1 flex flex-col">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads or owners by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <ScrollArea className="flex-1 border rounded-lg min-h-[200px]">
                {contactsLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Searching contacts...</p>
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery ? "No contacts found" : "Start typing to search"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {contacts.map((contact) => (
                      <div
                        key={`${contact.type}-${contact.id}`}
                        onClick={() => setSelectedContact(contact)}
                        className="p-3 hover:bg-muted cursor-pointer flex items-center gap-3 transition-colors"
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
                          contact.type === "owner" ? "bg-emerald-500" : "bg-primary"
                        )}>
                          {getInitials(contact.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {contact.email && <span className="truncate">{contact.email}</span>}
                            {contact.email && contact.phone && <span>•</span>}
                            {contact.phone && <span>{contact.phone}</span>}
                          </div>
                        </div>
                        <Badge 
                          variant={contact.type === "owner" ? "secondary" : "default"}
                          className={cn(
                            "text-xs",
                            contact.type === "owner" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          )}
                        >
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
              {/* Selected Contact Header */}
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
                <span className="text-sm text-muted-foreground">To:</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium",
                    selectedContact.type === "owner" ? "bg-emerald-500" : "bg-primary"
                  )}>
                    {getInitials(selectedContact.name)}
                  </div>
                  <span className="font-medium text-sm">{selectedContact.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {activeTab === "sms" ? selectedContact.phone : selectedContact.email}
                  </span>
                  <Badge variant="outline" className="text-xs ml-1">
                    {selectedContact.type}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSelectedContact(null)}
                >
                  Change
                </Button>
              </div>

              {/* Email Tab Content */}
              <TabsContent value="email" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
                <div className="flex-1 flex flex-col p-4 space-y-3 overflow-auto">
                  {/* Quick Templates */}
                  <div className="flex flex-wrap gap-2">
                    {EMAIL_TEMPLATES.map((template, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => applyEmailTemplate(template)}
                        className="text-xs h-7"
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>

                  {/* Subject */}
                  <Input
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
                  />

                  {/* Body */}
                  <Textarea
                    placeholder="Compose your email..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className={cn(
                      "flex-1 min-h-[200px] resize-none border-0 focus-visible:ring-0 px-0",
                      isExpanded && "min-h-[400px]"
                    )}
                  />
                </div>
              </TabsContent>

              {/* SMS Tab Content */}
              <TabsContent value="sms" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
                <div className="flex-1 flex flex-col p-4 space-y-3 overflow-auto">
                  {/* Quick Templates */}
                  <div className="flex flex-wrap gap-2">
                    {SMS_TEMPLATES.map((template, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => applySmsTemplate(template)}
                        className="text-xs h-7 rounded-full"
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>

                  {/* Message */}
                  <Textarea
                    placeholder="Type your message..."
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    className="flex-1 min-h-[150px] resize-none rounded-xl"
                  />

                  {/* Character count */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{characterCount} characters</span>
                    <span>
                      {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* AI Compose Tab Content */}
              <TabsContent value="ai" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
                <div className="flex-1 flex flex-col p-4 space-y-3 overflow-auto">
                  {/* Context Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      What do you want to say?
                    </label>
                    <Textarea
                      placeholder="Describe what you want to communicate... e.g., 'Follow up about their property management inquiry, mention our competitive rates and offer to schedule a call'"
                      value={aiContext}
                      onChange={(e) => setAiContext(e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                    <Button
                      onClick={generateAIDraft}
                      disabled={isGenerating || !aiContext.trim()}
                      className="w-full gap-2"
                      variant="secondary"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Draft
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Generated Email Preview */}
                  {(aiSubject || aiBody) && (
                    <div className="space-y-3 pt-3 border-t">
                      <label className="text-sm font-medium text-muted-foreground">Generated Email</label>
                      <Input
                        placeholder="Subject"
                        value={aiSubject}
                        onChange={(e) => setAiSubject(e.target.value)}
                        className="border-0 border-b rounded-none px-0 focus-visible:ring-0 font-medium"
                      />
                      <Textarea
                        placeholder="Email body..."
                        value={aiBody}
                        onChange={(e) => setAiBody(e.target.value)}
                        className={cn(
                          "min-h-[150px] resize-none border-0 focus-visible:ring-0 px-0",
                          isExpanded && "min-h-[300px]"
                        )}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Footer Actions */}
        {selectedContact && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {activeTab === "sms" && !selectedContact.phone && (
                <span className="text-destructive">No phone number available</span>
              )}
              {activeTab !== "sms" && !selectedContact.email && (
                <span className="text-destructive">No email address available</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend() || isPending}
                className="gap-2"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
