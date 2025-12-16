import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { OwnerOnboardingFormData } from '@/types/owner-onboarding';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

interface FileUploadProps {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}

function FileUpload({ label, required, file, onChange }: FileUploadProps) {
  return (
    <div>
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="mt-1">
        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[hsl(25,95%,65%)] hover:bg-[hsl(25,100%,98%)] transition-all">
          {file ? (
            <div className="flex items-center gap-2 text-green-600">
              <FileText className="w-5 h-5" />
              <span className="text-sm truncate max-w-[200px]">{file.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500">
              <Upload className="w-5 h-5" />
              <span className="text-sm">Click to upload</span>
            </div>
          )}
          <input
            type="file"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
          />
        </label>
      </div>
    </div>
  );
}

export function DocumentsStep({ formData, updateFormData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Documents & Compliance</h2>
        <p className="text-gray-600">Upload required documents for property management.</p>
      </div>

      {/* Proof of Ownership Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Proof of Ownership</h3>
        <p className="text-sm text-gray-500">Required for property management agreement</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUpload
            label="Government-Issued Photo ID"
            required
            file={formData.government_id_file}
            onChange={(file) => updateFormData({ government_id_file: file })}
          />

          <FileUpload
            label="Property Deed/Title"
            required
            file={formData.property_deed_file}
            onChange={(file) => updateFormData({ property_deed_file: file })}
          />

          <FileUpload
            label="Property Tax Statement"
            required
            file={formData.property_tax_statement_file}
            onChange={(file) => updateFormData({ property_tax_statement_file: file })}
          />

          <FileUpload
            label="Mortgage Statement (Optional)"
            file={formData.mortgage_statement_file}
            onChange={(file) => updateFormData({ mortgage_statement_file: file })}
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="entity_ownership" className="text-sm font-medium">
              Entity Ownership
            </Label>
            <Select
              value={formData.entity_ownership}
              onValueChange={(value) => updateFormData({ entity_ownership: value })}
            >
              <SelectTrigger className="h-14 mt-1">
                <SelectValue placeholder="Select ownership type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="No - Individual">No - Individual</SelectItem>
                <SelectItem value="Yes - Trust/LLC/Entity">Yes - Trust/LLC/Entity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.entity_ownership === 'Yes - Trust/LLC/Entity' && (
            <FileUpload
              label="Entity Documents"
              required
              file={formData.entity_documents_file}
              onChange={(file) => updateFormData({ entity_documents_file: file })}
            />
          )}
        </div>
      </div>

      {/* HOA Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">HOA Information</h3>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <Label htmlFor="has_hoa" className="text-sm font-medium">Has HOA?</Label>
          <Switch
            id="has_hoa"
            checked={formData.has_hoa}
            onCheckedChange={(checked) => updateFormData({ has_hoa: checked })}
          />
        </div>

        {formData.has_hoa && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hoa_contact_name" className="text-sm font-medium">
                  HOA Contact Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="hoa_contact_name"
                  value={formData.hoa_contact_name}
                  onChange={(e) => updateFormData({ hoa_contact_name: e.target.value })}
                  placeholder="John Doe"
                  className="h-14 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="hoa_contact_phone" className="text-sm font-medium">
                  HOA Contact Phone <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="hoa_contact_phone"
                  value={formData.hoa_contact_phone}
                  onChange={(e) => updateFormData({ hoa_contact_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="h-14 mt-1"
                />
              </div>
            </div>

            <FileUpload
              label="HOA Rules (Optional)"
              file={formData.hoa_rules_file}
              onChange={(file) => updateFormData({ hoa_rules_file: file })}
            />
          </div>
        )}
      </div>

      {/* STR Permit Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">STR Permit</h3>
        
        <div>
          <Label htmlFor="str_permit_status" className="text-sm font-medium">Permit Status</Label>
          <Select
            value={formData.str_permit_status}
            onValueChange={(value) => updateFormData({ str_permit_status: value })}
          >
            <SelectTrigger className="h-14 mt-1">
              <SelectValue placeholder="Select permit status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Permit required - owner opts out">Permit required - owner opts out</SelectItem>
              <SelectItem value="No permit required">No permit required</SelectItem>
              <SelectItem value="Existing permit">Existing permit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.str_permit_status === 'Existing permit' && (
          <div>
            <Label htmlFor="permit_number" className="text-sm font-medium">
              Permit Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="permit_number"
              value={formData.permit_number}
              onChange={(e) => updateFormData({ permit_number: e.target.value })}
              placeholder="STR-2024-12345"
              className="h-14 mt-1"
            />
          </div>
        )}
      </div>

      {/* Insurance Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Insurance</h3>
        
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Important:</strong> PeachHaus Group LLC must be added as additional insured. 
            Please send updated copy to info@peachhausgroup.com within 7 days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="insurance_provider" className="text-sm font-medium">
              Insurance Provider <span className="text-red-500">*</span>
            </Label>
            <Input
              id="insurance_provider"
              value={formData.insurance_provider}
              onChange={(e) => updateFormData({ insurance_provider: e.target.value })}
              placeholder="State Farm, Allstate, etc."
              className="h-14 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="insurance_policy_number" className="text-sm font-medium">
              Insurance Policy # <span className="text-red-500">*</span>
            </Label>
            <Input
              id="insurance_policy_number"
              value={formData.insurance_policy_number}
              onChange={(e) => updateFormData({ insurance_policy_number: e.target.value })}
              placeholder="POL-123456789"
              className="h-14 mt-1"
            />
          </div>
        </div>
      </div>

      {/* Optional Documents Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Additional Documents (Optional)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FileUpload
            label="Guide Book"
            file={formData.guide_book_file}
            onChange={(file) => updateFormData({ guide_book_file: file })}
          />

          <FileUpload
            label="House Manual"
            file={formData.house_manual_file}
            onChange={(file) => updateFormData({ house_manual_file: file })}
          />

          <FileUpload
            label="Parking Map"
            file={formData.parking_map_file}
            onChange={(file) => updateFormData({ parking_map_file: file })}
          />
        </div>
      </div>
    </div>
  );
}
