import { NewSTROnboardingFormData, LAUNDRY_SETUP_OPTIONS, TURNOVER_TIME_OPTIONS } from "@/types/new-str-onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SprayCan, WashingMachine, Package, Clock } from "lucide-react";

interface OperationsPlanningStepProps {
  formData: NewSTROnboardingFormData;
  updateFormData: (updates: Partial<NewSTROnboardingFormData>) => void;
}

export const OperationsPlanningStep = ({ formData, updateFormData }: OperationsPlanningStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground">Operations Planning</h2>
        <p className="text-muted-foreground mt-2">Let's plan how your property will be maintained</p>
      </div>

      {/* Cleaning */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SprayCan className="w-5 h-5 text-primary" />
            Cleaning Arrangements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hasExistingCleaner">Do you have an existing cleaner?</Label>
              <p className="text-sm text-muted-foreground">Someone you'd like to continue using</p>
            </div>
            <Switch
              id="hasExistingCleaner"
              checked={formData.hasExistingCleaner}
              onCheckedChange={(checked) => updateFormData({ hasExistingCleaner: checked })}
            />
          </div>

          {formData.hasExistingCleaner ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="cleanerName">Cleaner Name</Label>
                <Input
                  id="cleanerName"
                  value={formData.cleanerName}
                  onChange={(e) => updateFormData({ cleanerName: e.target.value })}
                  placeholder="Maria Garcia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanerPhone">Cleaner Phone</Label>
                <Input
                  id="cleanerPhone"
                  type="tel"
                  value={formData.cleanerPhone}
                  onChange={(e) => updateFormData({ cleanerPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanerRate">Rate per Clean ($)</Label>
                <Input
                  id="cleanerRate"
                  type="number"
                  min="0"
                  value={formData.cleanerRate || ''}
                  onChange={(e) => updateFormData({ cleanerRate: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="100"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label htmlFor="needsCleanerReferral">Would you like a cleaner referral?</Label>
                <p className="text-sm text-muted-foreground">We can connect you with vetted cleaners in your area</p>
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

      {/* Laundry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <WashingMachine className="w-5 h-5 text-primary" />
            Laundry Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="laundrySetup">Laundry Situation</Label>
            <Select
              value={formData.laundrySetup}
              onValueChange={(value) => updateFormData({ laundrySetup: value })}
            >
              <SelectTrigger>
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
            <Label htmlFor="laundryNotes">Laundry Notes</Label>
            <Textarea
              id="laundryNotes"
              value={formData.laundryNotes}
              onChange={(e) => updateFormData({ laundryNotes: e.target.value })}
              placeholder="Any special instructions or notes about laundry?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Supplies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5 text-primary" />
            Supply Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplyStorageLocation">Where will cleaning supplies be stored?</Label>
            <Textarea
              id="supplyStorageLocation"
              value={formData.supplyStorageLocation}
              onChange={(e) => updateFormData({ supplyStorageLocation: e.target.value })}
              placeholder="e.g., Hall closet, garage shelves, under kitchen sink..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Turnover */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-primary" />
            Turnover Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preferredTurnoverTime">Preferred Turnover Time</Label>
            <Select
              value={formData.preferredTurnoverTime}
              onValueChange={(value) => updateFormData({ preferredTurnoverTime: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="How much time between guests?" />
              </SelectTrigger>
              <SelectContent>
                {TURNOVER_TIME_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="turnoverNotes">Turnover Notes</Label>
            <Textarea
              id="turnoverNotes"
              value={formData.turnoverNotes}
              onChange={(e) => updateFormData({ turnoverNotes: e.target.value })}
              placeholder="Any specific turnover requirements or preferences?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
