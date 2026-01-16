import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WizardData, DetectedField } from "../DocumentCreateWizard";
import { 
  User, Building, DollarSign, Calendar, Users, Car, Phone, FileCheck, 
  HelpCircle, PenTool, Info, FileText, Sparkles, Upload, Loader2, 
  CheckCircle, X, ChevronDown, ChevronRight, Home
} from "lucide-react";
import { getFieldLabelInfo, getCategoryHelpText } from "@/utils/fieldLabelMapping";
import { format } from "date-fns";
import { toast } from "sonner";

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Booking {
  id: string;
  tenant_name: string;
  tenant_email: string | null;
  start_date: string;
  end_date: string;
  monthly_rent: number;
}

interface Props {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; priority: number }> = {
  property: { label: "Property Details", icon: Building, priority: 1 },
  financial: { label: "Financial Terms", icon: DollarSign, priority: 2 },
  dates: { label: "Lease Dates", icon: Calendar, priority: 3 },
  occupancy: { label: "Occupancy & Policies", icon: Users, priority: 4 },
  contact: { label: "Contact Information", icon: Phone, priority: 5 },
  identification: { label: "Identification", icon: User, priority: 6 },
  vehicle: { label: "Vehicle Information", icon: Car, priority: 7 },
  emergency: { label: "Emergency Contact", icon: Phone, priority: 8 },
  acknowledgment: { label: "Acknowledgments", icon: FileCheck, priority: 9 },
  signature: { label: "Signatures", icon: PenTool, priority: 10 },
  other: { label: "Other Fields", icon: HelpCircle, priority: 11 },
};

// Sample default values for the lease
const SAMPLE_VALUES: Record<string, string> = {
  // Landlord Info
  landlord_name: "PeachHaus Group LLC",
  lessor_name: "PeachHaus Group LLC",
  management_company: "PeachHaus Group LLC",
  landlord_representative: "Ingo Schaer, Operations Manager",
  
  // Property
  county: "DeKalb County, Georgia",
  property_address: "3708 Canadian Way, Tucker, GA 30084",
  
  // Financial - Rent
  monthly_rent: "$6,360.00",
  rent_amount: "$6,360.00",
  rent_due_day: "9th of each month",
  late_after: "14th of the month",
  
  // Fees
  late_fee: "$50.00",
  daily_late_fee: "$30.00",
  security_deposit: "$1,500.00",
  cleaning_fee: "$400",
  admin_fee: "$250",
  application_fee: "$50",
  mandatory_cleaning: "$150",
  
  // Payment
  payment_method: "ACH / wire (online payment preferred)",
  escrow_bank: "Thread Bank, Rogersville, TN",
  
  // Terms
  lease_type: "1-month lease with month-to-month extension option",
  notice_period: "14-day notice required by either party",
  furnishing_status: "Fully Furnished",
  renters_insurance: "Optional (tenant's discretion)",
  
  // Utilities
  utilities_tenant: "Gas, Water, Trash, Electricity",
  
  // Third Party
  third_party_payor: "ALE Solutions, Inc.",
};

// Auto-filled fields (hidden from form)
const AUTO_FILLED_FIELDS = [
  'guest_email', 'tenant_email', 'renter_email', 'occupant_email', 'email',
  'guest_name', 'tenant_name', 'renter_name', 'occupant_name', 'guest_full_name',
];

