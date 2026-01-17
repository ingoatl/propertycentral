import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';
import { BedroomConfigBuilder } from '../BedroomConfigBuilder';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function OperationsStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Operations</h2>
        <p className="text-gray-600">Tell us about your current property operations and cleaning setup.</p>
      </div>

      {/* Bedroom Configuration */}
      <BedroomConfigBuilder
        configurations={formData.bedroom_configurations}
        onChange={(configurations) => updateFormData({ bedroom_configurations: configurations })}
      />

      {/* Cleaning Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Cleaning Team</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary_cleaner" className="text-sm font-medium">
              Primary Cleaner (Name/Contact) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="primary_cleaner"
              value={formData.primary_cleaner}
              onChange={(e) => updateFormData({ primary_cleaner: e.target.value })}
              placeholder="Jane Doe - (555) 123-4567"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="backup_cleaner" className="text-sm font-medium">
              Backup Cleaner
            </Label>
            <Input
              id="backup_cleaner"
              value={formData.backup_cleaner}
              onChange={(e) => updateFormData({ backup_cleaner: e.target.value })}
              placeholder="John Doe - (555) 987-6543"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="cleaner_satisfaction" className="text-sm font-medium">
              Happy with Current Cleaner?
            </Label>
            <Select
              value={formData.cleaner_satisfaction}
              onValueChange={(value) => updateFormData({ cleaner_satisfaction: value })}
            >
              <SelectTrigger className="h-14 mt-1">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
                <SelectItem value="Somewhat">Somewhat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="cleaner_payment" className="text-sm font-medium">
              Current Cleaner Payment
            </Label>
            <Input
              id="cleaner_payment"
              value={formData.cleaner_payment}
              onChange={(e) => updateFormData({ cleaner_payment: e.target.value })}
              placeholder="$150 per clean"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="cleaner_quality" className="text-sm font-medium">
              Quality Satisfaction
            </Label>
            <Select
              value={formData.cleaner_quality}
              onValueChange={(value) => updateFormData({ cleaner_quality: value })}
            >
              <SelectTrigger className="h-14 mt-1">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Average">Average</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="supply_closet_location" className="text-sm font-medium">
              Supply Closet Location
            </Label>
            <Input
              id="supply_closet_location"
              value={formData.supply_closet_location}
              onChange={(e) => updateFormData({ supply_closet_location: e.target.value })}
              placeholder="Hall closet near laundry"
              className="h-14 mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="laundry_notes" className="text-sm font-medium">
            Laundry Notes
          </Label>
          <Textarea
            id="laundry_notes"
            value={formData.laundry_notes}
            onChange={(e) => updateFormData({ laundry_notes: e.target.value })}
            placeholder="Special instructions for laundry..."
            className="mt-1"
          />
        </div>
      </div>

      {/* Property Details Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Property Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="guest_avatar" className="text-sm font-medium">
              Primary Guest Avatar
            </Label>
            <Input
              id="guest_avatar"
              value={formData.guest_avatar}
              onChange={(e) => updateFormData({ guest_avatar: e.target.value })}
              placeholder="Corporate traveler, nurse, etc."
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="existing_photos_link" className="text-sm font-medium">
              Existing Photos Link (Google Drive)
            </Label>
            <Input
              id="existing_photos_link"
              value={formData.existing_photos_link}
              onChange={(e) => updateFormData({ existing_photos_link: e.target.value })}
              placeholder="https://drive.google.com/..."
              className="h-14 mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="unique_selling_points" className="text-sm font-medium">
            Unique Selling Points
          </Label>
          <Textarea
            id="unique_selling_points"
            value={formData.unique_selling_points}
            onChange={(e) => updateFormData({ unique_selling_points: e.target.value })}
            placeholder="What makes this property special?"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="airbnb_link" className="text-sm font-medium">Airbnb Link</Label>
            <Input
              id="airbnb_link"
              value={formData.airbnb_link}
              onChange={(e) => updateFormData({ airbnb_link: e.target.value })}
              placeholder="https://airbnb.com/..."
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="vrbo_link" className="text-sm font-medium">VRBO Link</Label>
            <Input
              id="vrbo_link"
              value={formData.vrbo_link}
              onChange={(e) => updateFormData({ vrbo_link: e.target.value })}
              placeholder="https://vrbo.com/..."
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="furnished_finder_link" className="text-sm font-medium">Furnished Finder Link</Label>
            <Input
              id="furnished_finder_link"
              value={formData.furnished_finder_link}
              onChange={(e) => updateFormData({ furnished_finder_link: e.target.value })}
              placeholder="https://furnishedfinder.com/..."
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="booking_com_link" className="text-sm font-medium">Booking.com Link</Label>
            <Input
              id="booking_com_link"
              value={formData.booking_com_link}
              onChange={(e) => updateFormData({ booking_com_link: e.target.value })}
              placeholder="https://booking.com/..."
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="other_listing_links" className="text-sm font-medium">Other Listing Links</Label>
            <Input
              id="other_listing_links"
              value={formData.other_listing_links}
              onChange={(e) => updateFormData({ other_listing_links: e.target.value })}
              placeholder="Other platform links"
              className="h-14 mt-1"
            />
          </div>
        </div>

        {/* Current Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <Label htmlFor="current_nightly_rate" className="text-sm font-medium">Current Nightly Rate ($)</Label>
            <Input
              id="current_nightly_rate"
              type="number"
              min="0"
              value={formData.current_nightly_rate ?? ''}
              onChange={(e) => updateFormData({ current_nightly_rate: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="150"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="current_cleaning_fee" className="text-sm font-medium">Current Cleaning Fee ($)</Label>
            <Input
              id="current_cleaning_fee"
              type="number"
              min="0"
              value={formData.current_cleaning_fee ?? ''}
              onChange={(e) => updateFormData({ current_cleaning_fee: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="100"
              className="h-14 mt-1"
            />
          </div>
        </div>
      </div>

      {/* Pets Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Pet Policy</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <Label htmlFor="pets_allowed" className="text-sm font-medium">Pets Allowed?</Label>
          <Switch
            id="pets_allowed"
            checked={formData.pets_allowed}
            onCheckedChange={(checked) => updateFormData({ pets_allowed: checked })}
          />
        </div>

        {formData.pets_allowed && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pet_deposit" className="text-sm font-medium">Pet Deposit</Label>
              <Input
                id="pet_deposit"
                value={formData.pet_deposit}
                onChange={(e) => updateFormData({ pet_deposit: e.target.value })}
                placeholder="$250"
                className="h-14 mt-1"
              />
            </div>

            <div>
              <Label htmlFor="pet_size_restrictions" className="text-sm font-medium">Pet Size Restrictions</Label>
              <Input
                id="pet_size_restrictions"
                value={formData.pet_size_restrictions}
                onChange={(e) => updateFormData({ pet_size_restrictions: e.target.value })}
                placeholder="Max 50 lbs"
                className="h-14 mt-1"
              />
            </div>
          </div>
        )}
      </div>

      {/* Amenities Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Amenities & Features</h3>
        
        <div>
          <Label htmlFor="pool_hot_tub_info" className="text-sm font-medium">Pool/Hot Tub Info</Label>
          <Textarea
            id="pool_hot_tub_info"
            value={formData.pool_hot_tub_info}
            onChange={(e) => updateFormData({ pool_hot_tub_info: e.target.value })}
            placeholder="Pool service details, heating, etc."
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <Label htmlFor="has_thermostat" className="text-sm font-medium">Has Smart Thermostat?</Label>
          <Switch
            id="has_thermostat"
            checked={formData.has_thermostat}
            onCheckedChange={(checked) => updateFormData({ has_thermostat: checked })}
          />
        </div>

        {formData.has_thermostat && (
          <div>
            <Label htmlFor="thermostat_login" className="text-sm font-medium">Thermostat Login</Label>
            <Input
              id="thermostat_login"
              value={formData.thermostat_login}
              onChange={(e) => updateFormData({ thermostat_login: e.target.value })}
              placeholder="App name - email - password"
              className="h-14 mt-1"
            />
          </div>
        )}

        <div>
          <Label htmlFor="house_quirks" className="text-sm font-medium">
            House Quirks <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="house_quirks"
            value={formData.house_quirks}
            onChange={(e) => updateFormData({ house_quirks: e.target.value })}
            placeholder="Any special quirks or things to know about the property..."
            className="mt-1"
          />
        </div>
      </div>

      {/* Neighbors & Parking Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Neighbors & Parking</h3>
        
        <div>
          <Label htmlFor="sensitive_neighbor_notes" className="text-sm font-medium">Sensitive Neighbor Notes</Label>
          <Textarea
            id="sensitive_neighbor_notes"
            value={formData.sensitive_neighbor_notes}
            onChange={(e) => updateFormData({ sensitive_neighbor_notes: e.target.value })}
            placeholder="Any neighbor issues to be aware of..."
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_vehicles" className="text-sm font-medium">Max Vehicles</Label>
            <Input
              id="max_vehicles"
              type="number"
              value={formData.max_vehicles}
              onChange={(e) => updateFormData({ max_vehicles: e.target.value })}
              placeholder="2"
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="parking_instructions" className="text-sm font-medium">Parking Instructions</Label>
            <Input
              id="parking_instructions"
              value={formData.parking_instructions}
              onChange={(e) => updateFormData({ parking_instructions: e.target.value })}
              placeholder="Driveway only, no street parking"
              className="h-14 mt-1"
            />
          </div>
        </div>
      </div>

      {/* Property Condition Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Property Condition</h3>
        
        <div>
          <Label htmlFor="recent_renovations" className="text-sm font-medium">Recent Renovations</Label>
          <Textarea
            id="recent_renovations"
            value={formData.recent_renovations}
            onChange={(e) => updateFormData({ recent_renovations: e.target.value })}
            placeholder="List any recent updates or renovations..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="known_maintenance_issues" className="text-sm font-medium">Known Maintenance Issues</Label>
          <Textarea
            id="known_maintenance_issues"
            value={formData.known_maintenance_issues}
            onChange={(e) => updateFormData({ known_maintenance_issues: e.target.value })}
            placeholder="Any ongoing maintenance concerns..."
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
