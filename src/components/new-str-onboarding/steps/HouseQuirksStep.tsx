import { NewSTROnboardingFormData, PROPERTY_FEATURE_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Lightbulb, AlertTriangle, Users, Car, Wrench, Phone, Waves } from "lucide-react";

interface HouseQuirksStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const HouseQuirksStep = ({ formData, updateFormData }: HouseQuirksStepProps) => {
  const toggleFeature = (feature: string) => {
    const current = formData.propertyFeatures || [];
    const updated = current.includes(feature)
      ? current.filter(f => f !== feature)
      : [...current, feature];
    updateFormData({ propertyFeatures: updated });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Property Details & Quirks</h2>
        <p className="text-muted-foreground mt-2">Help us understand everything about your property</p>
      </div>

      {/* Property Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="w-5 h-5 text-primary" />
            Property Features & Amenities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Select all features your property has</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PROPERTY_FEATURE_OPTIONS.map((feature) => (
              <div key={feature} className="flex items-center space-x-2">
                <Checkbox
                  id={`feature-${feature}`}
                  checked={formData.propertyFeatures?.includes(feature)}
                  onCheckedChange={() => toggleFeature(feature)}
                />
                <Label htmlFor={`feature-${feature}`} className="text-sm cursor-pointer">
                  {feature}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pool/Hot Tub */}
      {(formData.propertyFeatures?.includes('Pool') || formData.propertyFeatures?.includes('Hot Tub')) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Waves className="w-5 h-5 text-primary" />
              Pool / Hot Tub Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="poolHotTubInfo">Pool/Hot Tub Information</Label>
              <Textarea
                id="poolHotTubInfo"
                value={formData.poolHotTubInfo}
                onChange={(e) => updateFormData({ poolHotTubInfo: e.target.value })}
                placeholder="Heated? Seasonal? Service company? Any rules?"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Known Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Known Issues & Quirks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="knownIssues">Known Maintenance Issues</Label>
            <Textarea
              id="knownIssues"
              value={formData.knownIssues}
              onChange={(e) => updateFormData({ knownIssues: e.target.value })}
              placeholder="Any ongoing issues, quirks, or things that need attention?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Special Instructions / House Quirks</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => updateFormData({ specialInstructions: e.target.value })}
              placeholder="e.g., 'Jiggle the handle on the back door', 'AC takes 10 min to cool down'"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Neighbors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Neighbor Relations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="neighborNotes">Neighbor Notes</Label>
            <Textarea
              id="neighborNotes"
              value={formData.neighborNotes}
              onChange={(e) => updateFormData({ neighborNotes: e.target.value })}
              placeholder="Any sensitive neighbor situations? Shared driveways? Noise concerns?"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="w-5 h-5 text-primary" />
            Parking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxVehicles">Maximum Vehicles</Label>
              <Input
                id="maxVehicles"
                type="number"
                min="0"
                value={formData.maxVehicles || ''}
                onChange={(e) => updateFormData({ maxVehicles: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="2"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parkingInstructions">Parking Instructions</Label>
            <Textarea
              id="parkingInstructions"
              value={formData.parkingInstructions}
              onChange={(e) => updateFormData({ parkingInstructions: e.target.value })}
              placeholder="Where to park, any restrictions, guest parking rules..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5 text-primary" />
            Emergency & Maintenance Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => updateFormData({ emergencyContact: e.target.value })}
                placeholder="Name & phone for emergencies"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenanceContact">Maintenance Contact</Label>
              <Input
                id="maintenanceContact"
                value={formData.maintenanceContact}
                onChange={(e) => updateFormData({ maintenanceContact: e.target.value })}
                placeholder="Handyman or maintenance person"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
