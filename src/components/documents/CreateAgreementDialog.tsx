import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, User, DollarSign, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';

interface Template {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
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
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number | null;
  property_id: string;
}

interface CreateAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  property: Property | null;
  onSuccess: () => void;
}

export function CreateAgreementDialog({ 
  open, 
  onOpenChange, 
  booking, 
  property,
  onSuccess 
}: CreateAgreementDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hostName, setHostName] = useState('');
  const [hostEmail, setHostEmail] = useState('');

  // Form fields for the agreement
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    maxOccupants: '2',
    monthlyRent: '',
    securityDeposit: '',
    utilityCap: '350',
    rentDueDate: '1st',
    checkInDate: '',
    checkInTime: '15:00',
    checkOutDate: '',
    checkOutTime: '11:00',
    additionalTerms: '',
  });

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadCurrentUser();
      // Pre-fill from booking data
      setFormData(prev => ({
        ...prev,
        guestName: booking.tenant_name || '',
        guestEmail: booking.tenant_email || '',
        monthlyRent: booking.monthly_rent?.toString() || '',
        securityDeposit: booking.deposit_amount?.toString() || '',
        checkInDate: booking.start_date || '',
        checkOutDate: booking.end_date || '',
      }));
    }
  }, [open, booking]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('is_active', true);

    if (error) {
      toast.error('Failed to load templates');
      return;
    }
    setTemplates(data || []);
    if (data && data.length > 0) {
      setSelectedTemplate(data[0].id);
    }
  };

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, email')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setHostName(profile.first_name || 'PeachHaus Host');
        setHostEmail(profile.email);
      }
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    if (!formData.guestName || !formData.guestEmail) {
      toast.error('Guest name and email are required');
      return;
    }

    setLoading(true);
    try {
      // Build pre-fill data for native signing
      const preFillData: Record<string, string> = {
        property_address: property?.address || '',
        property_name: property?.name || '',
        guest_name: formData.guestName,
        tenant_name: formData.guestName,
        guest_email: formData.guestEmail,
        tenant_email: formData.guestEmail,
        max_occupants: formData.maxOccupants,
        monthly_rent: formData.monthlyRent,
        security_deposit: formData.securityDeposit,
        utility_cap: formData.utilityCap,
        rent_due_date: formData.rentDueDate,
        check_in_date: formData.checkInDate ? format(new Date(formData.checkInDate), 'MMMM d, yyyy') : '',
        check_in_time: formData.checkInTime,
        check_out_date: formData.checkOutDate ? format(new Date(formData.checkOutDate), 'MMMM d, yyyy') : '',
        check_out_time: formData.checkOutTime,
        additional_terms: formData.additionalTerms,
        lease_start_date: formData.checkInDate,
        lease_end_date: formData.checkOutDate,
      };

      // Use native signing solution
      const { data: result, error: fnError } = await supabase.functions.invoke('create-document-for-signing', {
        body: {
          templateId: selectedTemplate,
          documentName: templates.find(t => t.id === selectedTemplate)?.name || 'Rental Agreement',
          recipientName: formData.guestName,
          recipientEmail: formData.guestEmail,
          propertyId: property?.id,
          bookingId: booking.id,
          preFillData,
          detectedFields: [], // Fields will be detected from template
        },
      });

      if (fnError) throw fnError;

      if (result?.error) {
        throw new Error(result.error);
      }

      toast.success('Agreement created! Copy the guest signing link to share with them.');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating agreement:', error);
      toast.error(`Failed to create agreement: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Rental Agreement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Fill in all fields below. After creating, you'll get a signing link to share with the guest. 
              No automatic emails will be sent.
            </p>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Document Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
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
          </div>

          {/* Guest Information */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Guest Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Guest Full Name *</Label>
                <Input
                  id="guestName"
                  value={formData.guestName}
                  onChange={(e) => handleFieldChange('guestName', e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestEmail">Guest Email *</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) => handleFieldChange('guestEmail', e.target.value)}
                  placeholder="guest@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxOccupants">Max Occupants</Label>
                <Input
                  id="maxOccupants"
                  value={formData.maxOccupants}
                  onChange={(e) => handleFieldChange('maxOccupants', e.target.value)}
                  placeholder="2"
                />
              </div>
            </div>
          </div>

          {/* Financial Terms */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Financial Terms
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">Monthly Rent ($)</Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  value={formData.monthlyRent}
                  onChange={(e) => handleFieldChange('monthlyRent', e.target.value)}
                  placeholder="3500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="securityDeposit">Security Deposit ($)</Label>
                <Input
                  id="securityDeposit"
                  type="number"
                  value={formData.securityDeposit}
                  onChange={(e) => handleFieldChange('securityDeposit', e.target.value)}
                  placeholder="3500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utilityCap">Utility Cap ($)</Label>
                <Input
                  id="utilityCap"
                  type="number"
                  value={formData.utilityCap}
                  onChange={(e) => handleFieldChange('utilityCap', e.target.value)}
                  placeholder="350"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rentDueDate">Rent Due Date</Label>
                <Select value={formData.rentDueDate} onValueChange={(v) => handleFieldChange('rentDueDate', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st">1st of each month</SelectItem>
                    <SelectItem value="15th">15th of each month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Dates & Times
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-In Date</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) => handleFieldChange('checkInDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInTime">Check-In Time</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={formData.checkInTime}
                  onChange={(e) => handleFieldChange('checkInTime', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutDate">Check-Out Date</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) => handleFieldChange('checkOutDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutTime">Check-Out Time</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={formData.checkOutTime}
                  onChange={(e) => handleFieldChange('checkOutTime', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Additional Terms */}
          <div className="space-y-2">
            <Label htmlFor="additionalTerms">Additional Terms (Optional)</Label>
            <Textarea
              id="additionalTerms"
              value={formData.additionalTerms}
              onChange={(e) => handleFieldChange('additionalTerms', e.target.value)}
              placeholder="Any special conditions or terms..."
              rows={3}
            />
          </div>

          {/* Property Info Display */}
          {property && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">{property.name}</p>
              <p className="text-sm text-muted-foreground">{property.address}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading || !selectedTemplate}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Agreement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
