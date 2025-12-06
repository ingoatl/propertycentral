import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, HelpCircle, PenTool } from "lucide-react";

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
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

const AssignFieldsStep = ({ data, updateData }: Props) => {
  const toggleFieldAssignment = (fieldId: string) => {
    const currentAssignment = data.fieldAssignments[fieldId] || 
      (data.detectedFields.find(f => f.api_id === fieldId)?.filled_by || "admin");
    
    const newAssignment = currentAssignment === "admin" ? "guest" : "admin";
    
    updateData({
      fieldAssignments: {
        ...data.fieldAssignments,
        [fieldId]: newAssignment,
      },
    });
  };

  const getFieldAssignment = (field: DetectedField): "admin" | "guest" => {
    return data.fieldAssignments[field.api_id] || field.filled_by;
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

  // Count assignments
  const adminCount = data.detectedFields.filter(f => getFieldAssignment(f) === "admin").length;
  const guestCount = data.detectedFields.filter(f => getFieldAssignment(f) === "guest").length;

  if (data.detectedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Fields Detected</h3>
        <p className="text-muted-foreground">
          No fields were detected. You can still proceed to add fields manually in the visual editor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Assign Field Responsibility</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle each field to decide who fills it: Admin (you) or Guest (signer).
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 p-3 bg-muted rounded-lg border">
        <div className="flex items-center gap-2">
          <Badge variant="default">{adminCount}</Badge>
          <span className="text-sm">Admin fields</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{guestCount}</Badge>
          <span className="text-sm">Guest fields</span>
        </div>
      </div>

      {/* Fields by Category */}
      <div className="space-y-6">
        {Object.entries(fieldsByCategory).map(([category, fields]) => {
          const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
          const Icon = config.icon;

          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">{config.label}</h3>
              </div>

              <div className="space-y-2">
                {fields.map((field) => {
                  const assignment = getFieldAssignment(field);
                  const isGuestAssigned = assignment === "guest";

                  return (
                    <div
                      key={field.api_id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isGuestAssigned
                          ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                          : "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{field.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        <span className={`text-xs font-medium ${!isGuestAssigned ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground"}`}>
                          Admin
                        </span>
                        <Switch
                          checked={isGuestAssigned}
                          onCheckedChange={() => toggleFieldAssignment(field.api_id)}
                        />
                        <span className={`text-xs font-medium ${isGuestAssigned ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                          Guest
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssignFieldsStep;
