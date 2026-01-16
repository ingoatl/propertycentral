import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, HelpCircle, PenTool, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    const updatedFields = data.detectedFields.map((field) => {
      if (field.api_id === fieldId) {
        // Cycle through: admin -> guest -> tenant -> admin
        const nextRole = field.filled_by === "admin" ? "guest" : 
                        field.filled_by === "guest" ? "tenant" : "admin";
        return {
          ...field,
          filled_by: nextRole as "admin" | "guest" | "tenant",
        };
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
  const adminCount = data.detectedFields.filter(f => f.filled_by === "admin").length;
  const guestCount = data.detectedFields.filter(f => f.filled_by === "guest").length;
  const tenantCount = data.detectedFields.filter(f => f.filled_by === "tenant").length;

  if (data.detectedFields.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Fields Detected</h3>
        <p className="text-muted-foreground">
          No fillable fields were detected in this template. You can still proceed to add signature fields in the visual editor.
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
          <strong>Admin</strong> = You fill before sending | <strong>Guest</strong> = Guest fills when signing
        </AlertDescription>
      </Alert>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 p-3 bg-muted rounded-lg border">
        <Badge variant="default" className="px-3 py-1">
          Admin: {adminCount}
        </Badge>
        {guestCount > 0 && (
          <Badge variant="secondary" className="px-3 py-1 bg-[#fae052]/20">
            Owner: {guestCount}
          </Badge>
        )}
        {tenantCount > 0 && (
          <Badge variant="secondary" className="px-3 py-1 bg-green-100 text-green-700">
            Tenant: {tenantCount}
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {Object.entries(fieldsByCategory).map(([category, fields]) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
            const Icon = config.icon;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 sticky top-0 bg-background py-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">{config.label}</h3>
                  <span className="text-xs text-muted-foreground">({fields.length})</span>
                </div>
                
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.api_id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">{field.label}</span>
                        <span className="text-xs text-muted-foreground">
                          Type: {field.type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={field.filled_by === "admin" ? "default" : "secondary"}
                          className={
                            field.filled_by === "tenant" ? "bg-green-100 text-green-700" :
                            field.filled_by === "guest" ? "bg-[#fae052]/30 text-amber-700" : ""
                          }
                          onClick={() => toggleFieldAssignment(field.api_id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {field.filled_by === "admin" ? "Admin" : field.filled_by === "tenant" ? "Tenant" : "Owner"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AssignFieldsStep;
