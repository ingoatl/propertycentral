import { ComponentType } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, HelpCircle, PenTool, Info, UserCog, LucideIcon } from "lucide-react";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  property: { label: "Property Details", icon: Building },
  financial: { label: "Financial Terms", icon: DollarSign },
  dates: { label: "Lease Dates", icon: Calendar },
  occupancy: { label: "Occupancy & Policies", icon: Users },
  contact: { label: "Contact Information", icon: Phone },
  identification: { label: "Identification", icon: User },
  vehicle: { label: "Vehicle Information", icon: Car },
  emergency: { label: "Emergency Contact", icon: Phone },
  acknowledgment: { label: "Acknowledgments", icon: FileCheck },
  signature: { label: "Signatures", icon: PenTool },
  other: { label: "Other Fields", icon: HelpCircle },
};

const FieldAssignmentStep = ({ data, updateData }: Props) => {
  const toggleFieldAssignment = (fieldId: string) => {
    const updatedFields = data.detectedFields.map((field) => {
      if (field.api_id === fieldId) {
        return {
          ...field,
          filled_by: field.filled_by === "admin" ? "guest" : "admin",
        } as DetectedField;
      }
      return field;
    });
    updateData({ detectedFields: updatedFields });
  };

  // Group fields by category
  const groupFieldsByCategory = (fields: DetectedField[]) => {
    const grouped: Record<string, DetectedField[]> = {};
    fields.forEach((field) => {
      const category = field.category || "other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(field);
    });
    return grouped;
  };

  const fieldsByCategory = groupFieldsByCategory(data.detectedFields);
  const adminCount = data.detectedFields.filter((f) => f.filled_by === "admin").length;
  const guestCount = data.detectedFields.filter((f) => f.filled_by === "guest").length;

  if (data.detectedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Fields Detected</h3>
        <p className="text-muted-foreground">
          No fillable fields were detected in this template. You can still proceed to add fields manually in the visual editor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          Assign Field Responsibilities
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle each field to decide who fills it: Admin (you) or Guest (signer). Signatures should typically remain guest-filled.
        </p>
      </div>

      {/* Summary */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{adminCount}</strong> fields will be pre-filled by admin • <strong>{guestCount}</strong> fields will be completed by guest when signing
        </AlertDescription>
      </Alert>

      {/* Fields by Category */}
      <div className="space-y-6">
        {Object.entries(fieldsByCategory).map(([category, fields]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
          const Icon = config.icon;

          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">{config.label}</h3>
                <Badge variant="outline" className="text-xs">
                  {fields.length} field{fields.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-2 pl-6">
                {fields.map((field) => (
                  <div
                    key={field.api_id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{field.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {field.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        api_id: {field.api_id}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium ${
                          field.filled_by === "admin" ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        Admin
                      </span>
                      <Switch
                        checked={field.filled_by === "guest"}
                        onCheckedChange={() => toggleFieldAssignment(field.api_id)}
                      />
                      <span
                        className={`text-xs font-medium ${
                          field.filled_by === "guest" ? "text-blue-600" : "text-muted-foreground"
                        }`}
                      >
                        Guest
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="mt-4" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FieldAssignmentStep;
