import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { WizardData } from "../DocumentCreateWizard";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const PreFillFieldsStep = ({ data, updateData }: Props) => {
  const updatePreFillData = (field: string, value: string) => {
    updateData({
      preFillData: {
        ...data.preFillData,
        [field]: value,
      },
    });
  };

  const updateGuestFields = (field: string, value: boolean) => {
    updateData({
      guestFields: {
        ...data.guestFields,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Pre-fill Document Fields</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Enter property and lease details to pre-fill the document. The guest will fill their own
          information when signing.
        </p>
      </div>

      {/* Property Details */}
      <div className="space-y-4">
        <h3 className="font-medium">Property Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address</Label>
            <Input
              id="propertyAddress"
              value={data.preFillData.propertyAddress}
              onChange={(e) => updatePreFillData("propertyAddress", e.target.value)}
              placeholder="123 Main St, City, State 12345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brandName">Property Brand Name</Label>
            <Input
              id="brandName"
              value={data.preFillData.brandName}
              onChange={(e) => updatePreFillData("brandName", e.target.value)}
              placeholder="e.g., The Sunset Villa"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Financial Terms */}
      <div className="space-y-4">
        <h3 className="font-medium">Financial Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyRent">Monthly Rent ($)</Label>
            <Input
              id="monthlyRent"
              type="number"
              value={data.preFillData.monthlyRent}
              onChange={(e) => updatePreFillData("monthlyRent", e.target.value)}
              placeholder="2500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="securityDeposit">Security Deposit ($)</Label>
            <Input
              id="securityDeposit"
              type="number"
              value={data.preFillData.securityDeposit}
              onChange={(e) => updatePreFillData("securityDeposit", e.target.value)}
              placeholder="2500"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Lease Dates */}
      <div className="space-y-4">
        <h3 className="font-medium">Lease Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="leaseStartDate">Lease Start Date</Label>
            <Input
              id="leaseStartDate"
              type="date"
              value={data.preFillData.leaseStartDate}
              onChange={(e) => updatePreFillData("leaseStartDate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leaseEndDate">Lease End Date</Label>
            <Input
              id="leaseEndDate"
              type="date"
              value={data.preFillData.leaseEndDate}
              onChange={(e) => updatePreFillData("leaseEndDate", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Occupancy & Policies */}
      <div className="space-y-4">
        <h3 className="font-medium">Occupancy & Policies</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxOccupants">Maximum Occupants</Label>
            <Input
              id="maxOccupants"
              type="number"
              value={data.preFillData.maxOccupants}
              onChange={(e) => updatePreFillData("maxOccupants", e.target.value)}
              placeholder="4"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="petPolicy">Pet Policy</Label>
            <Input
              id="petPolicy"
              value={data.preFillData.petPolicy}
              onChange={(e) => updatePreFillData("petPolicy", e.target.value)}
              placeholder="No pets allowed"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Additional Terms */}
      <div className="space-y-4">
        <h3 className="font-medium">Additional Terms</h3>
        <div className="space-y-2">
          <Label htmlFor="additionalTerms">Special Terms & Conditions</Label>
          <Textarea
            id="additionalTerms"
            value={data.preFillData.additionalTerms}
            onChange={(e) => updatePreFillData("additionalTerms", e.target.value)}
            placeholder="Enter any additional terms or conditions..."
            rows={4}
          />
        </div>
      </div>

      <Separator />

      {/* Guest Required Fields */}
      <div className="space-y-4">
        <h3 className="font-medium">Guest Required Fields</h3>
        <p className="text-sm text-muted-foreground">
          Select which fields the guest must fill out when signing
        </p>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requireEmergencyContact"
              checked={data.guestFields.requireEmergencyContact}
              onCheckedChange={(checked) =>
                updateGuestFields("requireEmergencyContact", checked as boolean)
              }
            />
            <Label htmlFor="requireEmergencyContact" className="font-normal">
              Require Emergency Contact Information
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requireVehicleInfo"
              checked={data.guestFields.requireVehicleInfo}
              onCheckedChange={(checked) =>
                updateGuestFields("requireVehicleInfo", checked as boolean)
              }
            />
            <Label htmlFor="requireVehicleInfo" className="font-normal">
              Require Vehicle Information (make, model, license plate)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requireAcknowledgment"
              checked={data.guestFields.requireAcknowledgment}
              onCheckedChange={(checked) =>
                updateGuestFields("requireAcknowledgment", checked as boolean)
              }
            />
            <Label htmlFor="requireAcknowledgment" className="font-normal">
              Require Terms Acknowledgment Checkboxes
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreFillFieldsStep;
