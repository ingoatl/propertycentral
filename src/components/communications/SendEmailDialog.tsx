import { useState, useEffect } from "react";
import { Send, Mail, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactEmail: string;
  contactType: "lead" | "owner";
  contactId: string;
}

const SENDERS = [
  { email: "ingo@peachhausgroup.com", name: "Ingo Schaer", label: "Ingo" },
  { email: "anja@peachhausgroup.com", name: "Anja Schaer", label: "Anja" },
];

const EMAIL_TEMPLATES = [
  {
    label: "Follow Up",
    subject: "Following up on our conversation",
    content: `Hi {{name}},

I wanted to follow up on our recent conversation about property management services. 

Do you have any questions I can help answer? I'm happy to schedule a call at your convenience.

Best regards`,
  },
  {
    label: "Property Info",
    subject: "Your Property Management Information",
    content: `Hi {{name}},

Thank you for your interest in PeachHaus property management services. 

I'd love to learn more about your property and discuss how we can help maximize your rental income while taking care of all the details.

Would you be available for a brief call this week?

Best regards`,
  },
  {
    label: "Thank You",
    subject: "Thank you for your time",
    content: `Hi {{name}},

Thank you for taking the time to speak with me today. I really enjoyed learning about your property.

As discussed, I'll follow up with the next steps shortly. In the meantime, please don't hesitate to reach out if you have any questions.

Best regards`,
  },
];

export function SendEmailDialog({
  open,
  onOpenChange,
  contactName,
  contactEmail,
  contactType,
  contactId,
}: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedSender, setSelectedSender] = useState(SENDERS[0].email);
  const queryClient = useQueryClient();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSubject("");
      setBody("");
    }
  }, [open]);

  const selectedSenderInfo = SENDERS.find((s) => s.email === selectedSender);

  const sendEmail = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-lead-email", {
        body: {
          to: contactEmail,
          toName: contactName,
          subject,
          body,
          contactType,
          contactId,
          senderEmail: selectedSender,
          senderName: selectedSenderInfo?.name,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Email sent successfully!");
      setSubject("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["all-communications"] });
      queryClient.invalidateQueries({ queryKey: ["lead-communications"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  const applyTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
    const firstName = contactName.split(" ")[0];
    setSubject(template.subject);
    setBody(template.content.replace(/{{name}}/g, firstName));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sender selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Send as</label>
            <Select value={selectedSender} onValueChange={setSelectedSender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SENDERS.map((sender) => (
                  <SelectItem key={sender.email} value={sender.email}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sender.label}</span>
                      <span className="text-muted-foreground text-xs">
                        ({sender.email})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email display */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>To:</span>
            <Badge variant="secondary">{contactEmail}</Badge>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
