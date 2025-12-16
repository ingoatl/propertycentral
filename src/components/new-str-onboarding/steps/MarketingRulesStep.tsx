import { NewSTROnboardingFormData, PET_POLICY_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, PawPrint } from "lucide-react";

interface MarketingRulesStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const MarketingRulesStep = ({ formData, updateFormData }: MarketingRulesStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">House Rules & Policies</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Set expectations for your guests</p>
      </div>

      {/* General House Rules */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <ScrollText className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            General House Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="houseRules" className="text-[hsl(25,30%,30%)]">House Rules</Label>
            <Textarea
              id="houseRules"
              value={formData.houseRules}
              onChange={(e) => updateFormData({ houseRules: e.target.value })}
              placeholder="List any specific rules you want guests to follow..."
              rows={4}
              className="rounded-xl border-[hsl(25,30%,85%)]"
            />
            <p className="text-xs text-[hsl(25,20%,55%)]">
              Example: No shoes indoors, quiet hours after 10pm, respect the neighbors
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pet Policy */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <PawPrint className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Pet Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="petsAllowed" className="text-[hsl(25,30%,30%)]">Allow Pets?</Label>
              <p className="text-sm text-[hsl(25,20%,55%)]">Will you accept guests with pets?</p>
            </div>
            <Switch
              id="petsAllowed"
              checked={formData.petsAllowed}
              onCheckedChange={(checked) => updateFormData({ petsAllowed: checked })}
            />
          </div>

          {formData.petsAllowed && (
            <div className="space-y-4 pt-4 border-t border-[hsl(25,30%,90%)]">
              <div className="space-y-2">
                <Label htmlFor="petPolicy" className="text-[hsl(25,30%,30%)]">Pet Policy Details</Label>
                <Select
                  value={formData.petPolicy}
                  onValueChange={(value) => updateFormData({ petPolicy: value })}
                >
                  <SelectTrigger className="h-12 rounded-xl border-[hsl(25,30%,85%)]">
                    <SelectValue placeholder="Select your pet policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {PET_POLICY_OPTIONS.filter(p => p !== 'No Pets Allowed').map((policy) => (
                      <SelectItem key={policy} value={policy}>
                        {policy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="petDeposit" className="text-[hsl(25,30%,30%)]">Pet Fee ($)</Label>
                  <Input
                    id="petDeposit"
                    type="number"
                    min="0"
                    value={formData.petDeposit || ''}
                    onChange={(e) => updateFormData({ petDeposit: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="50"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="petSizeRestrictions" className="text-[hsl(25,30%,30%)]">Size/Breed Restrictions</Label>
                  <Input
                    id="petSizeRestrictions"
                    value={formData.petSizeRestrictions}
                    onChange={(e) => updateFormData({ petSizeRestrictions: e.target.value })}
                    placeholder="e.g., No aggressive breeds"
                    className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="petDepositRules" className="text-[hsl(25,30%,30%)]">Additional Pet Rules</Label>
                <Textarea
                  id="petDepositRules"
                  value={formData.petDepositRules}
                  onChange={(e) => updateFormData({ petDepositRules: e.target.value })}
                  placeholder="Any specific rules for pets? (e.g., must be crated when alone, no pets on furniture, etc.)"
                  rows={3}
                  className="rounded-xl border-[hsl(25,30%,85%)]"
                />
              </div>
            </div>
          )}

          {!formData.petsAllowed && (
            <div className="p-3 bg-[hsl(25,100%,97%)] rounded-xl border border-[hsl(25,50%,85%)]">
              <p className="text-sm text-[hsl(25,40%,35%)]">
                No pets will be allowed at this property. This will be clearly stated in your listings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
