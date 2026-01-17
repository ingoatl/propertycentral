import { NewSTROnboardingFormData, RENTAL_STRATEGY_OPTIONS, TARGET_GUEST_OPTIONS, PRICING_GOAL_OPTIONS, CONTRACT_TYPE_OPTIONS, AIRBNB_ACCOUNT_STATUS_OPTIONS, CHECKIN_TIME_OPTIONS, CHECKOUT_TIME_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Target, DollarSign, Users, Home, FileText, Clock, Building } from "lucide-react";

interface RentalStrategyStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const RentalStrategyStep = ({ formData, updateFormData }: RentalStrategyStepProps) => {
  const isCohosting = formData.contractType === 'cohosting';

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[hsl(25,40%,25%)]">Rental Strategy</h2>
        <p className="text-[hsl(25,20%,50%)] mt-2">Help us understand your goals and management preferences</p>
      </div>

      {/* Contract Type Selection - FIRST */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <FileText className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Management Agreement Type
          </CardTitle>
          <CardDescription>What type of agreement did you sign with PeachHaus?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.contractType}
            onValueChange={(value: 'full_service' | 'cohosting') => updateFormData({ contractType: value })}
            className="space-y-3"
          >
            {CONTRACT_TYPE_OPTIONS.map((option) => (
              <div 
                key={option.value} 
                className={`flex items-start space-x-3 p-4 border rounded-xl cursor-pointer transition-all ${
                  formData.contractType === option.value 
                    ? 'border-[hsl(25,95%,50%)] bg-[hsl(25,95%,98%)]' 
                    : 'border-[hsl(25,30%,85%)] hover:border-[hsl(25,30%,70%)]'
                }`}
              >
                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                <Label htmlFor={option.value} className="cursor-pointer flex-1">
                  <span className="font-semibold text-[hsl(25,40%,25%)]">{option.label}</span>
                  <span className="block text-sm text-[hsl(25,20%,50%)] mt-1">{option.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Cohosting Platform Account Questions - ONLY SHOWN FOR COHOSTING */}
      {isCohosting && (
        <Card className="rounded-2xl border-[hsl(120,30%,85%)] shadow-sm bg-[hsl(120,30%,98%)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-[hsl(120,40%,25%)]">
              <Building className="w-5 h-5 text-[hsl(120,50%,40%)]" />
              Platform Account Status
            </CardTitle>
            <CardDescription>Since you're a co-host, we need to know about your existing platform accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Airbnb Account */}
            <div className="space-y-4 p-4 bg-white rounded-xl border border-[hsl(25,30%,90%)]">
              <div className="space-y-3">
                <Label className="text-[hsl(25,30%,30%)] font-medium">Do you have an existing Airbnb host account?</Label>
                <RadioGroup
                  value={formData.hasAirbnbHostAccount ? "yes" : "no"}
                  onValueChange={(value) => updateFormData({ 
                    hasAirbnbHostAccount: value === "yes",
                    airbnbAccountStatus: value === "no" ? 'not_applicable' : ''
                  })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="airbnb-yes" />
                    <Label htmlFor="airbnb-yes" className="cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="airbnb-no" />
                    <Label htmlFor="airbnb-no" className="cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.hasAirbnbHostAccount && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="airbnbAccountStatus">Airbnb Account Status</Label>
                    <Select
                      value={formData.airbnbAccountStatus}
                      onValueChange={(value: 'verified' | 'setup_needed' | 'not_applicable') => 
                        updateFormData({ airbnbAccountStatus: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account status" />
                      </SelectTrigger>
                      <SelectContent>
                        {AIRBNB_ACCOUNT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[hsl(25,30%,30%)]">Is your payment method set up on Airbnb?</Label>
                    <RadioGroup
                      value={formData.airbnbPaymentMethodSetup ? "yes" : "no"}
                      onValueChange={(value) => updateFormData({ airbnbPaymentMethodSetup: value === "yes" })}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="airbnb-payment-yes" />
                        <Label htmlFor="airbnb-payment-yes" className="cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="airbnb-payment-no" />
                        <Label htmlFor="airbnb-payment-no" className="cursor-pointer">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="not_sure" id="airbnb-payment-notsure" />
                        <Label htmlFor="airbnb-payment-notsure" className="cursor-pointer">Not Sure</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </>
              )}
            </div>

            {/* VRBO Account */}
            <div className="space-y-4 p-4 bg-white rounded-xl border border-[hsl(25,30%,90%)]">
              <div className="space-y-3">
                <Label className="text-[hsl(25,30%,30%)] font-medium">Do you have an existing VRBO host account?</Label>
                <RadioGroup
                  value={formData.hasVrboAccount ? "yes" : "no"}
                  onValueChange={(value) => updateFormData({ 
                    hasVrboAccount: value === "yes",
                    vrboAccountStatus: value === "no" ? 'not_applicable' : ''
                  })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="vrbo-yes" />
                    <Label htmlFor="vrbo-yes" className="cursor-pointer">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="vrbo-no" />
                    <Label htmlFor="vrbo-no" className="cursor-pointer">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.hasVrboAccount && (
                <div className="space-y-2">
                  <Label htmlFor="vrboAccountStatus">VRBO Account Status</Label>
                  <Select
                    value={formData.vrboAccountStatus}
                    onValueChange={(value: 'verified' | 'setup_needed' | 'not_applicable') => 
                      updateFormData({ vrboAccountStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account status" />
                    </SelectTrigger>
                    <SelectContent>
                      {AIRBNB_ACCOUNT_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Check-in/Check-out Times */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Clock className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Check-in & Check-out Times
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="preferredCheckinTime">Preferred Check-in Time</Label>
            <Select
              value={formData.preferredCheckinTime}
              onValueChange={(value) => updateFormData({ preferredCheckinTime: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select check-in time" />
              </SelectTrigger>
              <SelectContent>
                {CHECKIN_TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredCheckoutTime">Preferred Check-out Time</Label>
            <Select
              value={formData.preferredCheckoutTime}
              onValueChange={(value) => updateFormData({ preferredCheckoutTime: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select check-out time" />
              </SelectTrigger>
              <SelectContent>
                {CHECKOUT_TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Existing Listing */}
      <Card className="rounded-2xl border-[hsl(25,30%,90%)] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[hsl(25,40%,25%)]">
            <Home className="w-5 h-5 text-[hsl(25,95%,50%)]" />
            Existing Listing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-[hsl(25,30%,30%)]">Do you currently have an Airbnb or VRBO listing for this property? *</Label>
            <RadioGroup
              value={formData.hasExistingListing ? "yes" : "no"}
              onValueChange={(value) => updateFormData({ hasExistingListing: value === "yes" })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="existing-yes" />
                <Label htmlFor="existing-yes" className="cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="existing-no" />
                <Label htmlFor="existing-no" className="cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          {formData.hasExistingListing && (
            <div className="space-y-2">
              <Label htmlFor="existingListingUrl" className="text-[hsl(25,30%,30%)]">
                Existing Listing URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="existingListingUrl"
                value={formData.existingListingUrl}
                onChange={(e) => updateFormData({ existingListingUrl: e.target.value })}
                placeholder="e.g., https://www.airbnb.com/rooms/123456"
                className="h-12 rounded-xl border-[hsl(25,30%,85%)]"
              />
              <p className="text-xs text-[hsl(25,20%,55%)]">
                Paste the URL of your existing Airbnb, VRBO, or other listing
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
