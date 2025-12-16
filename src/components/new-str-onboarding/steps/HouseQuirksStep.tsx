import { NewSTROnboardingFormData, PROPERTY_FEATURE_OPTIONS, SECURITY_STATUS_OPTIONS, PARKING_TYPE_OPTIONS, TRASH_DAY_OPTIONS, SMOKE_DETECTOR_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, AlertTriangle, Users, Car, Wrench, Phone, Waves, KeyRound, Trash2, Shield, Flame } from "lucide-react";

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Waves className="w-5 h-5 text-primary" />
            Pool / Hot Tub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="poolHotTubPresent">Does the property have a pool or hot tub?</Label>
              <p className="text-sm text-muted-foreground">Important for listings and maintenance</p>
            </div>
            <Switch
              id="poolHotTubPresent"
              checked={formData.poolHotTubPresent}
              onCheckedChange={(checked) => updateFormData({ poolHotTubPresent: checked })}
            />
          </div>
          {formData.poolHotTubPresent && (
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="poolHotTubInfo">Pool/Hot Tub Details</Label>
              <Textarea
                id="poolHotTubInfo"
                value={formData.poolHotTubInfo}
                onChange={(e) => updateFormData({ poolHotTubInfo: e.target.value })}
                placeholder="Heated? Seasonal? Service company? Any rules?"
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="w-5 h-5 text-primary" />
            Access Codes & Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="alarmSystemCode">Alarm System Code</Label>
              <Input
                id="alarmSystemCode"
                value={formData.alarmSystemCode}
                onChange={(e) => updateFormData({ alarmSystemCode: e.target.value })}
                placeholder="e.g., 1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="securitySystemStatus">Security System Status</Label>
              <Select
                value={formData.securitySystemStatus}
                onValueChange={(value) => updateFormData({ securitySystemStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gateCode">Gate Code</Label>
              <Input
                id="gateCode"
                value={formData.gateCode}
                onChange={(e) => updateFormData({ gateCode: e.target.value })}
                placeholder="Community or driveway gate code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garageCode">Garage Code</Label>
              <Input
                id="garageCode"
                value={formData.garageCode}
                onChange={(e) => updateFormData({ garageCode: e.target.value })}
                placeholder="Garage door keypad code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockboxLocation">Lockbox Location</Label>
              <Input
                id="lockboxLocation"
                value={formData.lockboxLocation}
                onChange={(e) => updateFormData({ lockboxLocation: e.target.value })}
                placeholder="e.g., Front door handle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lockboxCode">Lockbox Code</Label>
              <Input
                id="lockboxCode"
                value={formData.lockboxCode}
                onChange={(e) => updateFormData({ lockboxCode: e.target.value })}
                placeholder="Lockbox combination"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="backupEntryMethod">Backup Entry Method</Label>
            <Input
              id="backupEntryMethod"
              value={formData.backupEntryMethod}
              onChange={(e) => updateFormData({ backupEntryMethod: e.target.value })}
              placeholder="e.g., Spare key under mat, neighbor has key"
            />
          </div>
        </CardContent>
      </Card>

      {/* Safety Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Safety Equipment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smokeDetectorStatus">Smoke Detector Status</Label>
              <Select
                value={formData.smokeDetectorStatus}
                onValueChange={(value) => updateFormData({ smokeDetectorStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {SMOKE_DETECTOR_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="fireExtinguisherPresent">Fire Extinguisher Present?</Label>
              </div>
              <Switch
                id="fireExtinguisherPresent"
                checked={formData.fireExtinguisherPresent}
                onCheckedChange={(checked) => updateFormData({ fireExtinguisherPresent: checked })}
              />
            </div>
          </div>
          {formData.fireExtinguisherPresent && (
            <div className="space-y-2">
              <Label htmlFor="fireExtinguisherLocation">Fire Extinguisher Location</Label>
              <Input
                id="fireExtinguisherLocation"
                value={formData.fireExtinguisherLocation}
                onChange={(e) => updateFormData({ fireExtinguisherLocation: e.target.value })}
                placeholder="e.g., Kitchen pantry, garage"
              />
            </div>
          )}
        </CardContent>
      </Card>

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parkingSpaces">Number of Parking Spaces</Label>
              <Input
                id="parkingSpaces"
                value={formData.parkingSpaces}
                onChange={(e) => updateFormData({ parkingSpaces: e.target.value })}
                placeholder="2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parkingType">Parking Type</Label>
              <Select
                value={formData.parkingType}
                onValueChange={(value) => updateFormData({ parkingType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxVehicles">Max Vehicles Allowed</Label>
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
          <div className="space-y-2">
            <Label htmlFor="parkingHoaRules">HOA Parking Rules</Label>
            <Textarea
              id="parkingHoaRules"
              value={formData.parkingHoaRules}
              onChange={(e) => updateFormData({ parkingHoaRules: e.target.value })}
              placeholder="Any HOA rules about parking, guest vehicles, etc."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Trash Collection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="w-5 h-5 text-primary" />
            Trash Collection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trashPickupDay">Trash Pickup Day</Label>
              <Select
                value={formData.trashPickupDay}
                onValueChange={(value) => updateFormData({ trashPickupDay: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {TRASH_DAY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trashBinLocation">Trash Bin Location</Label>
              <Input
                id="trashBinLocation"
                value={formData.trashBinLocation}
                onChange={(e) => updateFormData({ trashBinLocation: e.target.value })}
                placeholder="e.g., Side of garage, backyard"
              />
            </div>
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
              <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => updateFormData({ emergencyContact: e.target.value })}
                placeholder="Name for emergencies"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={formData.emergencyContactPhone}
                onChange={(e) => updateFormData({ emergencyContactPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="maintenanceContact">Maintenance Contact</Label>
              <Input
                id="maintenanceContact"
                value={formData.maintenanceContact}
                onChange={(e) => updateFormData({ maintenanceContact: e.target.value })}
                placeholder="Handyman or maintenance person name & phone"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
