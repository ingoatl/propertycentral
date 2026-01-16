import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, HelpCircle, PenTool, Info, FileText, Sparkles } from "lucide-react";

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

// Mapping from extracted field names to common field patterns in templates
const FIELD_SEMANTIC_MAP: Record<string, string[]> = {
  // Property
  property_address: ['premises', 'property', 'address', 'residence', 'located', 'situated'],
  county: ['county'],
  state: ['state'],
  city: ['city'],
  zip_code: ['zip', 'postal'],
  
  // Financial
  monthly_rent: ['rent', 'monthly', 'installments', 'payment'],
  security_deposit: ['security', 'deposit'],
  cleaning_fee: ['cleaning'],
  admin_fee: ['admin', 'administration'],
  application_fee: ['application'],
  late_fee: ['late', 'penalty'],
  pet_fee: ['pet'],
  total_rent: ['total'],
  
  // Dates
  lease_start_date: ['start', 'begin', 'commence', 'effective'],
  lease_end_date: ['end', 'expire', 'termination'],
  rent_due_day: ['due', 'day'],
  
  // Parties
  landlord_name: ['landlord', 'lessor', 'owner', 'manager', 'management'],
  tenant_name: ['tenant', 'lessee', 'renter'],
  occupants: ['occupant', 'resident', 'person'],
};

