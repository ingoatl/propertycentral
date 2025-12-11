import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon, Plus, Trash2, Edit, User, Mail, DollarSign, Home } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";

// Mid-term booking schema
const bookingSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  tenantName: z.string().min(1, "Tenant name is required").max(255),
  tenantEmail: z.string().email("Invalid email address"),
  tenantPhone: z.string().optional(),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  monthlyRent: z.number().positive("Monthly rent must be positive"),
  depositAmount: z.number().min(0, "Deposit must be non-negative"),
  notes: z.string().optional(),
});

interface Property {
  id: string;
  name: string;
  address: string;
}

interface OwnerrezBooking {
  id: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  bookingStatus: string | null;
  propertyId: string | null;
  ownerrezListingName: string;
}

interface MidTermBooking {
  id: string;
  property_id: string;
  tenant_name: string;
  tenant_email: string | null;
  tenant_phone: string | null;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number;
  notes: string | null;
  status: string;
  created_at: string;
}

const Bookings = () => {
  // OwnerRez state
  const [ownerrezProperties, setOwnerrezProperties] = useState<Property[]>([]);
  const [ownerrezBookings, setOwnerrezBookings] = useState<OwnerrezBooking[]>([]);
  const [ownerrezLoading, setOwnerrezLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [ownerrezLoaded, setOwnerrezLoaded] = useState(false);

  // Mid-term state
  const [midTermBookings, setMidTermBookings] = useState<MidTermBooking[]>([]);
  const [midTermProperties, setMidTermProperties] = useState<Property[]>([]);
  const [midTermLoading, setMidTermLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<MidTermBooking | null>(null);
  const [formData, setFormData] = useState({
    propertyId: "",
    tenantName: "",
    tenantEmail: "",
    tenantPhone: "",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    monthlyRent: "",
    depositAmount: "",
    notes: "",
  });

  useEffect(() => {
    loadMidTermData();
  }, []);

  // Mid-term booking functions
  const loadMidTermData = async () => {
    try {
      setMidTermLoading(true);
      const [bookingsResult, propertiesResult] = await Promise.all([
        supabase
          .from("mid_term_bookings")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("properties")
          .select("id, name, address")
          .in("rental_type", ["hybrid", "mid_term"])
          .order("name", { ascending: true }),
      ]);

      if (bookingsResult.error) throw bookingsResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      setMidTermBookings(bookingsResult.data || []);
      setMidTermProperties(propertiesResult.data || []);
    } catch (error: any) {
      console.error("Error loading mid-term data:", error);
      toast.error("Failed to load mid-term bookings");
    } finally {
      setMidTermLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: "",
      tenantName: "",
      tenantEmail: "",
      tenantPhone: "",
      startDate: undefined,
      endDate: undefined,
      monthlyRent: "",
      depositAmount: "",
      notes: "",
    });
    setEditingBooking(null);
  };

  const handleMidTermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = bookingSchema.safeParse({
      propertyId: formData.propertyId,
      tenantName: formData.tenantName,
      tenantEmail: formData.tenantEmail,
      tenantPhone: formData.tenantPhone,
      startDate: formData.startDate,
      endDate: formData.endDate,
      monthlyRent: parseFloat(formData.monthlyRent),
      depositAmount: parseFloat(formData.depositAmount || "0"),
      notes: formData.notes,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (formData.endDate && formData.startDate && formData.endDate <= formData.startDate) {
      toast.error("End date must be after start date");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const bookingData = {
        property_id: formData.propertyId,
        tenant_name: formData.tenantName,
        tenant_email: formData.tenantEmail,
        tenant_phone: formData.tenantPhone || null,
        start_date: format(formData.startDate!, "yyyy-MM-dd"),
        end_date: format(formData.endDate!, "yyyy-MM-dd"),
        monthly_rent: parseFloat(formData.monthlyRent),
        deposit_amount: parseFloat(formData.depositAmount || "0"),
        notes: formData.notes || null,
        user_id: user.id,
      };

      if (editingBooking) {
        const { error } = await supabase
          .from("mid_term_bookings")
          .update(bookingData)
          .eq("id", editingBooking.id);

        if (error) throw error;
        toast.success("Booking updated successfully");
      } else {
        const { error } = await supabase
          .from("mid_term_bookings")
          .insert([bookingData]);

        if (error) throw error;
        toast.success("Booking created successfully");
      }

      setDialogOpen(false);
      resetForm();
      loadMidTermData();
    } catch (error: any) {
      console.error("Error saving booking:", error);
      toast.error(error.message || "Failed to save booking");
    }
  };

  const handleMidTermEdit = (booking: MidTermBooking) => {
    setEditingBooking(booking);
    setFormData({
      propertyId: booking.property_id,
      tenantName: booking.tenant_name,
      tenantEmail: booking.tenant_email || "",
      tenantPhone: booking.tenant_phone || "",
      startDate: new Date(booking.start_date),
      endDate: new Date(booking.end_date),
      monthlyRent: booking.monthly_rent.toString(),
      depositAmount: booking.deposit_amount.toString(),
      notes: booking.notes || "",
    });
    setDialogOpen(true);
  };

  const handleMidTermDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      const { error } = await supabase
        .from("mid_term_bookings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Booking deleted");
      loadMidTermData();
    } catch (error: any) {
      console.error("Error deleting booking:", error);
      toast.error("Failed to delete booking");
    }
  };

  const getMidTermPropertyName = (propertyId: string) => {
    return midTermProperties.find(p => p.id === propertyId)?.name || "Unknown Property";
  };

  // OwnerRez functions
  const syncOwnerRez = async () => {
    try {
      setSyncing(true);
      toast.loading("Syncing OwnerRez data...");
      
      const { data, error } = await supabase.functions.invoke("sync-ownerrez");
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success(`Synced ${data.properties || 0} properties from OwnerRez`);
      await loadOwnerrezData();
    } catch (error: any) {
      console.error("OwnerRez sync error:", error);
      toast.dismiss();
      toast.error("Failed to sync OwnerRez data");
    } finally {
      setSyncing(false);
    }
  };

  const loadOwnerrezData = async () => {
    try {
      setOwnerrezLoading(true);
      
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
        'the alpine': '4241 Osburn Ct, Duluth, GA 30096',
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

      // Ensure "The Alpine" always shows up even without bookings
      const alpineExists = [...processedProperties, ...Array.from(virtualPropertiesMap.values())]
        .some(p => p.address.toLowerCase().includes('4241 osburn'));
      
      if (!alpineExists) {
        virtualPropertiesMap.set('alpine-fallback', {
          id: 'ownerrez-alpine-fallback',
          name: 'The Alpine',
          address: '4241 Osburn Ct, Duluth, GA 30096'
        });
      }

      const allProperties = [...processedProperties, ...Array.from(virtualPropertiesMap.values())];
      
      // Separate managed and unmanaged properties
      const managedAddresses = processedProperties.map(p => p.address.toLowerCase());
      const sortedProperties = allProperties.sort((a, b) => {
        const aIsManaged = managedAddresses.some(addr => a.id.includes('ownerrez-') ? false : true);
        const bIsManaged = managedAddresses.some(addr => b.id.includes('ownerrez-') ? false : true);
        
        if (aIsManaged === bIsManaged) {
          return a.address.localeCompare(b.address);
        }
        return aIsManaged ? -1 : 1;
      });
      
      setOwnerrezProperties(sortedProperties);
      setOwnerrezBookings((bookingsData || []).map(b => ({
        id: b.id,
        guestName: b.guest_name,
        checkIn: b.check_in,
        checkOut: b.check_out,
        bookingStatus: b.booking_status,
        propertyId: b.property_id || `ownerrez-${b.ownerrez_listing_id}`,
        ownerrezListingName: b.ownerrez_listing_name
      })));
      setOwnerrezLoaded(true);
    } catch (error) {
      console.error("Error loading ownerrez data:", error);
      toast.error("Failed to load OwnerRez data");
    } finally {
      setOwnerrezLoading(false);
    }
  };

  const filteredProperties = useMemo(() => {
    if (!searchQuery) return ownerrezProperties;
    const query = searchQuery.toLowerCase();
    return ownerrezProperties.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.address.toLowerCase().includes(query)
    );
  }, [ownerrezProperties, searchQuery]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingsForProperty = (propertyId: string) => {
    return ownerrezBookings.filter(b => b.propertyId === propertyId);
  };

  const getBookingPosition = (booking: OwnerrezBooking) => {
    if (!booking.checkIn || !booking.checkOut) return null;
    
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    
    const startIndex = daysInMonth.findIndex(day => isSameDay(day, checkIn) || (checkIn < day && checkOut > day));
    if (startIndex === -1) return null;
    
    const visibleDays = daysInMonth.filter(day => 
      isWithinInterval(day, { start: checkIn, end: checkOut }) ||
      isSameDay(day, checkIn) || isSameDay(day, checkOut)
    ).length;
    
    if (visibleDays === 0) return null;
    
    return { startIndex, width: visibleDays };
  };

  const getBookingColor = (status: string | null, guestName: string | null) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Bookings</h1>
        <p className="text-muted-foreground mt-1">Manage mid-term bookings and view OwnerRez calendar</p>
      </div>

      <Tabs defaultValue="mid-term" className="w-full">
        <TabsList>
          <TabsTrigger value="mid-term">Mid-Term Bookings</TabsTrigger>
          <TabsTrigger value="ownerrez">OwnerRez Calendar</TabsTrigger>
        </TabsList>

        {/* Mid-Term Bookings Tab */}
        <TabsContent value="mid-term" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Booking
            </Button>
          </div>

          {/* Booking Dialog */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBooking ? "Edit" : "Add"} Mid-term Booking</DialogTitle>
                <DialogDescription>
                  Enter tenant and rental details for the mid-term agreement
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleMidTermSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="property">Property</Label>
                  <Select
                    value={formData.propertyId}
                    onValueChange={(value) => setFormData({ ...formData, propertyId: value })}
                  >
                    <SelectTrigger id="property">
                      <SelectValue placeholder="Select a mid-term rental property..." />
                    </SelectTrigger>
                    <SelectContent>
                      {midTermProperties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name} - {property.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenantName">Tenant Name *</Label>
                    <Input
                      id="tenantName"
                      value={formData.tenantName}
                      onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tenantEmail">Tenant Email *</Label>
                    <Input
                      id="tenantEmail"
                      type="email"
                      value={formData.tenantEmail}
                      onChange={(e) => setFormData({ ...formData, tenantEmail: e.target.value })}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenantPhone">Tenant Phone</Label>
                  <Input
                    id="tenantPhone"
                    type="tel"
                    value={formData.tenantPhone}
                    onChange={(e) => setFormData({ ...formData, tenantPhone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.startDate ? format(formData.startDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.startDate}
                          onSelect={(date) => setFormData({ ...formData, startDate: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.endDate ? format(formData.endDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.endDate}
                          onSelect={(date) => setFormData({ ...formData, endDate: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRent">Monthly Rent ($) *</Label>
                    <Input
                      id="monthlyRent"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthlyRent}
                      onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                      placeholder="2500.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositAmount">Deposit Amount ($)</Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.depositAmount}
                      onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about the tenant or rental agreement..."
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingBooking ? "Update Booking" : "Create Booking"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Bookings List */}
          <div className="grid gap-4">
            {midTermLoading && midTermBookings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Loading...</p>
                </CardContent>
              </Card>
            ) : midTermBookings.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No mid-term bookings yet. Add your first booking to get started!</p>
                </CardContent>
              </Card>
            ) : (
              midTermBookings.map((booking) => (
                <Card key={booking.id} className="shadow-sm border-border/50">
                  <CardHeader className="bg-muted/30 rounded-t-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <User className="w-5 h-5" />
                          {booking.tenant_name}
                        </CardTitle>
                        <CardDescription className="mt-2 space-y-1">
                          <div className="font-medium text-foreground flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {getMidTermPropertyName(booking.property_id)}
                          </div>
                          {booking.tenant_email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {booking.tenant_email}
                            </div>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleMidTermEdit(booking)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleMidTermDelete(booking.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Start Date</p>
                        <p className="font-medium">{format(new Date(booking.start_date), "MMM d, yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">End Date</p>
                        <p className="font-medium">{format(new Date(booking.end_date), "MMM d, yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly Rent</p>
                        <p className="font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {booking.monthly_rent.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <Badge variant={booking.status === 'active' ? 'default' : 'secondary'}>
                          {booking.status}
                        </Badge>
                      </div>
                    </div>
                    {booking.notes && (
                      <p className="mt-4 text-sm text-muted-foreground">{booking.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* OwnerRez Calendar Tab */}
        <TabsContent value="ownerrez" className="space-y-4">
          {!ownerrezLoaded ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center space-y-4">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                <p className="text-muted-foreground">Click the button below to load OwnerRez bookings</p>
                <Button onClick={syncOwnerRez} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync & Load OwnerRez'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-border/50">
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
                    <Button onClick={syncOwnerRez} disabled={syncing} size="sm" variant="outline">
                      <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Syncing...' : 'Sync'}
                    </Button>
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

                {ownerrezLoading ? (
                  <div className="flex items-center justify-center min-h-48">
                    <div className="text-muted-foreground">Loading...</div>
                  </div>
                ) : (
                  <>
                    {/* Calendar Grid */}
                    <div className="border border-border rounded-lg overflow-hidden">
                      {/* Header Row */}
                      <div className="flex bg-muted/50 sticky top-0 z-10">
                        <div className="w-64 flex-shrink-0 border-r border-border p-2 font-semibold text-xs">
                          Property Address
                        </div>
                        <div className="flex-1 flex overflow-x-auto">
                          {daysInMonth.map((day, idx) => (
                            <div
                              key={idx}
                              className="flex-1 min-w-[40px] border-r border-border p-1 text-center"
                            >
                              <div className="text-[10px] text-muted-foreground">
                                {format(day, 'EEE')}
                              </div>
                              <div className="text-xs font-medium">
                                {format(day, 'd')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Property Rows */}
                      <div className="divide-y divide-border">
                        {filteredProperties.map((property, idx) => {
                          const propertyBookings = getBookingsForProperty(property.id);
                          const isManaged = !property.id.startsWith('ownerrez-');
                          const prevProperty = idx > 0 ? filteredProperties[idx - 1] : null;
                          const prevIsManaged = prevProperty && !prevProperty.id.startsWith('ownerrez-');
                          const showSeparator = idx > 0 && isManaged !== prevIsManaged;
                          
                          return (
                            <div key={property.id}>
                              {showSeparator && (
                                <div className="bg-muted/30 py-2 px-3 border-t-2 border-border">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Unmanaged Properties
                                  </div>
                                </div>
                              )}
                              <div className="flex hover:bg-muted/30 transition-colors">
                                <div className="w-64 flex-shrink-0 border-r border-border p-2">
                                  <div className="text-xs font-semibold text-foreground line-clamp-1">
                                    {property.address}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                    {property.name}
                                  </div>
                                </div>
                                <div className="flex-1 relative min-h-[44px]">
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

                                      const isCanceled = booking.bookingStatus?.toLowerCase() === 'canceled';
                                      const isBlock = !booking.guestName && !isCanceled;
                                      const displayName = booking.guestName || (isCanceled ? 'Canceled' : 'Block');
                                      
                                      return (
                                        <div
                                          key={booking.id}
                                          className={`absolute top-1 bottom-1 ${getBookingColor(booking.bookingStatus, booking.guestName)} rounded text-white text-[10px] px-1 flex items-center justify-center shadow-md pointer-events-auto cursor-default transition-transform hover:scale-105`}
                                          style={{
                                            left: `${left}%`,
                                            width: `${width}%`,
                                          }}
                                          title={`${displayName}\n${booking.checkIn} to ${booking.checkOut}\nStatus: ${booking.bookingStatus || 'Unknown'}`}
                                        >
                                          <span className="truncate font-medium">
                                            {displayName}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
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
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Bookings;
