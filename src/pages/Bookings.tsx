import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isWithinInterval } from "date-fns";

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Booking {
  id: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  bookingStatus: string | null;
  propertyId: string | null;
  ownerrezListingName: string;
}

const Bookings = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    syncAndLoadData();
  }, []);

  const syncAndLoadData = async () => {
    await syncOwnerRez();
    await loadData();
  };

  const syncOwnerRez = async () => {
    try {
      setSyncing(true);
      toast.loading("Syncing OwnerRez data...");
      
      const { data, error } = await supabase.functions.invoke("sync-ownerrez");
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Synced ${data.properties || 0} properties from OwnerRez`);
    } catch (error: any) {
      console.error("OwnerRez sync error:", error);
      toast.dismiss();
      toast.error("Failed to sync OwnerRez data");
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("*")
        .order("name");

      if (propertiesError) throw propertiesError;

      // Fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("ownerrez_bookings")
        .select("*")
        .order("check_in");

      if (bookingsError) throw bookingsError;

      // Address mappings for unmanaged properties
      const unmanagedAddresses: Record<string, string> = {
        'family retreat': '5360 Durham Ridge Ct, Lilburn, GA 30047',
        'lavish living': '3069 Rita Way, Smyrna, GA 30080',
        'luxurious & spacious apartment': '2580 Old Roswell Rd, Roswell, GA 30076',
        'modern + cozy townhome': '169 Willow Stream Ct, Woodstock, GA 30188',
        'scandi chic': '3155 Duvall Pl, Kennesaw, GA 30144',
        'scandinavian retreat': '5198 Laurel Bridge Dr, Smyrna, GA 30082',
        'alpine': '4241 Osburn Ct, Duluth, GA 30096',
      };

      // Process properties with addresses
      const processedProperties: Property[] = (propertiesData || []).map(p => ({
        id: p.id,
        name: p.name,
        address: p.address || "Address not available"
      }));

      // Add virtual properties for unmapped bookings
      const mappedPropertyIds = new Set(processedProperties.map(p => p.id));
      const unmappedBookings = (bookingsData || []).filter(b => !b.property_id || !mappedPropertyIds.has(b.property_id));
      
      const virtualPropertiesMap = new Map<string, Property>();
      unmappedBookings.forEach(booking => {
        if (!virtualPropertiesMap.has(booking.ownerrez_listing_id)) {
          // Get address for this property
          const listingNameLower = booking.ownerrez_listing_name.toLowerCase();
          let propertyAddress = "Address not available";
          
          for (const [key, address] of Object.entries(unmanagedAddresses)) {
            if (listingNameLower.includes(key)) {
              propertyAddress = address;
              break;
            }
          }
          
          virtualPropertiesMap.set(booking.ownerrez_listing_id, {
            id: `ownerrez-${booking.ownerrez_listing_id}`,
            name: booking.ownerrez_listing_name,
            address: propertyAddress
          });
        }
      });

      const allProperties = [...processedProperties, ...Array.from(virtualPropertiesMap.values())];
      
      setProperties(allProperties);
      setBookings((bookingsData || []).map(b => ({
        id: b.id,
        guestName: b.guest_name,
        checkIn: b.check_in,
        checkOut: b.check_out,
        bookingStatus: b.booking_status,
        propertyId: b.property_id || `ownerrez-${b.ownerrez_listing_id}`,
        ownerrezListingName: b.ownerrez_listing_name
      })));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load bookings data");
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = useMemo(() => {
    if (!searchQuery) return properties;
    const query = searchQuery.toLowerCase();
    return properties.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.address.toLowerCase().includes(query)
    );
  }, [properties, searchQuery]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingsForProperty = (propertyId: string) => {
    return bookings.filter(b => b.propertyId === propertyId);
  };

  const getBookingPosition = (booking: Booking) => {
    if (!booking.checkIn || !booking.checkOut) return null;
    
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    
    // Find start position
    const startIndex = daysInMonth.findIndex(day => isSameDay(day, checkIn) || (checkIn < day && checkOut > day));
    if (startIndex === -1) return null;
    
    // Calculate width (number of days)
    const visibleDays = daysInMonth.filter(day => 
      isWithinInterval(day, { start: checkIn, end: checkOut }) ||
      isSameDay(day, checkIn) || isSameDay(day, checkOut)
    ).length;
    
    if (visibleDays === 0) return null;
    
    return { startIndex, width: visibleDays };
  };

  const getBookingColor = (status: string | null, guestName: string | null) => {
    // If no guest name and status is active/confirmed, it's likely a block
    if (!guestName && (status?.toLowerCase() === 'active' || status?.toLowerCase() === 'confirmed')) {
      return 'bg-gray-500/90';
    }
    
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'active':
        return 'bg-emerald-500/90';
      case 'pending':
        return 'bg-amber-500/90';
      case 'cancelled':
      case 'canceled':
        return 'bg-red-500/90';
      default:
        return 'bg-blue-500/90';
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-lg text-muted-foreground">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bookings Calendar</h1>
          <p className="text-muted-foreground mt-1">View all property bookings from OwnerRez</p>
        </div>
        <Button onClick={syncAndLoadData} disabled={syncing} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync OwnerRez'}
        </Button>
      </div>

      <Card className="shadow-elegant border-border/50">
        <CardContent className="p-6 space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Input
              placeholder="Filter properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 min-w-[200px] justify-center">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
              </div>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'}
          </p>

          {/* Calendar Grid */}
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Header Row */}
            <div className="flex bg-muted/50">
              <div className="w-64 flex-shrink-0 border-r border-border p-3 font-semibold text-sm">
                Property Address
              </div>
              <div className="flex-1 flex overflow-x-auto">
                {daysInMonth.map((day, idx) => (
                  <div
                    key={idx}
                    className="flex-1 min-w-[40px] border-r border-border p-2 text-center"
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEE')}
                    </div>
                    <div className="text-sm font-medium">
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Property Rows */}
            <div className="divide-y divide-border">
              {filteredProperties.map((property) => {
                const propertyBookings = getBookingsForProperty(property.id);
                
                return (
                  <div key={property.id} className="flex hover:bg-muted/30 transition-colors">
                    <div className="w-64 flex-shrink-0 border-r border-border p-3">
                      <div className="text-sm font-semibold text-foreground line-clamp-1">
                        {property.address}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {property.name}
                      </div>
                    </div>
                    <div className="flex-1 relative min-h-[60px]">
                      <div className="flex h-full">
                        {daysInMonth.map((_, idx) => (
                          <div
                            key={idx}
                            className="flex-1 min-w-[40px] border-r border-border/30"
                          />
                        ))}
                      </div>
                      {/* Bookings overlay */}
                      <div className="absolute inset-0 pointer-events-none">
                        {propertyBookings.map((booking) => {
                          const position = getBookingPosition(booking);
                          if (!position) return null;

                          const dayWidth = 100 / daysInMonth.length;
                          const left = position.startIndex * dayWidth;
                          const width = position.width * dayWidth;

                          // Show "Block" only if there's no guest name and it's not canceled
                          const isBlock = !booking.guestName && booking.bookingStatus?.toLowerCase() !== 'canceled';
                          const isCanceled = booking.bookingStatus?.toLowerCase() === 'canceled';
                          const displayName = booking.guestName || (isCanceled ? 'Canceled' : 'Block');
                          
                          return (
                            <div
                              key={booking.id}
                              className={`absolute top-2 bottom-2 ${getBookingColor(booking.bookingStatus, booking.guestName)} rounded text-white text-xs p-1 flex items-center justify-center shadow-lg pointer-events-auto cursor-default transition-transform hover:scale-105`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                              title={`${displayName}\n${booking.checkIn} to ${booking.checkOut}\nStatus: ${booking.bookingStatus || 'Unknown'}`}
                            >
                              <span className="truncate px-1 font-medium">
                                {displayName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {filteredProperties.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No properties found matching your search.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Bookings;
