import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';
import { Home, User, GraduationCap } from 'lucide-react';
import { GooglePlacesAutocomplete } from '@/components/ui/google-places-autocomplete';

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

const PROPERTY_TYPE_OPTIONS = [
  'Single Family Home',
  'Condo',
  'Townhouse',
  'Apartment',
  'Guest House/ADU',
  'Cabin',
  'Villa',
  'Other',
];

const STORIES_OPTIONS = ['1', '2', '3', 'Multi-level'];

const POOL_TYPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'pool_only', label: 'Pool Only' },
  { value: 'hot_tub_only', label: 'Hot Tub Only' },
  { value: 'pool_and_hot_tub', label: 'Pool & Hot Tub' },
];

export function OwnerInfoStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Owner & Property Information</h2>
        <p className="text-gray-600">Let's start with your contact details and property specifications.</p>
      </div>

      {/* Owner Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-primary" />
            Owner Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <GooglePlacesAutocomplete
              id="property_address"
              value={formData.property_address}
              onChange={(value) => updateFormData({ property_address: value })}
              placeholder="123 Main Street, Atlanta, GA 30301"
              className="h-14 mt-1"
              onPlaceSelect={(place) => updateFormData({ property_address: place.formattedAddress })}
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
        </CardContent>
      </Card>

      {/* Property Specifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="w-5 h-5 text-primary" />
            Property Specifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="property_type" className="text-sm font-medium">
              Property Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.property_type}
              onValueChange={(value) => updateFormData({ property_type: value })}
            >
              <SelectTrigger className="h-14 mt-1">
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="bedrooms" className="text-sm font-medium">
                Bedrooms <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bedrooms"
                type="number"
                min="0"
                value={formData.bedrooms ?? ''}
                onChange={(e) => updateFormData({ bedrooms: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="3"
                className="h-14 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bathrooms" className="text-sm font-medium">
                Bathrooms <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bathrooms"
                type="number"
                min="0"
                step="0.5"
                value={formData.bathrooms ?? ''}
                onChange={(e) => updateFormData({ bathrooms: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="2"
                className="h-14 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="square_footage" className="text-sm font-medium">
                Square Footage
              </Label>
              <Input
                id="square_footage"
                type="number"
                min="0"
                value={formData.square_footage ?? ''}
                onChange={(e) => updateFormData({ square_footage: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="1500"
                className="h-14 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="max_occupancy" className="text-sm font-medium">
                Max Occupancy
              </Label>
              <Input
                id="max_occupancy"
                type="number"
                min="1"
                value={formData.max_occupancy ?? ''}
                onChange={(e) => updateFormData({ max_occupancy: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="6"
                className="h-14 mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="year_built" className="text-sm font-medium">
                Year Built
              </Label>
              <Input
                id="year_built"
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                value={formData.year_built ?? ''}
                onChange={(e) => updateFormData({ year_built: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="2010"
                className="h-14 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="num_stories" className="text-sm font-medium">
                Number of Stories
              </Label>
              <Select
                value={formData.num_stories}
                onValueChange={(value) => updateFormData({ num_stories: value })}
              >
                <SelectTrigger className="h-14 mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {STORIES_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pool_type" className="text-sm font-medium">
                Pool / Hot Tub
              </Label>
              <Select
                value={formData.pool_type}
                onValueChange={(value) => updateFormData({ pool_type: value })}
              >
                <SelectTrigger className="h-14 mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {POOL_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggle options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
              <Label htmlFor="has_basement" className="text-sm font-medium">
                Has Basement
              </Label>
              <Switch
                id="has_basement"
                checked={formData.has_basement}
                onCheckedChange={(checked) => updateFormData({ has_basement: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
              <Label htmlFor="fenced_yard" className="text-sm font-medium">
                Fenced Yard
              </Label>
              <Switch
                id="fenced_yard"
                checked={formData.fenced_yard}
                onCheckedChange={(checked) => updateFormData({ fenced_yard: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
              <Label htmlFor="ada_compliant" className="text-sm font-medium">
                ADA Compliant
              </Label>
              <Switch
                id="ada_compliant"
                checked={formData.ada_compliant}
                onCheckedChange={(checked) => updateFormData({ ada_compliant: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nearby Schools Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="w-5 h-5 text-primary" />
            Nearby Schools
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Listing nearby schools helps attract families (optional)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="elementary_school" className="text-sm font-medium">
                Elementary School
              </Label>
              <Input
                id="elementary_school"
                value={formData.elementary_school}
                onChange={(e) => updateFormData({ elementary_school: e.target.value })}
                placeholder="e.g., Peachtree Elementary"
                className="h-14 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="middle_school" className="text-sm font-medium">
                Middle School
              </Label>
              <Input
                id="middle_school"
                value={formData.middle_school}
                onChange={(e) => updateFormData({ middle_school: e.target.value })}
                placeholder="e.g., Sutton Middle"
                className="h-14 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="high_school" className="text-sm font-medium">
                High School
              </Label>
              <Input
                id="high_school"
                value={formData.high_school}
                onChange={(e) => updateFormData({ high_school: e.target.value })}
                placeholder="e.g., North Atlanta High"
                className="h-14 mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
