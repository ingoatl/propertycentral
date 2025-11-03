import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

interface Property {
  id: string;
  name: string;
  user_id: string;
}

interface PropertyOwner {
  id: string;
  email: string;
  first_name: string | null;
}

export function SendManualEmailsDialog() {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [emailType, setEmailType] = useState<"performance" | "owner_statement">("performance");
  const [sendToOwner, setSendToOwner] = useState(true);
  const [sendCopyToInfo, setSendCopyToInfo] = useState(true);
  const [sending, setSending] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadProperties();
    }
  }, [open]);

  useEffect(() => {
    if (selectedProperty) {
      loadOwnerEmail(selectedProperty);
    }
  }, [selectedProperty]);

  const loadProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, user_id")
        .order("name");

      if (error) throw error;
      setProperties(data || []);
    } catch (error: any) {
      console.error("Error loading properties:", error);
      toast.error("Failed to load properties");
    }
  };

  const loadOwnerEmail = async (propertyId: string) => {
    try {
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("id", property.user_id)
        .single();

      if (error) throw error;
      setOwnerEmail(data?.email || "");
    } catch (error: any) {
      console.error("Error loading owner email:", error);
      setOwnerEmail("");
    }
  };

  const handleSend = async () => {
    if (!selectedProperty) {
      toast.error("Please select a property");
      return;
    }

    if (!sendToOwner && !sendCopyToInfo) {
      toast.error("Please select at least one recipient");
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase.functions.invoke('send-monthly-report', {
        body: { 
          isManualSend: true,
          propertyId: selectedProperty,
          emailType: emailType,
          sendToOwner: sendToOwner,
          sendCopyToInfo: sendCopyToInfo
        }
      });

      if (error) throw error;

      toast.success(`${emailType === 'performance' ? 'Performance' : 'Owner Statement'} email sent successfully!`);
      setOpen(false);
      
      // Reset form
      setSelectedProperty("");
      setEmailType("performance");
      setSendToOwner(true);
      setSendCopyToInfo(true);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Mail className="w-4 h-4" />
          Send Manual Email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Manual Email to Owner</DialogTitle>
          <DialogDescription>
            Send a performance report or owner statement email to a specific property owner
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="email-type">Email Type</Label>
            <Select value={emailType} onValueChange={(value: "performance" | "owner_statement") => setEmailType(value)}>
              <SelectTrigger id="email-type">
                <SelectValue placeholder="Select email type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">Performance Email</SelectItem>
                <SelectItem value="owner_statement">Owner Statement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property">Property</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger id="property">
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownerEmail && (
              <p className="text-sm text-muted-foreground">
                Owner: {ownerEmail}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Recipients</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-to-owner"
                checked={sendToOwner}
                onCheckedChange={(checked) => setSendToOwner(checked as boolean)}
              />
              <label
                htmlFor="send-to-owner"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Send to property owner ({ownerEmail || "N/A"})
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-copy"
                checked={sendCopyToInfo}
                onCheckedChange={(checked) => setSendCopyToInfo(checked as boolean)}
              />
              <label
                htmlFor="send-copy"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Send copy to info@peachhausgroup.com
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
