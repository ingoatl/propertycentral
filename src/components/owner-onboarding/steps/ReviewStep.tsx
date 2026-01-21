import { Check, FileText } from 'lucide-react';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface ReviewStepProps {
  formData: OwnerOnboardingFormData;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  
  return (
    <div className="flex justify-between items-start gap-4 py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{displayValue}</span>
    </div>
  );
}

function FileField({ label, file }: { label: string; file: File | null }) {
  if (!file) return null;
  
  return (
    <div className="flex items-center gap-2 py-1">
      <FileText className="w-4 h-4 text-green-600" />
      <span className="text-sm text-gray-600">{label}:</span>
      <span className="text-sm font-medium text-green-600">{file.name}</span>
    </div>
  );
}

export function ReviewStep({ formData }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Information</h2>
        <p className="text-gray-600">Please review all information before submitting.</p>
      </div>

      <div className="space-y-4">
        {/* Owner Info */}
        <Section title="Owner Information">
          <Field label="Owner Name" value={formData.owner_name} />
          <Field label="Owner Email" value={formData.owner_email} />
          <Field label="Owner Phone" value={formData.owner_phone} />
          <Field label="Property Address" value={formData.property_address} />
        </Section>

        {/* Access Details */}
        <Section title="Access Details">
          <Field label="WiFi SSID" value={formData.wifi_ssid} />
          <Field label="WiFi Password" value={formData.wifi_password} />
          <Field label="Smart Lock Brand" value={formData.smart_lock_brand} />
          <Field label="Smart Lock Code" value={formData.smart_lock_code} />
          <Field label="Lockbox Code" value={formData.lockbox_code} />
          <Field label="Backup Key Location" value={formData.backup_key_location} />
          <Field label="Maids Closet Code" value={formData.maids_closet_code} />
          <Field label="Trash Pickup Day" value={formData.trash_pickup_day} />
          <Field label="Trash Bin Location" value={formData.trash_bin_location} />
          <Field label="Gate Code" value={formData.gate_code} />
          <Field label="Garage Code" value={formData.garage_code} />
        </Section>

        {/* Utilities */}
        <Section title="Utilities">
          <Field label="Wastewater System" value={formData.wastewater_system} />
          {formData.wastewater_system === 'Septic' && (
            <>
              <Field label="Septic Last Pumped" value={formData.septic_last_pumped} />
              <Field label="Septic Company" value={formData.septic_company} />
            </>
          )}
          {formData.utilities.map((util, index) => (
            <div key={index} className="pl-2 border-l-2 border-gray-200 ml-2">
              <Field label={`${util.type} Provider`} value={util.provider} />
            </div>
          ))}
        </Section>

        {/* Operations */}
        <Section title="Operations">
          <Field label="Primary Cleaner" value={formData.primary_cleaner} />
          <Field label="Backup Cleaner" value={formData.backup_cleaner} />
          <Field label="Cleaner Satisfaction" value={formData.cleaner_satisfaction} />
          <Field label="Cleaner Payment" value={formData.cleaner_payment} />
          <Field label="Cleaner Quality" value={formData.cleaner_quality} />
          <Field label="Guest Avatar" value={formData.guest_avatar} />
          <Field label="Pets Allowed" value={formData.pets_allowed} />
          {formData.pets_allowed && (
            <>
              <Field label="Pet Deposit" value={formData.pet_deposit} />
              <Field label="Pet Size Restrictions" value={formData.pet_size_restrictions} />
            </>
          )}
          <Field label="Has Thermostat" value={formData.has_thermostat} />
          <Field label="House Quirks" value={formData.house_quirks} />
        </Section>

        {/* Vendors */}
        <Section title="Vendors">
          <Field label="Lawncare Provider" value={formData.lawncare_provider} />
          <Field label="Pest Control Provider" value={formData.pest_control_provider} />
          <Field label="HVAC Service" value={formData.hvac_service} />
          <Field label="Maintenance Contact" value={formData.maintenance_contact} />
          <Field label="Emergency Contact (24/7)" value={formData.emergency_contact_24_7} />
        </Section>

        {/* Safety & Security */}
        <Section title="Safety & Security">
          <Field label="Has Security System" value={formData.has_security_system} />
          {formData.has_security_system && (
            <>
              <Field label="Security Brand" value={formData.security_brand} />
              <Field label="Alarm Code" value={formData.alarm_code} />
            </>
          )}
          <Field label="Has Cameras" value={formData.has_cameras} />
          {formData.has_cameras && (
            <Field label="Camera Locations" value={formData.camera_locations} />
          )}
          <Field label="Fire Extinguisher Locations" value={formData.fire_extinguisher_locations} />
          <Field label="Smoke/CO Detector Status" value={formData.smoke_co_detector_status} />
          <Field label="Water Shut-off Location" value={formData.water_shutoff_location} />
          <Field label="Breaker Panel Location" value={formData.breaker_panel_location} />
          <Field label="Gas Shut-off Location" value={formData.gas_shutoff_location} />
        </Section>

        {/* Documents */}
        <Section title="Documents & Compliance">
          <FileField label="Government ID" file={formData.government_id_file} />
          <FileField label="Property Deed" file={formData.property_deed_file} />
          <FileField label="Property Tax Statement" file={formData.property_tax_statement_file} />
          <FileField label="Mortgage Statement" file={formData.mortgage_statement_file} />
          <Field label="Entity Ownership" value={formData.entity_ownership} />
          <FileField label="Entity Documents" file={formData.entity_documents_file} />
          <Field label="Has HOA" value={formData.has_hoa} />
          {formData.has_hoa && (
            <>
              <Field label="HOA Contact Name" value={formData.hoa_contact_name} />
              <Field label="HOA Contact Phone" value={formData.hoa_contact_phone} />
            </>
          )}
          <Field label="STR Permit Status" value={formData.str_permit_status} />
          <Field label="Permit Number" value={formData.permit_number} />
          <Field label="Insurance Provider" value={formData.insurance_provider} />
          <Field label="Insurance Policy #" value={formData.insurance_policy_number} />
        </Section>

        {/* Financial */}
        <Section title="Financial Performance">
          <Field label="Average Daily Rate" value={formData.average_daily_rate ? `$${formData.average_daily_rate}` : ''} />
          <Field label="Occupancy Rate" value={formData.occupancy_rate ? `${formData.occupancy_rate}%` : ''} />
          <Field label="Average Monthly Revenue" value={formData.average_monthly_revenue ? `$${formData.average_monthly_revenue}` : ''} />
          <Field label="Average Monthly Revenue" value={formData.average_monthly_revenue ? `$${formData.average_monthly_revenue}` : ''} />
          <Field label="Peak Season" value={formData.peak_season} />
          <Field label="Peak Season ADR" value={formData.peak_season_adr ? `$${formData.peak_season_adr}` : ''} />
          <Field label="Pricing & Revenue Goals" value={formData.pricing_revenue_goals} />
        </Section>
      </div>

      <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-green-800">
          <strong>Ready to submit!</strong> Click "Submit Onboarding" below to complete your property onboarding.
          Our team will review your information and reach out within one business day.
        </p>
      </div>
    </div>
  );
}
