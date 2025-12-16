import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function SafetySecurityStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Safety & Security</h2>
        <p className="text-gray-600">Provide security system details and safety equipment locations.</p>
      </div>

      {/* Security System Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Security System</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <Label htmlFor="has_security_system" className="text-sm font-medium">Has Security System?</Label>
          <Switch
            id="has_security_system"
            checked={formData.has_security_system}
            onCheckedChange={(checked) => updateFormData({ has_security_system: checked })}
          />
        </div>

        {formData.has_security_system && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl">
            <div>
              <Label htmlFor="security_brand" className="text-sm font-medium">
                Security Brand/Model <span className="text-red-500">*</span>
              </Label>
              <Input
                id="security_brand"
                value={formData.security_brand}
                onChange={(e) => updateFormData({ security_brand: e.target.value })}
                placeholder="ADT, Ring, SimpliSafe, etc."
                className="h-14 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="alarm_code" className="text-sm font-medium">
                Alarm Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="alarm_code"
                value={formData.alarm_code}
                onChange={(e) => updateFormData({ alarm_code: e.target.value })}
                placeholder="1234"
                className="h-14 mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cameras Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Cameras</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <Label htmlFor="has_cameras" className="text-sm font-medium">Has Cameras?</Label>
          <Switch
            id="has_cameras"
            checked={formData.has_cameras}
            onCheckedChange={(checked) => updateFormData({ has_cameras: checked })}
          />
        </div>

        {formData.has_cameras && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-xl">
            <div>
              <Label htmlFor="camera_locations" className="text-sm font-medium">
                Camera Locations <span className="text-red-500">*</span>
              </Label>
              <Input
                id="camera_locations"
                value={formData.camera_locations}
                onChange={(e) => updateFormData({ camera_locations: e.target.value })}
                placeholder="Front door, driveway, backyard"
                className="h-14 mt-1"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="camera_login_website" className="text-sm font-medium">
                  Camera Login Website <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="camera_login_website"
                  value={formData.camera_login_website}
                  onChange={(e) => updateFormData({ camera_login_website: e.target.value })}
                  placeholder="https://ring.com/login"
                  className="h-14 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="camera_login_credentials" className="text-sm font-medium">
                  Camera Login Credentials <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="camera_login_credentials"
                  value={formData.camera_login_credentials}
                  onChange={(e) => updateFormData({ camera_login_credentials: e.target.value })}
                  placeholder="email / password"
                  className="h-14 mt-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safety Equipment Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Safety Equipment</h3>
        
        <div>
          <Label htmlFor="fire_extinguisher_locations" className="text-sm font-medium">
            Fire Extinguisher Locations <span className="text-red-500">*</span>
          </Label>
          <Input
            id="fire_extinguisher_locations"
            value={formData.fire_extinguisher_locations}
            onChange={(e) => updateFormData({ fire_extinguisher_locations: e.target.value })}
            placeholder="Kitchen, garage, hallway"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="smoke_co_detector_status" className="text-sm font-medium">
            Smoke/CO Detector Status
          </Label>
          <Select
            value={formData.smoke_co_detector_status}
            onValueChange={(value) => updateFormData({ smoke_co_detector_status: value })}
          >
            <SelectTrigger className="h-14 mt-1">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Working">Working</SelectItem>
              <SelectItem value="Needs Batteries">Needs Batteries</SelectItem>
              <SelectItem value="Not Installed">Not Installed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Utility Shutoffs Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Utility Shutoffs</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="water_shutoff_location" className="text-sm font-medium">
              Water Shut-off Location <span className="text-red-500">*</span>
            </Label>
            <Input
              id="water_shutoff_location"
              value={formData.water_shutoff_location}
              onChange={(e) => updateFormData({ water_shutoff_location: e.target.value })}
              placeholder="Front yard near sidewalk"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="breaker_panel_location" className="text-sm font-medium">
              Breaker Panel Location <span className="text-red-500">*</span>
            </Label>
            <Input
              id="breaker_panel_location"
              value={formData.breaker_panel_location}
              onChange={(e) => updateFormData({ breaker_panel_location: e.target.value })}
              placeholder="Garage, left wall"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="gas_shutoff_location" className="text-sm font-medium">
              Gas Shut-off Location
            </Label>
            <Input
              id="gas_shutoff_location"
              value={formData.gas_shutoff_location}
              onChange={(e) => updateFormData({ gas_shutoff_location: e.target.value })}
              placeholder="Side of house near meter"
              className="h-14 mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
