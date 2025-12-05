import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Calendar } from "lucide-react";
import { WizardData } from "../DocumentCreateWizard";
import { format } from "date-fns";

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

  const handlePropertySelect = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    updateData({
      propertyId,
      propertyName: property?.name || null,
      bookingId: null,
      preFillData: {
        ...data.preFillData,
        propertyAddress: property?.address || "",
      },
    });
  };

  const handleBookingSelect = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (booking) {
      updateData({
        bookingId,
        guestName: booking.tenant_name,
        guestEmail: booking.tenant_email || "",
        preFillData: {
          ...data.preFillData,
          monthlyRent: booking.monthly_rent.toString(),
          leaseStartDate: booking.start_date,
          leaseEndDate: booking.end_date,
        },
      });
    }
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
        <Label className="text-lg font-medium">Link to Property (Optional)</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Optionally link this document to a property and/or existing booking
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Property
          </Label>
          <Select value={data.propertyId || ""} onValueChange={handlePropertySelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a property (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No property</SelectItem>
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
              <Select value={data.bookingId || ""} onValueChange={handleBookingSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a booking (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No booking - standalone document</SelectItem>
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
