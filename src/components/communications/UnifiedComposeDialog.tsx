import { useState, useEffect, useRef } from "react";
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
  Paperclip,
  Image as ImageIcon,
  Trash2,
  Mic,
} from "lucide-react";
import { VoiceDictationButton } from "./VoiceDictationButton";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
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
  {
    label: "Owner Portal",
    content: "Hi {{name}}, here's a look at our Owner Portal - the most transparent property management experience: https://propertycentral.lovable.app/owner-portal-presentation",
  },
  {
    label: "Presentations",
    content: "Hi {{name}}, check out what makes PeachHaus different:\n• Owner Portal: propertycentral.lovable.app/owner-portal-presentation\n• Onboarding: propertycentral.lovable.app/onboarding-presentation\n• Design Services: propertycentral.lovable.app/designer-presentation",
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
  const [emailAttachments, setEmailAttachments] = useState<UploadedFile[]>([]);

  // SMS state
  const [smsMessage, setSmsMessage] = useState("");
  const [smsTone, setSmsTone] = useState<string>("professional");
  const [smsAiContext, setSmsAiContext] = useState("");
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);
  const [smsAttachments, setSmsAttachments] = useState<UploadedFile[]>([]);

  // AI Compose state
  const [aiContext, setAiContext] = useState("");
  const [aiSubject, setAiSubject] = useState("");
  const [aiBody, setAiBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const emailFileRef = useRef<HTMLInputElement>(null);
  const smsFileRef = useRef<HTMLInputElement>(null);

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
      setEmailAttachments([]);
      setSmsAttachments([]);
    }
  }, [open]);

  // Upload file to Supabase storage
  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Upload failed: ${uploadError.message}`);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath);

      return {
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
      return null;
    }
  };

  // Handle file selection
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'email' | 'sms'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      // Validate file size (max 5MB for MMS)
      if (target === 'sms' && file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 5MB for MMS.`);
        continue;
      }
      // Validate file type for SMS (images only)
      if (target === 'sms' && !file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image. SMS only supports images.`);
        continue;
      }

      const uploaded = await uploadFile(file);
      if (uploaded) {
        uploadedFiles.push(uploaded);
      }
    }

    if (target === 'email') {
      setEmailAttachments(prev => [...prev, ...uploadedFiles]);
    } else {
      setSmsAttachments(prev => [...prev, ...uploadedFiles]);
    }

    setIsUploading(false);
    // Reset file input
    e.target.value = '';
  };

  // Remove attachment
  const removeAttachment = (index: number, target: 'email' | 'sms') => {
    if (target === 'email') {
      setEmailAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      setSmsAttachments(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Fetch contacts with communication frequency
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["compose-contacts-v2", searchQuery],
    queryFn: async () => {
      const results: Contact[] = [];

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

      return results.sort((a, b) => b.commCount - a.commCount);
    },
    enabled: open,
  });

  const recentContacts = contacts.filter(c => c.commCount > 0).slice(0, 5);

  // Send Email mutation
  const sendEmail = useMutation({
    mutationFn: async () => {
      if (!selectedContact?.email) throw new Error("No email address");
      
      const currentBody = activeTab === "ai" ? aiBody : emailBody;

      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          to: selectedContact.email,
          toName: selectedContact.name,
          subject: activeTab === "ai" ? aiSubject : subject,
          body: currentBody,
          contactType: selectedContact.type,
          contactId: selectedContact.id,
          attachments: emailAttachments.map(a => a.url),
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
          mediaUrls: smsAttachments.map(a => a.url),
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

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    if (!contact.email && contact.phone && activeTab === "email") {
      setActiveTab("sms");
      toast.info("Switched to SMS - no email available for this contact");
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "sms" | "email" | "ai");
  };

  // Render contact selection
  const renderContactSelection = () => (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0 overflow-hidden">
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
  );

  // Render email content
  const renderEmailContent = () => (
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
      <div className="relative flex-1">
        <Textarea
          placeholder="Compose your email..."
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          className={cn(
            "flex-1 min-h-[150px] resize-none border-0 focus-visible:ring-0 px-0 pr-16",
            isExpanded && "min-h-[300px]"
          )}
        />
        <div className="absolute right-2 top-2">
          <VoiceDictationButton
            onResult={(text) => setEmailBody(prev => prev ? `${prev}\n\n${text}` : text)}
            messageType="email"
            contactName={selectedContact?.name}
          />
        </div>
      </div>
      
      {/* Email Attachments */}
      <div className="shrink-0 space-y-2">
        {emailAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {emailAttachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-xs">
                <Paperclip className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  onClick={() => removeAttachment(idx, 'email')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={emailFileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'email')}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => emailFileRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Attach Files
        </Button>
      </div>
    </div>
  );

  // Render SMS content
  const renderSmsContent = () => (
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
      <div className="relative flex-1">
        <Textarea
          placeholder="Type your message..."
          value={smsMessage}
          onChange={(e) => setSmsMessage(e.target.value)}
          className="flex-1 min-h-[100px] resize-none rounded-lg pr-16"
        />
        <div className="absolute right-2 top-2">
          <VoiceDictationButton
            onResult={(text) => setSmsMessage(prev => prev ? `${prev} ${text}` : text)}
            messageType="sms"
            contactName={selectedContact?.name}
          />
        </div>
      </div>

      {/* SMS Attachments (MMS) */}
      <div className="shrink-0 space-y-2">
        {smsAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {smsAttachments.map((file, idx) => (
              <div key={idx} className="relative group">
                <img 
                  src={file.url} 
                  alt={file.name}
                  className="h-16 w-16 object-cover rounded-lg border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-5 w-5 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAttachment(idx, 'sms')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={smsFileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'sms')}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => smsFileRef.current?.click()}
          disabled={isUploading || smsAttachments.length >= 5}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
          Add Image (MMS)
        </Button>
      </div>

      {/* Character count */}
      <div className="flex justify-between text-xs text-muted-foreground shrink-0">
        <span className={cn(characterCount > 160 && "text-amber-500")}>
          {characterCount} characters
        </span>
        <span className={cn(segmentCount > 1 && "text-amber-500")}>
          {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
          {smsAttachments.length > 0 && " + MMS"}
        </span>
      </div>
    </div>
  );

  // Render AI content
  const renderAiContent = () => (
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
              "flex-1 min-h-[120px] resize-none border-0 focus-visible:ring-0 px-0",
              isExpanded && "min-h-[250px]"
            )}
          />
        </div>
      )}
    </div>
  );

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

        {/* Tab Buttons */}
        <div className="grid grid-cols-3 border-b shrink-0">
          <button
            type="button"
            onClick={() => handleTabChange("email")}
            disabled={selectedContact ? !selectedContact.email : false}
            className={cn(
              "py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors",
              activeTab === "email" 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground",
              selectedContact && !selectedContact.email && "opacity-50 cursor-not-allowed"
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            Email
            {selectedContact && !selectedContact.email && (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("sms")}
            disabled={selectedContact ? !selectedContact.phone : false}
            className={cn(
              "py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors",
              activeTab === "sms" 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground",
              selectedContact && !selectedContact.phone && "opacity-50 cursor-not-allowed"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            SMS
            {selectedContact && !selectedContact.phone && (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("ai")}
            className={cn(
              "py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors",
              activeTab === "ai" 
                ? "border-primary text-foreground" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Compose
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!selectedContact ? (
            renderContactSelection()
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

              {/* Tab Content */}
              {activeTab === "email" && renderEmailContent()}
              {activeTab === "sms" && renderSmsContent()}
              {activeTab === "ai" && renderAiContent()}
            </>
          )}
        </div>

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
