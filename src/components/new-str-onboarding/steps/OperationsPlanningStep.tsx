import { NewSTROnboardingFormData, LAUNDRY_SETUP_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SprayCan, WashingMachine, Package, Wrench } from "lucide-react";

interface OperationsPlanningStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const OperationsPlanningStep = ({ formData, updateFormData }: OperationsPlanningStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Operations Planning</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Let's plan how your property will be maintained</p>
      </div>

      {/* Cleaning */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <SprayCan className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Cleaning Arrangements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasExistingCleaner" className="text-[hsl(25,30%,30%)]">Do you have an existing cleaner?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)]">Someone you'd like to continue using</p>
            </div>
            <Switch
              id="hasExistingCleaner"
              checked={formData.hasExistingCleaner}
              onCheckedChange={(checked) => updateFormData({ hasExistingCleaner: checked })}
            />
          </div>

          {formData.hasExistingCleaner ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[hsl(25,30%,90%)]">
              <div className="space-y-2">
                <Label htmlFor="cleanerName" className="text-[hsl(25,30%,30%)]">Cleaner Name</Label>
                <Input
                  id="cleanerName"
                  value={formData.cleanerName}
                  onChange={(e) => updateFormData({ cleanerName: e.target.value })}
                  placeholder="Maria Garcia"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanerPhone" className="text-[hsl(25,30%,30%)]">Cleaner Phone</Label>
                <Input
                  id="cleanerPhone"
                  type="tel"
                  value={formData.cleanerPhone}
                  onChange={(e) => updateFormData({ cleanerPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanerRate" className="text-[hsl(25,30%,30%)]">Rate per Clean ($)</Label>
                <Input
                  id="cleanerRate"
                  type="number"
                  min="0"
                  value={formData.cleanerRate || ''}
                  onChange={(e) => updateFormData({ cleanerRate: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="100"
                  className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-4 border-t border-[hsl(25,30%,90%)]">
              <div>
                <Label htmlFor="needsCleanerReferral" className="text-[hsl(25,30%,30%)]">Would you like a cleaner referral?</Label>
                <p className="text-sm text-[hsl(25,20%,55%)]">We can connect you with vetted cleaners in your area</p>
              </div>
              <Switch
                id="needsCleanerReferral"
                checked={formData.needsCleanerReferral}
                onCheckedChange={(checked) => updateFormData({ needsCleanerReferral: checked })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Immediate Repairs & Vendors */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Wrench className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Repairs & Vendor Relationships
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="immediateRepairs" className="text-[hsl(25,30%,30%)]">Immediate Repairs Needed</Label>
            <Textarea
              id="immediateRepairs"
              value={formData.immediateRepairs}
              onChange={(e) => updateFormData({ immediateRepairs: e.target.value })}
              placeholder="What needs to be fixed before guests can stay? (e.g., broken faucet, damaged flooring, HVAC repair)"
              rows={3}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="existingVendorRelationships" className="text-[hsl(25,30%,30%)]">Existing Vendor Relationships</Label>
            <Textarea
              id="existingVendorRelationships"
              value={formData.existingVendorRelationships}
              onChange={(e) => updateFormData({ existingVendorRelationships: e.target.value })}
              placeholder="List any trusted vendors you already work with (HVAC, plumber, electrician, handyman, lawn care, pool service, etc.)"
              rows={3}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Laundry */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <WashingMachine className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Laundry Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="laundrySetup" className="text-[hsl(25,30%,30%)]">Laundry Situation</Label>
            <Select
              value={formData.laundrySetup}
              onValueChange={(value) => updateFormData({ laundrySetup: value })}
            >
              <SelectTrigger className="h-12 rounded-xl border-[hsl(25,30%,85%)]">
                <SelectValue placeholder="Select laundry setup" />
              </SelectTrigger>
              <SelectContent>
                {LAUNDRY_SETUP_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="laundryNotes" className="text-[hsl(25,30%,30%)]">Laundry Notes</Label>
            <Textarea
              id="laundryNotes"
              value={formData.laundryNotes}
              onChange={(e) => updateFormData({ laundryNotes: e.target.value })}
              placeholder="Any special instructions or notes about laundry?"
              rows={2}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Supplies */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Package className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Supply Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplyStorageLocation" className="text-[hsl(25,30%,30%)]">Where will cleaning supplies be stored?</Label>
            <Textarea
              id="supplyStorageLocation"
              value={formData.supplyStorageLocation}
              onChange={(e) => updateFormData({ supplyStorageLocation: e.target.value })}
              placeholder="e.g., Hall closet, garage shelves, under kitchen sink..."
              rows={2}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
