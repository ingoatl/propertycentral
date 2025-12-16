import { NewSTROnboardingFormData, STR_PERMIT_STATUS_OPTIONS, ENTITY_OWNERSHIP_OPTIONS, INSURANCE_STATUS_OPTIONS, HOA_APPROVAL_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Building, Shield, Landmark } from "lucide-react";

interface LegalComplianceStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const LegalComplianceStep = ({ formData, updateFormData }: LegalComplianceStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Legal & Compliance</h2>
        <p className="text-muted-foreground mt-2">Important legal information for your rental</p>
      </div>

      {/* STR Permit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Short-Term Rental Permit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="strPermitStatus">Permit Status *</Label>
            <Select
              value={formData.strPermitStatus}
              onValueChange={(value) => updateFormData({ strPermitStatus: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select permit status" />
              </SelectTrigger>
              <SelectContent>
                {STR_PERMIT_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.strPermitStatus === 'Already Have Permit' && (
            <div className="space-y-2">
              <Label htmlFor="permitNumber">Permit Number</Label>
              <Input
                id="permitNumber"
                value={formData.permitNumber}
                onChange={(e) => updateFormData({ permitNumber: e.target.value })}
                placeholder="Enter your permit number"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* HOA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="w-5 h-5 text-primary" />
            HOA Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hoaApprovalStatus">HOA STR Approval Status</Label>
            <Select
              value={formData.hoaApprovalStatus}
              onValueChange={(value) => updateFormData({ hoaApprovalStatus: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select HOA approval status" />
              </SelectTrigger>
              <SelectContent>
                {HOA_APPROVAL_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hoaRestrictions">Does your HOA have STR restrictions?</Label>
              <p className="text-sm text-muted-foreground">Any rules limiting short-term rentals</p>
            </div>
            <Switch
              id="hoaRestrictions"
              checked={formData.hoaRestrictions}
              onCheckedChange={(checked) => updateFormData({ hoaRestrictions: checked })}
            />
          </div>

          {formData.hoaRestrictions && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="hoaNotes">HOA Restriction Details</Label>
                <Textarea
                  id="hoaNotes"
                  value={formData.hoaNotes}
                  onChange={(e) => updateFormData({ hoaNotes: e.target.value })}
                  placeholder="Describe any HOA rules or restrictions..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hoaContactName">HOA Contact Name</Label>
                  <Input
                    id="hoaContactName"
                    value={formData.hoaContactName}
                    onChange={(e) => updateFormData({ hoaContactName: e.target.value })}
                    placeholder="Property manager name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hoaContactPhone">HOA Contact Phone</Label>
                  <Input
                    id="hoaContactPhone"
                    type="tel"
                    value={formData.hoaContactPhone}
                    onChange={(e) => updateFormData({ hoaContactPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="hoaRules">HOA Rules Summary</Label>
            <Textarea
              id="hoaRules"
              value={formData.hoaRules}
              onChange={(e) => updateFormData({ hoaRules: e.target.value })}
              placeholder="Summarize any important HOA rules guests should know about (noise, parking, pool hours, etc.)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Insurance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Insurance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="insuranceStatus">Insurance Status</Label>
            <Select
              value={formData.insuranceStatus}
              onValueChange={(value) => updateFormData({ insuranceStatus: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select insurance status" />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insuranceProvider">Insurance Provider</Label>
              <Input
                id="insuranceProvider"
                value={formData.insuranceProvider}
                onChange={(e) => updateFormData({ insuranceProvider: e.target.value })}
                placeholder="e.g., State Farm, Proper Insurance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
              <Input
                id="insurancePolicyNumber"
                value={formData.insurancePolicyNumber}
                onChange={(e) => updateFormData({ insurancePolicyNumber: e.target.value })}
                placeholder="Policy #"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasStrInsurance">Do you have STR-specific insurance?</Label>
              <p className="text-sm text-muted-foreground">Coverage that specifically covers short-term rentals</p>
            </div>
            <Switch
              id="hasStrInsurance"
              checked={formData.hasStrInsurance}
              onCheckedChange={(checked) => updateFormData({ hasStrInsurance: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Entity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="w-5 h-5 text-primary" />
            Ownership Entity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entityOwnership">How is the property owned?</Label>
            <Select
              value={formData.entityOwnership}
              onValueChange={(value) => updateFormData({ entityOwnership: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ownership type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OWNERSHIP_OPTIONS.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.entityOwnership && formData.entityOwnership !== 'Personal Name' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="entityName">Entity Name</Label>
                <Input
                  id="entityName"
                  value={formData.entityName}
                  onChange={(e) => updateFormData({ entityName: e.target.value })}
                  placeholder="e.g., Smith Properties LLC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / EIN</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => updateFormData({ taxId: e.target.value })}
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
