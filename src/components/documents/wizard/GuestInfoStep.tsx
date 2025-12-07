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
  // Check if template name contains "innkeeper"
  const isInnkeeperTemplate = data.templateName?.toLowerCase().includes("innkeeper");
  
  // Auto-generate document name when guest name or property changes
  useEffect(() => {
    if (!isInnkeeperTemplate) return;
    
    const propertyAddress = data.fieldValues.property_address as string || "";
    const guestName = data.guestName || "";
    
    // Generate name with placeholders or actual values
    const displayGuestName = guestName || "(Guest Name)";
    const displayAddress = propertyAddress || "(Property Address)";
    const generatedName = `Innkeeper Agreement - ${displayGuestName} - ${displayAddress}`;
    
    // Update if the name is empty or still matches a previously generated format
    if (!data.documentName || data.documentName.startsWith("Innkeeper Agreement - ")) {
      updateData({ documentName: generatedName });
    }
  }, [data.guestName, data.fieldValues.property_address, isInnkeeperTemplate]);

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
            onChange={(e) => updateData({ guestName: e.target.value })}
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
            onChange={(e) => updateData({ guestEmail: e.target.value })}
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
