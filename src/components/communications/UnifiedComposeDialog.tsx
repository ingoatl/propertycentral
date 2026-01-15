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
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  commCount: number;
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
    content: "Hi {{name}}, just checking in! Any questions about property management? Happy to help!",
  },
  {
    label: "Follow Up",
    content: "Hi {{name}}, following up on our chat. Would you have some time this week to discuss further?",
  },
  {
    label: "Schedule",
    content: "Hi {{name}}, I'd love to schedule a quick call about your property. What times work best?",
  },
  {
    label: "Thanks",
    content: "Hi {{name}}, thanks for your time today! I'll follow up with that info shortly.",
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
  const [smsTone, setSmsTone] = useState<string>("professional");
  const [smsAiContext, setSmsAiContext] = useState("");
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);

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
      setSmsAiContext("");
      setAiContext("");
      setAiSubject("");
      setAiBody("");
      setIsExpanded(false);
    }
  }, [open]);

  // Fetch contacts with communication frequency
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["compose-contacts-v2", searchQuery],
    queryFn: async () => {
      const results: Contact[] = [];

      // Fetch leads with communication counts
      const { data: leads } = await supabase
        .from("leads")
        .select(`
          id, 
          name, 
          email, 
          phone,
          lead_communications(id)
        `)
        .or(searchQuery ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%` : "name.neq.")
        .limit(20);

      if (leads) {
        leads.forEach((lead) => {
          const commCount = Array.isArray(lead.lead_communications) ? lead.lead_communications.length : 0;
          results.push({
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            type: "lead",
            commCount,
          });
        });
      }

      // Fetch property owners
      const { data: owners } = await supabase
        .from("property_owners")
        .select("id, name, email, phone")
        .or(searchQuery ? `name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%` : "name.neq.")
        .limit(15);

      if (owners) {
        owners.forEach((owner) => {
          results.push({
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
            type: "owner",
            commCount: 0,
          });
        });
      }

      // Sort by communication count (most communicated first)
      return results.sort((a, b) => b.commCount - a.commCount);
    },
    enabled: open,
  });

  // Recent contacts (top 5 most contacted)
  const recentContacts = contacts.filter(c => c.commCount > 0).slice(0, 5);

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

  // Generate AI Email draft
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

  // Generate AI SMS
  const generateAISms = async () => {
    if (!selectedContact || !smsAiContext.trim()) {
      toast.error("Please provide context for the SMS");
      return;
    }

    setIsGeneratingSms(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-compose-sms", {
        body: {
          recipientName: selectedContact.name,
          context: smsAiContext,
          tone: smsTone,
          includeLink: smsAiContext.toLowerCase().includes("schedule") || smsAiContext.toLowerCase().includes("book"),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSmsMessage(data.message || "");
      setSmsAiContext("");
      toast.success("AI SMS generated!");
    } catch (error: any) {
      toast.error(`Failed to generate SMS: ${error.message}`);
    } finally {
      setIsGeneratingSms(false);
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

  // Auto-switch to SMS if contact has no email but has phone
  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    if (!contact.email && contact.phone && activeTab === "email") {
      setActiveTab("sms");
      toast.info("Switched to SMS - no email available for this contact");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "p-0 gap-0 flex flex-col transition-all duration-200",
        isExpanded ? "max-w-4xl h-[90vh]" : "max-w-lg h-[80vh] max-h-[700px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sms" | "email" | "ai")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b h-auto p-0 shrink-0">
            <TabsTrigger 
              value="email" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 gap-1.5 text-xs"
              disabled={selectedContact ? !selectedContact.email : false}
            >
              <Mail className="h-3.5 w-3.5" />
              Email
              {selectedContact && !selectedContact.email && (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="sms" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 gap-1.5 text-xs"
              disabled={selectedContact ? !selectedContact.phone : false}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              SMS
              {selectedContact && !selectedContact.phone && (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2.5 gap-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Compose
            </TabsTrigger>
          </TabsList>

          {/* Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!selectedContact ? (
              /* Contact Selection */
              <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>

                {/* Recent Contacts */}
                {!searchQuery && recentContacts.length > 0 && (
                  <div className="shrink-0 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Recently Contacted
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentContacts.map((contact) => (
                        <Button
                          key={`recent-${contact.type}-${contact.id}`}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 rounded-full"
                          onClick={() => handleContactSelect(contact)}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0",
                            contact.type === "owner" ? "bg-emerald-500" : "bg-primary"
                          )}>
                            {getInitials(contact.name)}
                          </div>
                          {contact.name.split(" ")[0]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact List */}
                <ScrollArea className="flex-1 border rounded-lg">
                  {contactsLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      <p className="text-sm">Searching...</p>
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
                          onClick={() => handleContactSelect(contact)}
                          className="p-3 hover:bg-muted/50 cursor-pointer flex items-center gap-3 transition-colors"
                        >
                          <div className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0",
                            contact.type === "owner" ? "bg-emerald-500" : "bg-primary"
                          )}>
                            {getInitials(contact.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{contact.name}</p>
                              {contact.commCount > 0 && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                  {contact.commCount} msgs
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className={cn(
                                "flex items-center gap-1 text-xs",
                                contact.email ? "text-muted-foreground" : "text-muted-foreground/40"
                              )}>
                                <Mail className={cn("h-3 w-3", contact.email ? "text-green-500" : "text-muted-foreground/40")} />
                                {contact.email ? (
                                  <span className="truncate max-w-[140px]">{contact.email}</span>
                                ) : (
                                  <span className="italic">No email</span>
                                )}
                              </span>
                              <span className={cn(
                                "flex items-center gap-1 text-xs",
                                contact.phone ? "text-muted-foreground" : "text-muted-foreground/40"
                              )}>
                                <Phone className={cn("h-3 w-3", contact.phone ? "text-green-500" : "text-muted-foreground/40")} />
                                {contact.phone || <span className="italic">No phone</span>}
                              </span>
                            </div>
                          </div>
                          <Badge 
                            variant={contact.type === "owner" ? "secondary" : "default"}
                            className={cn(
                              "text-[10px] shrink-0",
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
                <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 shrink-0">
                  <span className="text-xs text-muted-foreground">To:</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0",
                      selectedContact.type === "owner" ? "bg-emerald-500" : "bg-primary"
                    )}>
                      {getInitials(selectedContact.name)}
                    </div>
                    <span className="font-medium text-sm truncate">{selectedContact.name}</span>
                    <div className="flex items-center gap-1.5">
                      {selectedContact.email && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Email
                        </span>
                      )}
                      {selectedContact.phone && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          SMS
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => setSelectedContact(null)}
                  >
                    Change
                  </Button>
                </div>

                {/* Email Tab */}
                <TabsContent value="email" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden min-h-0">
                  <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {EMAIL_TEMPLATES.map((template, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => applyEmailTemplate(template)}
                          className="text-xs h-7 rounded-full"
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                    <Input
                      placeholder="Subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="border-0 border-b rounded-none px-0 focus-visible:ring-0 shrink-0"
                    />
                    <Textarea
                      placeholder="Compose your email..."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className={cn(
                        "flex-1 min-h-[180px] resize-none border-0 focus-visible:ring-0 px-0",
                        isExpanded && "min-h-[350px]"
                      )}
                    />
                  </div>
                </TabsContent>

                {/* SMS Tab */}
                <TabsContent value="sms" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden min-h-0">
                  <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
                    {/* AI SMS Composer */}
                    <div className="border rounded-lg p-3 bg-muted/30 space-y-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium flex items-center gap-1.5">
                          <Wand2 className="h-3.5 w-3.5 text-primary" />
                          AI SMS Writer
                        </span>
                        <Select value={smsTone} onValueChange={setSmsTone}>
                          <SelectTrigger className="h-7 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="What do you want to say?"
                          value={smsAiContext}
                          onChange={(e) => setSmsAiContext(e.target.value)}
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && smsAiContext.trim()) {
                              generateAISms();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3 gap-1"
                          onClick={generateAISms}
                          disabled={isGeneratingSms || !smsAiContext.trim()}
                        >
                          {isGeneratingSms ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Templates */}
                    <div className="flex flex-wrap gap-1.5 shrink-0">
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
                      className="flex-1 min-h-[120px] resize-none rounded-lg"
                    />

                    {/* Character count */}
                    <div className="flex justify-between text-xs text-muted-foreground shrink-0">
                      <span className={cn(characterCount > 160 && "text-amber-500")}>
                        {characterCount} characters
                      </span>
                      <span className={cn(segmentCount > 1 && "text-amber-500")}>
                        {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* AI Compose Tab */}
                <TabsContent value="ai" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden min-h-0">
                  <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
                    <div className="space-y-2 shrink-0">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        What do you want to say?
                      </label>
                      <Textarea
                        placeholder="e.g., Follow up about their property management inquiry, mention our competitive rates and offer to schedule a call"
                        value={aiContext}
                        onChange={(e) => setAiContext(e.target.value)}
                        className="min-h-[70px] resize-none"
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
                            Generate Email Draft
                          </>
                        )}
                      </Button>
                    </div>

                    {(aiSubject || aiBody) && (
                      <div className="space-y-3 pt-3 border-t flex-1 flex flex-col min-h-0">
                        <label className="text-xs font-medium text-muted-foreground shrink-0">Generated Email</label>
                        <Input
                          placeholder="Subject"
                          value={aiSubject}
                          onChange={(e) => setAiSubject(e.target.value)}
                          className="border-0 border-b rounded-none px-0 focus-visible:ring-0 font-medium shrink-0"
                        />
                        <Textarea
                          placeholder="Email body..."
                          value={aiBody}
                          onChange={(e) => setAiBody(e.target.value)}
                          className={cn(
                            "flex-1 min-h-[140px] resize-none border-0 focus-visible:ring-0 px-0",
                            isExpanded && "min-h-[280px]"
                          )}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        {/* Footer */}
        {selectedContact && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 shrink-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {activeTab === "sms" && !selectedContact.phone && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No phone available
                </span>
              )}
              {activeTab !== "sms" && !selectedContact.email && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No email available
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!canSend() || isPending}
                className="gap-1.5"
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
