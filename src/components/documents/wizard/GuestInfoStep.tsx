import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User, Mail, FileText } from "lucide-react";
import { WizardData } from "../DocumentCreateWizard";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const GuestInfoStep = ({ data, updateData }: Props) => {
  // Auto-generate document name when guest name, property, or template changes
  useEffect(() => {
    const templateName = data.templateName || "Document";
    const guestName = data.guestName || "";
    const propertyAddress = data.propertyName || data.fieldValues.property_address as string || "";
    
    // Build document name: Template - Guest Name - Property
    const parts = [templateName];
    if (guestName.trim()) {
      parts.push(guestName.trim());
    }
    if (propertyAddress.trim()) {
      parts.push(propertyAddress.trim());
    }
    
    const generatedName = parts.join(" - ");
    
    // Update if the name is empty or still matches a previously generated format
    if (!data.documentName || data.documentName.includes(" - ") || data.documentName === data.templateName) {
      updateData({ documentName: generatedName });
    }
  }, [data.guestName, data.propertyName, data.fieldValues.property_address, data.templateName]);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Guest Information</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the guest's details for the signing request
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="guestName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Guest Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="guestName"
            value={data.guestName}
            onChange={(e) => {
              const newName = e.target.value;
              updateData({ 
                guestName: newName,
                fieldValues: {
                  ...data.fieldValues,
                  guest_name: newName,
                  tenant_name: newName,
                  renter_name: newName,
                  occupant_name: newName,
                  guest_full_name: newName,
                }
              });
            }}
            placeholder="Enter guest's full legal name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="guestEmail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Guest Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="guestEmail"
            type="email"
            value={data.guestEmail}
            onChange={(e) => {
              const newEmail = e.target.value;
              updateData({ 
                guestEmail: newEmail,
                fieldValues: {
                  ...data.fieldValues,
                  guest_email: newEmail,
                  tenant_email: newEmail,
                  renter_email: newEmail,
                  occupant_email: newEmail,
                }
              });
            }}
            placeholder="guest@example.com"
            required
          />
          <p className="text-xs text-muted-foreground">
            The signing link will be sent to this email address
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="documentName" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Document Name
          </Label>
          <Input
            id="documentName"
            value={data.documentName}
            onChange={(e) => updateData({ documentName: e.target.value })}
            placeholder="e.g., Innkeeper Agreement - 123 Main St - John Doe"
          />
          <p className="text-xs text-muted-foreground">
            Auto-generated from property address and guest name. You can customize if needed.
          </p>
        </div>
      </div>

      {data.bookingId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Auto-filled from booking:</strong> Guest information has been pre-populated from
            the selected booking. You can modify it if needed.
          </p>
        </div>
      )}
    </div>
  );
};

export default GuestInfoStep;
