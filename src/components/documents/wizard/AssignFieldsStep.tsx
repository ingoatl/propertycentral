import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, HelpCircle, PenTool, Info } from "lucide-react";

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
  // Initialize field assignments from detected fields if not already set
  useEffect(() => {
    if (Object.keys(data.fieldAssignments).length === 0 && data.detectedFields.length > 0) {
      const initialAssignments: Record<string, "admin" | "guest"> = {};
      data.detectedFields.forEach((field) => {
        initialAssignments[field.api_id] = field.filled_by;
      });
      updateData({ fieldAssignments: initialAssignments });
    }
  }, [data.detectedFields, data.fieldAssignments, updateData]);

  const toggleFieldAssignment = (fieldId: string) => {
    const currentAssignment = data.fieldAssignments[fieldId] || "admin";
    const newAssignment = currentAssignment === "admin" ? "guest" : "admin";
    updateData({
      fieldAssignments: {
        ...data.fieldAssignments,
        [fieldId]: newAssignment,
      },
    });
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
  const adminCount = Object.values(data.fieldAssignments).filter(v => v === "admin").length;
  const guestCount = Object.values(data.fieldAssignments).filter(v => v === "guest").length;

  if (data.detectedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Fields Detected</h3>
        <p className="text-muted-foreground">
          No fillable fields were detected. You can still add signature fields in the visual editor.
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

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin:</strong> You pre-fill these values before sending. <strong>Guest:</strong> The signer fills these when signing.
        </AlertDescription>
      </Alert>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="flex-1 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800 text-center">
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{adminCount}</div>
          <div className="text-sm text-purple-600 dark:text-purple-400">Admin Fields</div>
        </div>
        <div className="flex-1 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 text-center">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{guestCount}</div>
          <div className="text-sm text-blue-600 dark:text-blue-400">Guest Fields</div>
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
                <h3 className="font-medium">{config.label}</h3>
                <Badge variant="outline" className="text-xs">
                  {fields.length} field{fields.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-2">
                {fields.map((field) => {
                  const isGuest = data.fieldAssignments[field.api_id] === "guest";
                  
                  return (
                    <div
                      key={field.api_id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isGuest 
                          ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" 
                          : "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{field.label}</span>
                          {field.type === "signature" && (
                            <Badge variant="secondary" className="text-xs">
                              <PenTool className="h-3 w-3 mr-1" />
                              Signature
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Type: {field.type}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${!isGuest ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground"}`}>
                          Admin
                        </span>
                        <Switch
                          checked={isGuest}
                          onCheckedChange={() => toggleFieldAssignment(field.api_id)}
                        />
                        <span className={`text-xs font-medium ${isGuest ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                          Guest
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssignFieldsStep;
