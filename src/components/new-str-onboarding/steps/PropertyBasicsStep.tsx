import { NewSTROnboardingFormData, PROPERTY_TYPE_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Home, User, Mail, Phone, MapPin } from "lucide-react";

interface PropertyBasicsStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

const STORIES_OPTIONS = ['1', '2', '3', 'Multi-level'];

const POOL_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'pool_only', label: 'Pool Only' },
  { value: 'hot_tub_only', label: 'Hot Tub Only' },
  { value: 'pool_and_hot_tub', label: 'Pool & Hot Tub' },
];

export const PropertyBasicsStep = ({ formData, updateFormData }: PropertyBasicsStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Property Basics</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Let's start with the essentials about you and your property</p>
      </div>

      {/* Owner Information */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <User className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Owner Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ownerName">Full Name *</Label>
              <Input
                id="ownerName"
                value={formData.ownerName}
                onChange={(e) => updateFormData({ ownerName: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[hsl(25,30%,60%)]" />
                <Input
                  id="ownerEmail"
                  type="email"
                  className="pl-10"
                  value={formData.ownerEmail}
                  onChange={(e) => updateFormData({ ownerEmail: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerPhone">Phone Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-[hsl(25,30%,60%)]" />
              <Input
                id="ownerPhone"
                type="tel"
                className="pl-10"
                value={formData.ownerPhone}
                onChange={(e) => updateFormData({ ownerPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Home className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Property Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address *</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-[hsl(25,30%,60%)]" />
              <Input
                id="propertyAddress"
                className="pl-10"
                value={formData.propertyAddress}
                onChange={(e) => updateFormData({ propertyAddress: e.target.value })}
                placeholder="123 Main St, Atlanta, GA 30301"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyType">Property Type *</Label>
            <Select
              value={formData.propertyType}
              onValueChange={(value) => updateFormData({ propertyType: value })}
            >
              <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms *</Label>
              <Input
                id="bedrooms"
                type="number"
                min="0"
                value={formData.bedrooms ?? ''}
                onChange={(e) => updateFormData({ bedrooms: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms *</Label>
              <Input
                id="bathrooms"
                type="number"
                min="0"
                step="0.5"
                value={formData.bathrooms ?? ''}
                onChange={(e) => updateFormData({ bathrooms: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="squareFootage">Square Footage</Label>
              <Input
                id="squareFootage"
                type="number"
                min="0"
                value={formData.squareFootage ?? ''}
                onChange={(e) => updateFormData({ squareFootage: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="1500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearBuilt">Year Built</Label>
              <Input
                id="yearBuilt"
                type="number"
                min="1800"
                max={new Date().getFullYear()}
                value={formData.yearBuilt ?? ''}
                onChange={(e) => updateFormData({ yearBuilt: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="2010"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numStories">Number of Stories</Label>
              <Select
                value={formData.numStories}
                onValueChange={(value) => updateFormData({ numStories: value })}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="poolType">Pool / Hot Tub</Label>
              <Select
                value={formData.poolType}
                onValueChange={(value) => updateFormData({ poolType: value })}
              >
                <SelectTrigger>
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
              <Label htmlFor="hasBasement" className="text-sm font-medium">
                Has Basement
              </Label>
              <Switch
                id="hasBasement"
                checked={formData.hasBasement}
                onCheckedChange={(checked) => updateFormData({ hasBasement: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
              <Label htmlFor="fencedYard" className="text-sm font-medium">
                Fenced Yard
              </Label>
              <Switch
                id="fencedYard"
                checked={formData.fencedYard}
                onCheckedChange={(checked) => updateFormData({ fencedYard: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
              <Label htmlFor="adaCompliant" className="text-sm font-medium">
                ADA Compliant
              </Label>
              <Switch
                id="adaCompliant"
                checked={formData.adaCompliant}
                onCheckedChange={(checked) => updateFormData({ adaCompliant: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
