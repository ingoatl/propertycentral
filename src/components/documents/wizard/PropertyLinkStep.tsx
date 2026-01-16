import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Building, Calendar, Upload, FileText, Loader2, CheckCircle, X } from "lucide-react";
import { WizardData } from "../DocumentCreateWizard";
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

const PropertyLinkStep = ({ data, updateData }: Props) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (data.propertyId) {
      loadBookings(data.propertyId);
    } else {
      setBookings([]);
      updateData({ bookingId: null });
    }
  }, [data.propertyId]);

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

  // Extract city from address string
  const extractCityFromAddress = (address: string): string => {
    // Typical format: "123 Main St, City, ST 12345" or "123 Main St, City, State 12345"
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // City is usually the second-to-last part (before state/zip)
      return parts[1] || "";
    }
    return "";
  };

  const handlePropertySelect = (propertyId: string) => {
    const actualId = propertyId === "_none" ? null : propertyId;
    const property = actualId ? properties.find((p) => p.id === actualId) : null;
    const propertyAddress = property?.address || "";
    const propertyCity = extractCityFromAddress(propertyAddress);
    
    updateData({
      propertyId: actualId,
      propertyName: property?.name || null,
      bookingId: null,
      fieldValues: {
        ...data.fieldValues,
        // Address fields - all aliases
        property_address: propertyAddress,
        address: propertyAddress,
        rental_address: propertyAddress,
        listing_address: propertyAddress,
        // City fields
        listing_city: propertyCity,
        city: propertyCity,
        property_city: propertyCity,
        // Property name
        property_name: property?.name || "",
        // Host/Agent fields - always PeachHaus
        host_name: "PeachHaus Group LLC",
        landlord_name: "PeachHaus Group LLC",
        agent_name: "PeachHaus Group LLC",
        innkeeper_name: "PeachHaus Group LLC",
        management_company: "PeachHaus Group LLC",
        company_name: "PeachHaus Group LLC",
      },
    });
  };

  // Format date as "Month Day, Year" (e.g., "December 19, 2025")
  const formatDateForDisplay = (dateStr: string): string => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return format(date, "MMMM d, yyyy");
    } catch {
      return dateStr;
    }
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
            // Financial
            monthly_rent: booking.monthly_rent.toString(),
            rent: booking.monthly_rent.toString(),
            rent_amount: booking.monthly_rent.toString(),
            // Dates - formatted
            lease_start_date: formatDateForDisplay(booking.start_date),
            lease_end_date: formatDateForDisplay(booking.end_date),
            start_date: formatDateForDisplay(booking.start_date),
            end_date: formatDateForDisplay(booking.end_date),
            lease_start: formatDateForDisplay(booking.start_date),
            lease_end: formatDateForDisplay(booking.end_date),
            check_in_date: formatDateForDisplay(booking.start_date),
            check_out_date: formatDateForDisplay(booking.end_date),
            // Guest info - auto-fill from booking
            guest_name: booking.tenant_name,
            tenant_name: booking.tenant_name,
            renter_name: booking.tenant_name,
            occupant_name: booking.tenant_name,
            guest_full_name: booking.tenant_name,
            guest_email: booking.tenant_email || "",
            tenant_email: booking.tenant_email || "",
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

      if (response.error) {
        throw new Error(response.error.message || "Failed to extract data");
      }

      const { extractedData, fieldsExtracted } = response.data;
      
      if (extractedData && Object.keys(extractedData).length > 0) {
        // Merge with existing field values
        updateData({
          fieldValues: {
            ...data.fieldValues,
            ...extractedData,
          },
          importSource: file.name,
          importedFields: Object.keys(extractedData),
          // Auto-fill guest info if found
          guestName: extractedData.tenant_name || extractedData.guest_name || data.guestName,
          guestEmail: extractedData.tenant_email || extractedData.guest_email || data.guestEmail,
        });
        
        toast.success(`Extracted ${fieldsExtracted} fields from document`, {
          description: "Values have been pre-filled and are editable",
        });
      } else {
        toast.warning("No data could be extracted", {
          description: "Try a different document or fill fields manually",
        });
      }
    } catch (error) {
      console.error("Document extraction error:", error);
      toast.error("Failed to extract data", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsExtracting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearImport = () => {
    // Clear imported fields from fieldValues
    const clearedValues = { ...data.fieldValues };
    data.importedFields.forEach(field => {
      delete clearedValues[field];
    });
    
    updateData({
      fieldValues: clearedValues,
      importSource: null,
      importedFields: [],
    });
    toast.info("Imported data cleared");
  };

  if (loadingProperties) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-medium">Link to Property or Import Data</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Link this document to a property, select an existing booking, or import data from a filled document
        </p>
      </div>

      {/* Import from Document Section */}
      <div className="p-4 border-2 border-dashed rounded-lg bg-muted/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Import from Filled Document</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a filled lease agreement to automatically extract and pre-fill admin fields
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {data.importSource ? (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1.5">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Imported: {data.importSource}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({data.importedFields.length} fields)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearImport}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {data.importSource && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>{data.importedFields.length} fields</strong> were extracted from "{data.importSource}". 
            All values are editable in the "Fill Values" step.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Property
          </Label>
          <Select value={data.propertyId || "_none"} onValueChange={handlePropertySelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a property (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No property</SelectItem>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name} - {property.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.propertyId && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Existing Booking
            </Label>
            {loadingBookings ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={data.bookingId || "_none"} onValueChange={handleBookingSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a booking (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No booking - standalone document</SelectItem>
                  {bookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.tenant_name} ({format(new Date(booking.start_date), "MMM d")} -{" "}
                      {format(new Date(booking.end_date), "MMM d, yyyy")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Selecting a booking will auto-fill guest information
            </p>
          </div>
        )}
      </div>

      {data.propertyId && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Selected Property</h4>
          <p className="text-sm text-muted-foreground">
            {properties.find((p) => p.id === data.propertyId)?.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {properties.find((p) => p.id === data.propertyId)?.address}
          </p>
        </div>
      )}
    </div>
  );
};

export default PropertyLinkStep;
