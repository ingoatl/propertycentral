import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function OwnerInfoStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Owner Information</h2>
        <p className="text-gray-600">Let's start with your contact details and property address.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="owner_name" className="text-sm font-medium">
            Owner Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="owner_name"
            value={formData.owner_name}
            onChange={(e) => updateFormData({ owner_name: e.target.value })}
            placeholder="John Smith"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="owner_email" className="text-sm font-medium">
            Owner Email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="owner_email"
            type="email"
            value={formData.owner_email}
            onChange={(e) => updateFormData({ owner_email: e.target.value })}
            placeholder="john@example.com"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="owner_phone" className="text-sm font-medium">
            Owner Phone
          </Label>
          <Input
            id="owner_phone"
            type="tel"
            value={formData.owner_phone}
            onChange={(e) => updateFormData({ owner_phone: e.target.value })}
            placeholder="(555) 123-4567"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="property_address" className="text-sm font-medium">
            Property Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="property_address"
            value={formData.property_address}
            onChange={(e) => updateFormData({ property_address: e.target.value })}
            placeholder="123 Main Street, Atlanta, GA 30301"
            className="h-14 mt-1"
          />
        </div>
      </div>
    </div>
  );
}
