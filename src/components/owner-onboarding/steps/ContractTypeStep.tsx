import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OwnerOnboardingFormData, CHECKIN_TIME_OPTIONS, CHECKOUT_TIME_OPTIONS } from '@/types/owner-onboarding';
import { Building2, Users } from 'lucide-react';

interface StepProps {
  formData: OwnerOnboardingFormData;
  updateFormData: (updates: Partial<OwnerOnboardingFormData>) => void;
}

export function ContractTypeStep({ formData, updateFormData }: StepProps) {
  const isCohosting = formData.contract_type === 'cohosting';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Management Agreement</h2>
        <p className="text-gray-600">Tell us about your management agreement and platform setup.</p>
      </div>

      {/* Contract Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Management Agreement Type</CardTitle>
          <CardDescription>
            What type of agreement did you sign with PeachHaus?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={formData.contract_type} 
            onValueChange={(value: 'full_service' | 'cohosting') => updateFormData({ contract_type: value })}
            className="space-y-4"
          >
            <div className={`flex items-start space-x-4 p-4 border rounded-xl transition-all ${formData.contract_type === 'full_service' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
              <RadioGroupItem value="full_service" id="full_service" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="full_service" className="flex items-center gap-2 cursor-pointer">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Full Service Management</span>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  PeachHaus will create and manage your Airbnb/VRBO listings from scratch. We handle everything including platform setup.
                </p>
              </div>
            </div>
            
            <div className={`flex items-start space-x-4 p-4 border rounded-xl transition-all ${formData.contract_type === 'cohosting' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
              <RadioGroupItem value="cohosting" id="cohosting" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="cohosting" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Co-hosting</span>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  You already have existing Airbnb/VRBO listings that PeachHaus will help manage as a co-host.
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Platform Account Questions - ONLY for Co-hosting */}
      {isCohosting && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Account Status</CardTitle>
            <CardDescription>
              Since you're a co-hosting client, we need to know about your existing platform accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Airbnb Account */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <Label htmlFor="has_airbnb_host_account" className="text-sm font-medium">
                  Do you have an existing Airbnb host account?
                </Label>
                <Switch
                  id="has_airbnb_host_account"
                  checked={formData.has_airbnb_host_account}
                  onCheckedChange={(checked) => updateFormData({ has_airbnb_host_account: checked })}
                />
              </div>

              {formData.has_airbnb_host_account && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                  <div>
                    <Label htmlFor="airbnb_account_status" className="text-sm font-medium">
                      Airbnb Account Status
                    </Label>
                    <Select
                      value={formData.airbnb_account_status}
                      onValueChange={(value) => updateFormData({ airbnb_account_status: value })}
                    >
                      <SelectTrigger className="h-14 mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verified">Verified & Active</SelectItem>
                        <SelectItem value="setup_needed">Needs Setup/Verification</SelectItem>
                        <SelectItem value="suspended">Suspended/Issues</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <Label htmlFor="airbnb_payment_method_setup" className="text-sm font-medium">
                      Payment method set up on Airbnb?
                    </Label>
                    <Switch
                      id="airbnb_payment_method_setup"
                      checked={formData.airbnb_payment_method_setup}
                      onCheckedChange={(checked) => updateFormData({ airbnb_payment_method_setup: checked })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* VRBO Account */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <Label htmlFor="has_vrbo_account" className="text-sm font-medium">
                  Do you have an existing VRBO account?
                </Label>
                <Switch
                  id="has_vrbo_account"
                  checked={formData.has_vrbo_account}
                  onCheckedChange={(checked) => updateFormData({ has_vrbo_account: checked })}
                />
              </div>

              {formData.has_vrbo_account && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <Label htmlFor="vrbo_account_status" className="text-sm font-medium">
                    VRBO Account Status
                  </Label>
                  <Select
                    value={formData.vrbo_account_status}
                    onValueChange={(value) => updateFormData({ vrbo_account_status: value })}
                  >
                    <SelectTrigger className="h-14 mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verified">Verified & Active</SelectItem>
                      <SelectItem value="setup_needed">Needs Setup/Verification</SelectItem>
                      <SelectItem value="suspended">Suspended/Issues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check-in/Check-out Times - For Both Contract Types */}
      <Card>
        <CardHeader>
          <CardTitle>Preferred Check-in/Check-out Times</CardTitle>
          <CardDescription>
            Set your standard times for guest arrivals and departures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preferred_checkin_time" className="text-sm font-medium">
                Check-in Time
              </Label>
              <Select
                value={formData.preferred_checkin_time}
                onValueChange={(value) => updateFormData({ preferred_checkin_time: value })}
              >
                <SelectTrigger className="h-14 mt-1">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {CHECKIN_TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="preferred_checkout_time" className="text-sm font-medium">
                Check-out Time
              </Label>
              <Select
                value={formData.preferred_checkout_time}
                onValueChange={(value) => updateFormData({ preferred_checkout_time: value })}
              >
                <SelectTrigger className="h-14 mt-1">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {CHECKOUT_TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
