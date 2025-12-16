import { NewSTROnboardingFormData, RENTAL_STRATEGY_OPTIONS, TARGET_GUEST_OPTIONS, PRICING_GOAL_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, DollarSign, Users } from "lucide-react";

interface RentalStrategyStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const RentalStrategyStep = ({ formData, updateFormData }: RentalStrategyStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Rental Strategy</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Help us understand your goals and target market</p>
      </div>

      {/* Strategy Selection */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Target className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Rental Approach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rentalStrategy">Rental Strategy *</Label>
            <Select
              value={formData.rentalStrategy}
              onValueChange={(value) => updateFormData({ rentalStrategy: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your rental strategy" />
              </SelectTrigger>
              <SelectContent>
                {RENTAL_STRATEGY_OPTIONS.map((strategy) => (
                  <SelectItem key={strategy} value={strategy}>
                    {strategy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetGuestAvatar">Target Guest Type</Label>
            <Select
              value={formData.targetGuestAvatar}
              onValueChange={(value) => updateFormData({ targetGuestAvatar: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Who is your ideal guest?" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_GUEST_OPTIONS.map((guest) => (
                  <SelectItem key={guest} value={guest}>
                    {guest}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricingGoal">Pricing Goal</Label>
            <Select
              value={formData.pricingGoal}
              onValueChange={(value) => updateFormData({ pricingGoal: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="What's your pricing priority?" />
              </SelectTrigger>
              <SelectContent>
                {PRICING_GOAL_OPTIONS.map((goal) => (
                  <SelectItem key={goal} value={goal}>
                    {goal}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
