import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, HelpCircle } from "lucide-react";

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
  other: { label: "Other Fields", icon: HelpCircle },
};

const PreFillFieldsStep = ({ data, updateData }: Props) => {
  const updateFieldValue = (fieldId: string, value: string | boolean) => {
    updateData({
      fieldValues: {
        ...data.fieldValues,
        [fieldId]: value,
      },
    });
  };

  // Separate admin and guest fields
  const adminFields = data.detectedFields.filter((f) => f.filled_by === "admin");
  const guestFields = data.detectedFields.filter((f) => f.filled_by === "guest");

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

  const adminFieldsByCategory = groupFieldsByCategory(adminFields);
  const guestFieldsByCategory = groupFieldsByCategory(guestFields);

  const renderField = (field: DetectedField, isGuestField: boolean = false) => {
    const value = data.fieldValues[field.api_id];

    if (field.type === "checkbox") {
      return (
        <div key={field.api_id} className="flex items-center space-x-2">
          <Checkbox
            id={field.api_id}
            checked={value === true}
            onCheckedChange={(checked) => updateFieldValue(field.api_id, checked as boolean)}
            disabled={isGuestField}
          />
          <Label htmlFor={field.api_id} className="font-normal">
            {field.label}
            {isGuestField && <Badge variant="outline" className="ml-2 text-xs">Guest fills</Badge>}
          </Label>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.api_id} className="space-y-2">
          <Label htmlFor={field.api_id}>
            {field.label}
            {isGuestField && <Badge variant="outline" className="ml-2 text-xs">Guest fills</Badge>}
          </Label>
          <Textarea
            id={field.api_id}
            value={(value as string) || ""}
            onChange={(e) => updateFieldValue(field.api_id, e.target.value)}
            placeholder={isGuestField ? "Guest will fill this field" : `Enter ${field.label.toLowerCase()}`}
            disabled={isGuestField}
            rows={3}
          />
        </div>
      );
    }

    return (
      <div key={field.api_id} className="space-y-2">
        <Label htmlFor={field.api_id}>
          {field.label}
          {isGuestField && <Badge variant="outline" className="ml-2 text-xs">Guest fills</Badge>}
        </Label>
        <Input
          id={field.api_id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={(value as string) || ""}
          onChange={(e) => updateFieldValue(field.api_id, e.target.value)}
          placeholder={isGuestField ? "Guest will fill this field" : `Enter ${field.label.toLowerCase()}`}
          disabled={isGuestField}
        />
      </div>
    );
  };

  const renderCategorySection = (
    category: string,
    fields: DetectedField[],
    isGuestSection: boolean = false
  ) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
    const Icon = config.icon;

    return (
      <div key={category} className="space-y-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">{config.label}</h3>
        </div>
        <div className={`grid grid-cols-1 ${fields.some(f => f.type === "textarea" || f.type === "checkbox") ? "" : "md:grid-cols-2"} gap-4`}>
          {fields.map((field) => renderField(field, isGuestSection))}
        </div>
      </div>
    );
  };

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
        <Label className="text-lg font-medium">Pre-fill Document Fields</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the fields below. Admin fields will be pre-filled in the document. Guest fields will be filled by the tenant when signing.
        </p>
      </div>

      {/* Summary */}
      <div className="p-3 bg-muted rounded-lg border">
        <p className="text-sm">
          <span className="font-medium">{adminFields.length}</span> fields for you to fill •{" "}
          <span className="font-medium">{guestFields.length}</span> fields for guest to fill
        </p>
      </div>

      {/* Admin Fields */}
      {adminFields.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant="default">Admin Fields</Badge>
            <span className="text-sm text-muted-foreground">Fill these before sending</span>
          </div>
          
          {Object.entries(adminFieldsByCategory).map(([category, fields]) => (
            <div key={category}>
              {renderCategorySection(category, fields, false)}
              <Separator className="mt-6" />
            </div>
          ))}
        </div>
      )}

      {/* Guest Fields */}
      {guestFields.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Guest Fields</Badge>
            <span className="text-sm text-muted-foreground">Guest will fill these when signing</span>
          </div>
          
          {Object.entries(guestFieldsByCategory).map(([category, fields]) => (
            <div key={category}>
              {renderCategorySection(category, fields, true)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PreFillFieldsStep;
