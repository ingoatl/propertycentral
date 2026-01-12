import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

const HOW_FOUND_US_OPTIONS = [
  { value: 'google_search', label: 'Google Search' },
  { value: 'social_media', label: 'Social Media (Facebook, Instagram, etc.)' },
  { value: 'airbnb_host_group', label: 'Airbnb Host Group/Forum' },
  { value: 'real_estate_agent', label: 'Real Estate Agent' },
  { value: 'networking_event', label: 'Networking Event' },
  { value: 'existing_client', label: 'Existing PeachHaus Client' },
  { value: 'online_ad', label: 'Online Advertisement' },
  { value: 'podcast_youtube', label: 'Podcast/YouTube' },
  { value: 'news_article', label: 'News Article/Blog' },
  { value: 'other', label: 'Other' },
];

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

        {/* How did you find us */}
        <div className="pt-4 border-t">
          <Label htmlFor="how_did_you_find_us" className="text-sm font-medium">
            How did you hear about PeachHaus?
          </Label>
          <Select
            value={formData.how_did_you_find_us}
            onValueChange={(value) => updateFormData({ how_did_you_find_us: value })}
          >
            <SelectTrigger className="h-14 mt-1">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {HOW_FOUND_US_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Referral Question */}
        <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="was_referred" className="text-sm font-medium">
              Were you referred by someone?
            </Label>
            <p className="text-xs text-muted-foreground">Let us know so we can thank them!</p>
          </div>
          <Switch
            id="was_referred"
            checked={formData.was_referred}
            onCheckedChange={(checked) => updateFormData({ was_referred: checked, referred_by: checked ? formData.referred_by : '' })}
          />
        </div>

        {formData.was_referred && (
          <div>
            <Label htmlFor="referred_by" className="text-sm font-medium">
              Who referred you?
            </Label>
            <Input
              id="referred_by"
              value={formData.referred_by}
              onChange={(e) => updateFormData({ referred_by: e.target.value })}
              placeholder="Name of the person who referred you"
              className="h-14 mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
