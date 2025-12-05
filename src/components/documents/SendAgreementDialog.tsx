import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Booking {
  id: string;
  tenant_name: string;
  tenant_email: string | null;
  property_id: string;
  monthly_rent: number;
  deposit_amount: number;
  start_date: string;
  end_date: string;
}

interface SendAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  property?: Property;
  onSuccess: () => void;
}

export function SendAgreementDialog({ 
  open, 
  onOpenChange, 
  booking, 
  property,
  onSuccess 
}: SendAgreementDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState(booking.tenant_email || "");
  const [hostName, setHostName] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadCurrentUser();
      setGuestEmail(booking.tenant_email || "");
    }
  }, [open, booking]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
      if (data && data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load document templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, email')
          .eq('id', user.id)
          .single();

        if (profile) {
          setHostName(profile.first_name || user.email?.split('@')[0] || '');
          setHostEmail(profile.email || user.email || '');
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template');
      return;
    }
    if (!guestEmail) {
      toast.error('Guest email is required');
      return;
    }
    if (!hostEmail) {
      toast.error('Host email is required');
      return;
    }

    try {
      setLoading(true);

      // Create booking document record first
      const { data: docRecord, error: insertError } = await supabase
        .from('booking_documents')
        .insert({
          booking_id: booking.id,
          template_id: selectedTemplateId,
          status: 'draft',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create audit log for document creation
      await supabase.from('document_audit_log').insert({
        document_id: docRecord.id,
        action: 'created',
        performed_by: hostEmail,
        metadata: {
          template_id: selectedTemplateId,
          guest_email: guestEmail,
        },
      });

      // Call SignWell to create and send the document
      const { data, error } = await supabase.functions.invoke('signwell-create-document', {
        body: {
          bookingId: booking.id,
          templateId: selectedTemplateId,
          documentId: docRecord.id,
          guestName: booking.tenant_name,
          guestEmail: guestEmail,
          hostName: hostName || 'PeachHausGroup LLC',
          hostEmail: hostEmail,
          fieldValues: [
            // Pre-fill common fields - these map to SignWell field names
            { api_id: 'guest_name', value: booking.tenant_name },
            { api_id: 'property_address', value: property?.address || '' },
            { api_id: 'monthly_rent', value: `$${booking.monthly_rent.toLocaleString()}` },
            { api_id: 'security_deposit', value: `$${booking.deposit_amount.toLocaleString()}` },
            { api_id: 'start_date', value: booking.start_date },
            { api_id: 'end_date', value: booking.end_date },
          ],
        },
      });

      if (error) throw error;

      toast.success('Agreement sent for signature!');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error sending agreement:', error);
      toast.error(error.message || 'Failed to send agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Send Agreement for Signature
          </DialogTitle>
          <DialogDescription>
            Send a document to {booking.tenant_name} for e-signature
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Document Template</Label>
            {loadingTemplates ? (
              <p className="text-sm text-muted-foreground">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates available. Please add a template first.</p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestEmail">Guest Email *</Label>
            <Input
              id="guestEmail"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hostName">Host Name (Signer)</Label>
            <Input
              id="hostName"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hostEmail">Host Email *</Label>
            <Input
              id="hostEmail"
              type="email"
              value={hostEmail}
              onChange={(e) => setHostEmail(e.target.value)}
              placeholder="host@peachhausgroup.com"
              required
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium mb-1">Document will be pre-filled with:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Guest: {booking.tenant_name}</li>
              <li>• Property: {property?.address || 'N/A'}</li>
              <li>• Monthly Rent: ${booking.monthly_rent.toLocaleString()}</li>
              <li>• Deposit: ${booking.deposit_amount.toLocaleString()}</li>
              <li>• Dates: {booking.start_date} to {booking.end_date}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={loading || !selectedTemplateId || templates.length === 0}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Sending...' : 'Send for Signature'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