const FillDocumentStep = ({ data, updateData }: Props) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    property: true,
    financial: true,
    dates: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load properties
  useEffect(() => {
    loadProperties();
  }, []);

  // Load bookings when property changes
  useEffect(() => {
    if (data.propertyId) {
      loadBookings(data.propertyId);
    } else {
      setBookings([]);
    }
  }, [data.propertyId]);

  // Apply smart defaults on mount
  useEffect(() => {
    const today = new Date();
    const firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    
    const smartDefaults: Record<string, string> = {
      // Auto-set dates
      document_date: format(today, "MMMM d, yyyy"),
      signing_date: format(today, "MMMM d, yyyy"),
      execution_date: format(today, "MMMM d, yyyy"),
      effective_date: format(firstOfNextMonth, "MMMM d, yyyy"),
      ...SAMPLE_VALUES,
    };

    // Only apply defaults that don't already have values
    const newValues: Record<string, string | boolean> = { ...data.fieldValues };
    let hasNewValues = false;
    
    Object.entries(smartDefaults).forEach(([key, value]) => {
      if (!newValues[key]) {
        newValues[key] = value;
        hasNewValues = true;
      }
    });

    if (hasNewValues) {
      updateData({ fieldValues: newValues });
    }
  }, []);

  const loadProperties = async () => {
    try {
      const { data: propertiesData, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .order("name");

      if (error) throw error;
      setProperties(propertiesData || []);
    } catch (error) {
      console.error("Error loading properties:", error);
    } finally {
      setLoadingProperties(false);
    }
  };

  const loadBookings = async (propertyId: string) => {
    setLoadingBookings(true);
    try {
      const { data: bookingsData, error } = await supabase
        .from("mid_term_bookings")
        .select("id, tenant_name, tenant_email, start_date, end_date, monthly_rent")
        .eq("property_id", propertyId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setBookings(bookingsData || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const formatDateForDisplay = (dateStr: string): string => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return format(date, "MMMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: string): string => {
    const num = value.replace(/[^0-9.]/g, '');
    if (!num) return value;
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return value;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    }).format(parsed);
  };

  const handlePropertySelect = (propertyId: string) => {
    const actualId = propertyId === "_none" ? null : propertyId;
    const property = actualId ? properties.find((p) => p.id === actualId) : null;
    const propertyAddress = property?.address || "";
    
    updateData({
      propertyId: actualId,
      propertyName: property?.name || null,
      bookingId: null,
      fieldValues: {
        ...data.fieldValues,
        property_address: propertyAddress,
        address: propertyAddress,
        property_name: property?.name || "",
      },
    });
  };

  const handleBookingSelect = (bookingId: string) => {
    const actualId = bookingId === "_none" ? null : bookingId;
    if (actualId) {
      const booking = bookings.find((b) => b.id === actualId);
      if (booking) {
        updateData({
          bookingId: actualId,
          guestName: booking.tenant_name,
          guestEmail: booking.tenant_email || "",
          fieldValues: {
            ...data.fieldValues,
            monthly_rent: formatCurrency(booking.monthly_rent.toString()),
            lease_start_date: formatDateForDisplay(booking.start_date),
            lease_end_date: formatDateForDisplay(booking.end_date),
            guest_name: booking.tenant_name,
            tenant_name: booking.tenant_name,
          },
        });
      }
    } else {
      updateData({ bookingId: null });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await supabase.functions.invoke("extract-lease-data", {
        body: formData,
      });

      if (response.error) throw new Error(response.error.message);

      const { extractedData, fieldsExtracted } = response.data;
      
      if (extractedData && Object.keys(extractedData).length > 0) {
        updateData({
          fieldValues: { ...data.fieldValues, ...extractedData },
          importSource: file.name,
          importedFields: Object.keys(extractedData),
          guestName: extractedData.tenant_name || data.guestName,
          guestEmail: extractedData.tenant_email || data.guestEmail,
        });
        
        toast.success(`Extracted ${fieldsExtracted} fields from document`);
      } else {
        toast.warning("No data could be extracted");
      }
    } catch (error) {
      console.error("Document extraction error:", error);
      toast.error("Failed to extract data");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateFieldValue = (fieldId: string, value: string | boolean) => {
    // Auto-format currency fields
    let formattedValue = value;
    if (typeof value === 'string' && isCurrencyField(fieldId) && value.match(/^\d+\.?\d*$/)) {
      formattedValue = formatCurrency(value);
    }
    
    updateData({
      fieldValues: { ...data.fieldValues, [fieldId]: formattedValue },
    });
  };

  const isCurrencyField = (apiId: string): boolean => {
    const currencyPatterns = ['rent', 'fee', 'deposit', 'amount', 'charge', 'cost', 'price', 'payment'];
    return currencyPatterns.some(p => apiId.toLowerCase().includes(p));
  };

  const toggleSection = (category: string) => {
    setExpandedSections(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // Filter admin fields (excluding signatures and auto-filled)
  const adminFields = data.detectedFields.filter(
    (f) => f.filled_by === "admin" && f.category !== "signature" && 
    !AUTO_FILLED_FIELDS.some(af => f.api_id.toLowerCase().includes(af))
  );

  // Group fields by category
  const groupFieldsByCategory = (fields: DetectedField[]) => {
    const grouped: Record<string, DetectedField[]> = {};
    fields.forEach((field) => {
      const category = field.category || "other";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(field);
    });
    return grouped;
  };

  const adminFieldsByCategory = groupFieldsByCategory(adminFields);
  const sortedCategories = Object.keys(adminFieldsByCategory).sort(
    (a, b) => (CATEGORY_CONFIG[a]?.priority || 99) - (CATEGORY_CONFIG[b]?.priority || 99)
  );

  // Calculate progress
  const totalFields = adminFields.length;
  const filledFields = adminFields.filter(f => !!data.fieldValues[f.api_id]).length;
  const progressPercent = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;

  // Guest and signature fields
  const guestFields = data.detectedFields.filter(
    (f) => (f.filled_by === "guest" || f.filled_by === "tenant") && f.category !== "signature"
  );
  const signatureFields = data.detectedFields.filter((f) => f.category === "signature");

  const renderField = (field: DetectedField) => {
    const value = data.fieldValues[field.api_id];
    const imported = data.importedFields?.includes(field.api_id);
    const labelInfo = getFieldLabelInfo(field.api_id, field.label);

    if (field.type === "signature") return null;

    if (field.type === "checkbox") {
      return (
        <div key={field.api_id} className="flex items-center space-x-2">
          <Checkbox
            id={field.api_id}
            checked={value === true}
            onCheckedChange={(checked) => updateFieldValue(field.api_id, checked as boolean)}
          />
          <Label htmlFor={field.api_id} className="font-normal flex items-center gap-2">
            {labelInfo.label}
            {imported && <Sparkles className="h-3 w-3 text-amber-500" />}
          </Label>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.api_id} className="space-y-2 col-span-2">
          <Label htmlFor={field.api_id} className="flex items-center gap-2">
            {labelInfo.label}
            {imported && <Sparkles className="h-3 w-3 text-amber-500" />}
            {labelInfo.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs"><p>{labelInfo.description}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </Label>
          <Textarea
            id={field.api_id}
            value={(value as string) || ""}
            onChange={(e) => updateFieldValue(field.api_id, e.target.value)}
            placeholder={labelInfo.placeholder}
            rows={2}
            className={imported ? "border-amber-300 bg-amber-50/50" : ""}
          />
        </div>
      );
    }

    return (
      <div key={field.api_id} className="space-y-2">
        <Label htmlFor={field.api_id} className="flex items-center gap-2 text-sm">
          {labelInfo.label}
          {imported && <Sparkles className="h-3 w-3 text-amber-500" />}
          {labelInfo.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>{labelInfo.description}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </Label>
        <Input
          id={field.api_id}
          type={field.type === "date" ? "date" : "text"}
          inputMode={isCurrencyField(field.api_id) ? "decimal" : field.type === "number" ? "numeric" : "text"}
          value={(value as string) || ""}
          onChange={(e) => updateFieldValue(field.api_id, e.target.value)}
          placeholder={labelInfo.placeholder}
          className={imported ? "border-amber-300 bg-amber-50/50" : ""}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-lg font-medium">Fill Document Values</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the admin fields below. Tenant only signs and initials.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{filledFields} of {totalFields} fields</p>
          <Progress value={progressPercent} className="h-2 w-32 mt-1" />
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-2">
        {/* Property Selector */}
        {!loadingProperties && (
          <Select value={data.propertyId || "_none"} onValueChange={handlePropertySelect}>
            <SelectTrigger className="w-[240px]">
              <Home className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Link to Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No property</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Booking Selector */}
        {data.propertyId && bookings.length > 0 && (
          <Select value={data.bookingId || "_none"} onValueChange={handleBookingSelect}>
            <SelectTrigger className="w-[200px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Link Booking" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No booking</SelectItem>
              {bookings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.tenant_name} ({format(new Date(b.start_date), "MMM d")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Import Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isExtracting}
        >
          {isExtracting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />Import from Lease</>
          )}
        </Button>

        {data.importSource && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-600" />
            {data.importedFields.length} fields imported
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1"
              onClick={() => updateData({ importSource: null, importedFields: [] })}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>

      {/* Import Alert */}
      {data.importSource && (
        <Alert className="border-amber-300 bg-amber-50/50">
          <FileText className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Imported from: <strong>{data.importSource}</strong>. Values highlighted with ✨ are editable.
          </AlertDescription>
        </Alert>
      )}

      {/* Collapsible Field Sections */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {sortedCategories.map((category) => {
            const fields = adminFieldsByCategory[category];
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
            const Icon = config.icon;
            const isExpanded = expandedSections[category] ?? false;
            const categoryFilledCount = fields.filter(f => !!data.fieldValues[f.api_id]).length;
            const hasUnfilled = categoryFilledCount < fields.length;

            return (
              <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleSection(category)}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{config.label}</span>
                    <span className="text-xs text-muted-foreground">({categoryFilledCount}/{fields.length})</span>
                  </div>
                  {hasUnfilled ? (
                    <Badge variant="outline" className="text-xs">Needs review</Badge>
                  ) : (
                    <Badge variant="default" className="text-xs bg-green-600">Complete</Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 pb-2 px-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields.map(renderField)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Guest & Signature Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        {/* Guest Fields */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-sm mb-2 text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <User className="h-4 w-4" />
            Tenant Will Fill ({guestFields.length} fields)
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside max-h-24 overflow-y-auto">
            {guestFields.slice(0, 5).map((field) => (
              <li key={field.api_id}>{getFieldLabelInfo(field.api_id, field.label).label}</li>
            ))}
            {guestFields.length > 5 && <li>+{guestFields.length - 5} more...</li>}
          </ul>
        </div>

        {/* Signature Fields */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
          <h4 className="font-medium text-sm mb-2 text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            Signatures Required ({signatureFields.length})
          </h4>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
            {signatureFields.map((field) => (
              <li key={field.api_id}>
                {getFieldLabelInfo(field.api_id, field.label).label}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {field.filled_by === "admin" ? "Host" : "Tenant"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FillDocumentStep;
