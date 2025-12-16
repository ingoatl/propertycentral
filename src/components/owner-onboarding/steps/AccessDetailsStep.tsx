import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function AccessDetailsStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Details</h2>
        <p className="text-gray-600">Provide all access codes and entry information for the property.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="wifi_ssid" className="text-sm font-medium">
            WiFi Network Name (SSID) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="wifi_ssid"
            value={formData.wifi_ssid}
            onChange={(e) => updateFormData({ wifi_ssid: e.target.value })}
            placeholder="MyWiFiNetwork"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="wifi_password" className="text-sm font-medium">
            WiFi Password <span className="text-red-500">*</span>
          </Label>
          <Input
            id="wifi_password"
            value={formData.wifi_password}
            onChange={(e) => updateFormData({ wifi_password: e.target.value })}
            placeholder="password123"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="smart_lock_brand" className="text-sm font-medium">
            Smart Lock Brand/Model <span className="text-red-500">*</span>
          </Label>
          <Input
            id="smart_lock_brand"
            value={formData.smart_lock_brand}
            onChange={(e) => updateFormData({ smart_lock_brand: e.target.value })}
            placeholder="Schlage Encode"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="smart_lock_code" className="text-sm font-medium">
            Smart Lock Code <span className="text-red-500">*</span>
          </Label>
          <Input
            id="smart_lock_code"
            value={formData.smart_lock_code}
            onChange={(e) => updateFormData({ smart_lock_code: e.target.value })}
            placeholder="1234"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="lockbox_code" className="text-sm font-medium">
            Lockbox Code
          </Label>
          <Input
            id="lockbox_code"
            value={formData.lockbox_code}
            onChange={(e) => updateFormData({ lockbox_code: e.target.value })}
            placeholder="5678"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="backup_key_location" className="text-sm font-medium">
            Backup Key Location
          </Label>
          <Input
            id="backup_key_location"
            value={formData.backup_key_location}
            onChange={(e) => updateFormData({ backup_key_location: e.target.value })}
            placeholder="Under the mat by the back door"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="maids_closet_code" className="text-sm font-medium">
            Maids Closet Code
          </Label>
          <Input
            id="maids_closet_code"
            value={formData.maids_closet_code}
            onChange={(e) => updateFormData({ maids_closet_code: e.target.value })}
            placeholder="9999"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="trash_pickup_day" className="text-sm font-medium">
            Trash Pickup Day
          </Label>
          <Select
            value={formData.trash_pickup_day}
            onValueChange={(value) => updateFormData({ trash_pickup_day: value })}
          >
            <SelectTrigger className="h-14 mt-1">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Monday">Monday</SelectItem>
              <SelectItem value="Tuesday">Tuesday</SelectItem>
              <SelectItem value="Wednesday">Wednesday</SelectItem>
              <SelectItem value="Thursday">Thursday</SelectItem>
              <SelectItem value="Friday">Friday</SelectItem>
              <SelectItem value="Saturday">Saturday</SelectItem>
              <SelectItem value="Sunday">Sunday</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="trash_bin_location" className="text-sm font-medium">
            Trash Bin Location
          </Label>
          <Input
            id="trash_bin_location"
            value={formData.trash_bin_location}
            onChange={(e) => updateFormData({ trash_bin_location: e.target.value })}
            placeholder="Side of garage"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="gate_code" className="text-sm font-medium">
            Gate Code
          </Label>
          <Input
            id="gate_code"
            value={formData.gate_code}
            onChange={(e) => updateFormData({ gate_code: e.target.value })}
            placeholder="#1234"
            className="h-14 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="garage_code" className="text-sm font-medium">
            Garage Code
          </Label>
          <Input
            id="garage_code"
            value={formData.garage_code}
            onChange={(e) => updateFormData({ garage_code: e.target.value })}
            placeholder="5555"
            className="h-14 mt-1"
          />
        </div>
      </div>
    </div>
  );
}