const PreFillFieldsStep = ({ data, updateData }: Props) => {
  // Match extracted values to template field api_ids on mount
  React.useEffect(() => {
    if (!data.importSource || Object.keys(data.fieldValues).length === 0) return;
    
    const extractedValues = data.fieldValues;
    const matchedValues: Record<string, string | boolean> = { ...extractedValues };
    
    // For each detected field, try to find a matching extracted value
    data.detectedFields.forEach(field => {
      const apiIdLower = field.api_id.toLowerCase();
      const labelLower = field.label.toLowerCase();
      
      // If field already has a value, skip
      if (matchedValues[field.api_id]) return;
      
      // Try to match against extracted fields using semantic mapping
      for (const [extractedKey, patterns] of Object.entries(FIELD_SEMANTIC_MAP)) {
        const extractedValue = extractedValues[extractedKey];
        if (!extractedValue || typeof extractedValue !== 'string') continue;
        
        // Check if any pattern matches the field's api_id or label
        const matches = patterns.some(pattern => 
          apiIdLower.includes(pattern) || labelLower.includes(pattern)
        );
        
        if (matches) {
          matchedValues[field.api_id] = extractedValue;
          break;
        }
      }
    });
    
    // Only update if we found new matches
    if (Object.keys(matchedValues).length > Object.keys(extractedValues).length) {
      updateData({ fieldValues: matchedValues });
    }
  }, [data.importSource, data.detectedFields]);

  const updateFieldValue = (fieldId: string, value: string | boolean) => {
    updateData({
      fieldValues: {
        ...data.fieldValues,
        [fieldId]: value,
      },
    });
  };

  // Fields that should be auto-filled and hidden from the form
  const AUTO_FILLED_FIELDS = [
    'property_address', 'address', 'rental_address', 'listing_address',
    'host_name', 'landlord_name', 'agent_name', 'innkeeper_name',
    'property_name', 'listing_city', 'city', 'property_city',
    'lease_start', 'start_date', 'check_in_date', 'checkin_date',
    'lease_end', 'end_date', 'check_out_date', 'checkout_date',
    // Guest contact info - already collected in Guest Info step
    'guest_email', 'tenant_email', 'renter_email', 'occupant_email', 'email',
    'guest_name', 'tenant_name', 'renter_name', 'occupant_name', 'guest_full_name',
  ];
  
  // Fields that need AM/PM time selection
  const TIME_FIELDS = [
    'check_in_time', 'checkin_time', 'check_out_time', 'checkout_time',
    'arrival_time', 'departure_time',
  ];
  
  const isTimeField = (apiId: string) => {
    return TIME_FIELDS.some(field => 
      apiId.toLowerCase().includes(field.toLowerCase().replace('_', '')) ||
      apiId.toLowerCase() === field.toLowerCase()
    );
  };

  // Filter out auto-filled fields from admin fields
  const isAutoFilledField = (apiId: string) => {
    return AUTO_FILLED_FIELDS.some(field => 
      apiId.toLowerCase().includes(field.toLowerCase().replace('_', '')) ||
      apiId.toLowerCase() === field.toLowerCase()
    );
  };

  // Check if a field was imported from document or has a matched value
  const isImportedField = (apiId: string) => {
    if (!data.importSource) return false;
    // Check if this field has a value that came from import
    const hasValue = !!data.fieldValues[apiId];
    const wasDirectlyImported = data.importedFields?.includes(apiId);
    return hasValue || wasDirectlyImported;
  };

  // Get the value for a field - check both direct api_id and semantic matches
  const getFieldValue = (apiId: string): string | boolean | undefined => {
    // First check direct match
    if (data.fieldValues[apiId] !== undefined) {
      return data.fieldValues[apiId];
    }
    
    // Then check semantic matches from extracted data
    const apiIdLower = apiId.toLowerCase();
    for (const [extractedKey, patterns] of Object.entries(FIELD_SEMANTIC_MAP)) {
      const extractedValue = data.fieldValues[extractedKey];
      if (!extractedValue) continue;
      
      if (patterns.some(p => apiIdLower.includes(p))) {
        return extractedValue;
      }
    }
    
    return undefined;
  };

  // Separate fields by type
  const adminFields = data.detectedFields.filter(
    (f) => f.filled_by === "admin" && f.category !== "signature" && !isAutoFilledField(f.api_id)
  );
  const guestFields = data.detectedFields.filter((f) => f.filled_by === "guest" && f.category !== "signature");
  const signatureFields = data.detectedFields.filter((f) => f.category === "signature");
  
  const guestSignatureFields = signatureFields.filter(f => f.filled_by === "guest");
  const hostSignatureFields = signatureFields.filter(f => f.filled_by === "admin");

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

  const renderField = (field: DetectedField, isGuestField: boolean = false) => {
    const value = getFieldValue(field.api_id);
    const imported = isImportedField(field.api_id) || (data.importSource && value);
    // Skip signature type fields - they're placed in visual editor
    if (field.type === "signature") {
      return null;
    }

    if (field.type === "checkbox") {
      return (
        <div key={field.api_id} className="flex items-center space-x-2">
          <Checkbox
            id={field.api_id}
            checked={value === true}
            onCheckedChange={(checked) => updateFieldValue(field.api_id, checked as boolean)}
            disabled={isGuestField}
          />
          <Label htmlFor={field.api_id} className="font-normal flex items-center gap-2">
            {field.label}
            {imported && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Sparkles className="h-3 w-3 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Imported from document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isGuestField && <Badge variant="outline" className="text-xs">Guest fills</Badge>}
          </Label>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.api_id} className="space-y-2">
          <Label htmlFor={field.api_id} className="flex items-center gap-2">
            {field.label}
            {imported && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Sparkles className="h-3 w-3 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Imported from document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isGuestField && <Badge variant="outline" className="text-xs">Guest fills</Badge>}
          </Label>
          <Textarea
            id={field.api_id}
            value={(value as string) || ""}
            onChange={(e) => updateFieldValue(field.api_id, e.target.value)}
            placeholder={isGuestField ? "Guest will fill this field" : `Enter ${field.label.toLowerCase()}`}
            disabled={isGuestField}
            rows={3}
            className={imported ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10" : ""}
          />
        </div>
      );
    }

    // Time fields with AM/PM selector
    if (isTimeField(field.api_id)) {
      const currentValue = (value as string) || "";
      const timeMatch = currentValue.match(/^(\d{1,2})\s*(AM|PM)?$/i);
      const hour = timeMatch ? timeMatch[1] : "";
      const period = timeMatch ? (timeMatch[2]?.toUpperCase() || "") : "";
      
      const updateTimeValue = (newHour: string, newPeriod: string) => {
        if (newHour && newPeriod) {
          updateFieldValue(field.api_id, `${newHour} ${newPeriod}`);
        } else if (newHour) {
          updateFieldValue(field.api_id, newHour);
        }
      };
      
      return (
        <div key={field.api_id} className="space-y-2">
          <Label htmlFor={field.api_id} className="flex items-center gap-2">
            {field.label}
            {imported && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Sparkles className="h-3 w-3 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Imported from document</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isGuestField && <Badge variant="outline" className="text-xs">Guest fills</Badge>}
          </Label>
          <div className="flex gap-2">
            <Input
              id={field.api_id}
              type="number"
              min="1"
              max="12"
              value={hour}
              onChange={(e) => updateTimeValue(e.target.value, period)}
              placeholder="Hour"
              disabled={isGuestField}
              className={`w-20 ${imported ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
            />
            <Select
              value={period}
              onValueChange={(newPeriod) => updateTimeValue(hour, newPeriod)}
              disabled={isGuestField}
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="AM/PM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }
    return (
      <div key={field.api_id} className="space-y-2">
        <Label htmlFor={field.api_id} className="flex items-center gap-2">
          {field.label}
          {imported && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Sparkles className="h-3 w-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Imported from document</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isGuestField && <Badge variant="outline" className="text-xs">Guest fills</Badge>}
        </Label>
        <Input
          id={field.api_id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={(value as string) || ""}
          onChange={(e) => updateFieldValue(field.api_id, e.target.value)}
          placeholder={isGuestField ? "Guest will fill this field" : `Enter ${field.label.toLowerCase()}`}
          disabled={isGuestField}
          className={imported ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10" : ""}
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
    const renderedFields = fields.map((field) => renderField(field, isGuestSection)).filter(Boolean);
    
    if (renderedFields.length === 0) return null;

    return (
      <div key={category} className="space-y-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">{config.label}</h3>
        </div>
        <div className={`grid grid-cols-1 ${fields.some(f => f.type === "textarea" || f.type === "checkbox") ? "" : "md:grid-cols-2"} gap-4`}>
          {renderedFields}
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

  // Count fields that have values
  const filledFieldsCount = adminFields.filter(f => getFieldValue(f.api_id)).length;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Prepare Document Values</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the admin fields below. These values will be used when you place text fields in the visual editor.
        </p>
      </div>

      {/* Import Source Alert */}
      {data.importSource && (
        <Alert className="border-amber-300 bg-amber-50/50 dark:bg-amber-900/10">
          <FileText className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Imported from:</strong> {data.importSource}
            <br />
            <span className="text-sm text-muted-foreground">
              {data.importedFields?.length || 0} fields extracted. Values are highlighted with <Sparkles className="h-3 w-3 inline text-amber-500" /> and are editable.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Important Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How this works:</strong> Enter values here, then in the next step you'll use the visual editor to drag and drop fields onto the document. Text fields can display these pre-filled values.
        </AlertDescription>
      </Alert>

      {/* Summary */}
      <div className="p-3 bg-muted rounded-lg border">
        <p className="text-sm">
          <span className="font-medium">{adminFields.length}</span> admin fields 
          {data.importSource && <span className="text-amber-600"> ({filledFieldsCount} pre-filled)</span>} •{" "}
          <span className="font-medium">{guestFields.length}</span> guest fields •{" "}
          <span className="font-medium">{signatureFields.length}</span> signature fields
        </p>
      </div>

      {/* Admin Fields */}
      {adminFields.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant="default">Admin Fields</Badge>
            <span className="text-sm text-muted-foreground">Fill these before opening the visual editor</span>
          </div>
          
          {Object.entries(adminFieldsByCategory).map(([category, fields]) => (
            <div key={category}>
              {renderCategorySection(category, fields, false)}
              <Separator className="mt-6" />
            </div>
          ))}
        </div>
      )}

      {/* Guest Fields Summary */}
      {guestFields.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Guest Fields</Badge>
            <span className="text-sm text-muted-foreground">Guest will fill these when signing</span>
          </div>
          
          <div className="p-4 bg-secondary/20 rounded-lg border">
            <h4 className="font-medium text-sm mb-2">Fields guest will complete:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              {guestFields.map((field) => (
                <li key={field.api_id}>{field.label}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Signature Fields Summary */}
      {signatureFields.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500">Signature Fields</Badge>
            <span className="text-sm text-muted-foreground">Add these in the visual editor</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guestSignatureFields.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-sm mb-2 text-blue-800 dark:text-blue-200">Guest Signatures:</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  {guestSignatureFields.map((field) => (
                    <li key={field.api_id}>{field.label}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {hostSignatureFields.length > 0 && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-sm mb-2 text-purple-800 dark:text-purple-200">Host Signatures:</h4>
                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1 list-disc list-inside">
                  {hostSignatureFields.map((field) => (
                    <li key={field.api_id}>{field.label}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PreFillFieldsStep;
