import { NewSTROnboardingFormData, PET_POLICY_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, PawPrint, DoorClosed, Volume2, Cigarette, PartyPopper } from "lucide-react";

interface MarketingRulesStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const MarketingRulesStep = ({ formData, updateFormData }: MarketingRulesStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">House Rules & Policies</h2>
        <p className="text-muted-foreground mt-2">Set expectations for your guests</p>
      </div>

      {/* General House Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="w-5 h-5 text-primary" />
            General House Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="houseRules">House Rules</Label>
            <Textarea
              id="houseRules"
              value={formData.houseRules}
              onChange={(e) => updateFormData({ houseRules: e.target.value })}
              placeholder="List any specific rules you want guests to follow..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Example: No shoes indoors, quiet hours after 10pm, respect the neighbors
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pet Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PawPrint className="w-5 h-5 text-primary" />
            Pet Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="petPolicy">Pet Policy</Label>
            <Select
              value={formData.petPolicy}
              onValueChange={(value) => updateFormData({ petPolicy: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your pet policy" />
              </SelectTrigger>
              <SelectContent>
                {PET_POLICY_OPTIONS.map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {policy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.petPolicy && formData.petPolicy !== 'No Pets Allowed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="petDeposit">Pet Fee ($)</Label>
                <Input
                  id="petDeposit"
                  type="number"
                  min="0"
                  value={formData.petDeposit || ''}
                  onChange={(e) => updateFormData({ petDeposit: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="petSizeRestrictions">Size/Breed Restrictions</Label>
                <Input
                  id="petSizeRestrictions"
                  value={formData.petSizeRestrictions}
                  onChange={(e) => updateFormData({ petSizeRestrictions: e.target.value })}
                  placeholder="e.g., No aggressive breeds"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checkout Procedures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DoorClosed className="w-5 h-5 text-primary" />
            Checkout Procedures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="checkoutProcedures">Checkout Instructions</Label>
            <Textarea
              id="checkoutProcedures"
              value={formData.checkoutProcedures}
              onChange={(e) => updateFormData({ checkoutProcedures: e.target.value })}
              placeholder="What should guests do before leaving? e.g., Start dishwasher, strip beds, take out trash..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Policies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Noise Policy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Volume2 className="w-4 h-4 text-primary" />
              Noise Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.noisePolicy}
              onChange={(e) => updateFormData({ noisePolicy: e.target.value })}
              placeholder="e.g., Quiet hours 10pm-8am"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Smoking Policy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cigarette className="w-4 h-4 text-primary" />
              Smoking Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.smokingPolicy}
              onChange={(e) => updateFormData({ smokingPolicy: e.target.value })}
              placeholder="e.g., No smoking inside, designated area outside"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Party Policy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PartyPopper className="w-4 h-4 text-primary" />
              Party/Events Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.partyPolicy}
              onChange={(e) => updateFormData({ partyPolicy: e.target.value })}
              placeholder="e.g., No parties or events, max occupancy enforced"
              rows={2}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
