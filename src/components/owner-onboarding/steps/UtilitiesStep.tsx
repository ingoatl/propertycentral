import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OwnerOnboardingFormData, UtilityInfo } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function UtilitiesStep({ formData, updateFormData }: StepProps) {
  const updateUtility = (index: number, field: keyof UtilityInfo, value: string) => {
    const newUtilities = [...formData.utilities];
    newUtilities[index] = { ...newUtilities[index], [field]: value };
    updateFormData({ utilities: newUtilities });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Utilities Information</h2>
        <p className="text-gray-600">Provide utility provider details for the property.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="wastewater_system" className="text-sm font-medium">
            Wastewater System <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.wastewater_system}
            onValueChange={(value) => updateFormData({ wastewater_system: value })}
          >
            <SelectTrigger className="h-14 mt-1">
              <SelectValue placeholder="Select system type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sewer">Sewer</SelectItem>
              <SelectItem value="Septic">Septic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.wastewater_system === 'Septic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50 rounded-xl">
            <div>
              <Label htmlFor="septic_last_pumped" className="text-sm font-medium">
                Last Pumped Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="septic_last_pumped"
                type="date"
                value={formData.septic_last_pumped}
                onChange={(e) => updateFormData({ septic_last_pumped: e.target.value })}
                className="h-14 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="septic_company" className="text-sm font-medium">
                Septic Company <span className="text-red-500">*</span>
              </Label>
              <Input
                id="septic_company"
                value={formData.septic_company}
                onChange={(e) => updateFormData({ septic_company: e.target.value })}
                placeholder="ABC Septic Services"
                className="h-14 mt-1"
              />
            </div>
          </div>
        )}

        <div className="space-y-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-900">Utility Providers</h3>
          
          {formData.utilities.map((utility, index) => (
            <div key={utility.type} className="p-4 bg-gray-50 rounded-xl">
              <h4 className="font-medium text-gray-900 mb-3">{utility.type}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">
                    Provider <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={utility.provider}
                    onChange={(e) => updateUtility(index, 'provider', e.target.value)}
                    placeholder={`${utility.type} provider name`}
                    className="h-14 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    Account Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={utility.account_number}
                    onChange={(e) => updateUtility(index, 'account_number', e.target.value)}
                    placeholder="Account #"
                    className="h-14 mt-1"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
