import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function VendorsStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Vendor Contacts</h2>
        <p className="text-gray-600">Provide contact information for your property's service providers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lawncare_provider" className="text-sm font-medium">
            Lawncare Provider <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lawncare_provider"
            value={formData.lawncare_provider}
            onChange={(e) => updateFormData({ lawncare_provider: e.target.value })}
            placeholder="Company Name - (555) 123-4567"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="pest_control_provider" className="text-sm font-medium">
            Pest Control Provider <span className="text-red-500">*</span>
          </Label>
          <Input
            id="pest_control_provider"
            value={formData.pest_control_provider}
            onChange={(e) => updateFormData({ pest_control_provider: e.target.value })}
            placeholder="Company Name - (555) 123-4567"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="hvac_service" className="text-sm font-medium">
            HVAC Service <span className="text-red-500">*</span>
          </Label>
          <Input
            id="hvac_service"
            value={formData.hvac_service}
            onChange={(e) => updateFormData({ hvac_service: e.target.value })}
            placeholder="Company Name - (555) 123-4567"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="maintenance_contact" className="text-sm font-medium">
            Maintenance Contact <span className="text-red-500">*</span>
          </Label>
          <Input
            id="maintenance_contact"
            value={formData.maintenance_contact}
            onChange={(e) => updateFormData({ maintenance_contact: e.target.value })}
            placeholder="Handyman Name - (555) 123-4567"
            className="h-14 mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="emergency_contact_24_7" className="text-sm font-medium">
            Emergency Contact (24/7) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="emergency_contact_24_7"
            value={formData.emergency_contact_24_7}
            onChange={(e) => updateFormData({ emergency_contact_24_7: e.target.value })}
            placeholder="Name - (555) 123-4567 (available 24/7)"
            className="h-14 mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="insurance_corporate_contacts" className="text-sm font-medium">
          Insurance Partners / Corporate Contacts
        </Label>
        <Textarea
          id="insurance_corporate_contacts"
          value={formData.insurance_corporate_contacts}
          onChange={(e) => updateFormData({ insurance_corporate_contacts: e.target.value })}
          placeholder="List any insurance partners or corporate housing contacts..."
          className="mt-1"
          rows={4}
        />
      </div>
    </div>
  );
}
