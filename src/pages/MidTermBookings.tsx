import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, Trash2, CalendarIcon, Edit, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const bookingSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  tenantName: z.string().min(1, "Tenant name is required").max(255),
  tenantPhone: z.string().optional(),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  monthlyRent: z.number().positive("Monthly rent must be positive"),
  depositAmount: z.number().min(0, "Deposit must be non-negative"),
  notes: z.string().optional(),
});

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

interface Property {
  id: string;
  name: string;
  address: string;
}

const MidTermBookings = () => {
  const [bookings, setBookings] = useState<MidTermBooking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<MidTermBooking | null>(null);
  const [formData, setFormData] = useState({
    propertyId: "",
    tenantName: "",
    tenantPhone: "",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    monthlyRent: "",
    depositAmount: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
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

      setBookings(bookingsResult.data || []);
      setProperties(propertiesResult.data || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: "",
      tenantName: "",
      tenantPhone: "",
      startDate: undefined,
      endDate: undefined,
      monthlyRent: "",
      depositAmount: "",
      notes: "",
    });
    setEditingBooking(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = bookingSchema.safeParse({
      propertyId: formData.propertyId,
      tenantName: formData.tenantName,
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
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const bookingData = {
        property_id: formData.propertyId,
        tenant_name: formData.tenantName,
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
      loadData();
    } catch (error: any) {
      console.error("Error saving booking:", error);
      toast.error(error.message || "Failed to save booking");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (booking: MidTermBooking) => {
    setEditingBooking(booking);
    setFormData({
      propertyId: booking.property_id,
      tenantName: booking.tenant_name,
      tenantPhone: booking.tenant_phone || "",
      startDate: new Date(booking.start_date),
      endDate: new Date(booking.end_date),
      monthlyRent: booking.monthly_rent.toString(),
      depositAmount: booking.deposit_amount.toString(),
      notes: booking.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      const { error } = await supabase
        .from("mid_term_bookings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Booking deleted");
      loadData();
    } catch (error: any) {
      console.error("Error deleting booking:", error);
      toast.error("Failed to delete booking");
    }
  };

  const getPropertyName = (propertyId: string) => {
    return properties.find(p => p.id === propertyId)?.name || "Unknown Property";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Mid-term Bookings
          </h1>
          <p className="text-muted-foreground mt-1">Track monthly rental agreements and revenue</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="gap-2 shadow-warm hover:scale-105 transition-transform"
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  {properties.map((property) => (
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
                <Label htmlFor="tenantPhone">Tenant Phone</Label>
                <Input
                  id="tenantPhone"
                  type="tel"
                  value={formData.tenantPhone}
                  onChange={(e) => setFormData({ ...formData, tenantPhone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
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
              <Button type="submit" disabled={loading} className="shadow-warm">
                {loading ? "Saving..." : editingBooking ? "Update Booking" : "Create Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bookings List */}
      <div className="grid gap-4">
        {loading && bookings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No mid-term bookings yet. Add your first booking to get started!</p>
            </CardContent>
          </Card>
        ) : (
          bookings.map((booking) => (
            <Card key={booking.id} className="shadow-card border-border/50 hover:shadow-warm transition-shadow">
              <CardHeader className="bg-gradient-subtle rounded-t-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {booking.tenant_name}
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="font-medium text-foreground">
                        {getPropertyName(booking.property_id)}
                      </div>
                      {booking.tenant_phone && <div>📞 {booking.tenant_phone}</div>}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={booking.status === "active" ? "default" : "secondary"}>
                      {booking.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(booking)}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(booking.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Rental Period</div>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      <span className="font-medium">
                        {format(new Date(booking.start_date), "MMM dd, yyyy")} -{" "}
                        {format(new Date(booking.end_date), "MMM dd, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Monthly Rent</div>
                    <div className="text-2xl font-bold text-primary">
                      ${Number(booking.monthly_rent).toFixed(2)}
                    </div>
                  </div>
                  {booking.deposit_amount > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Deposit</div>
                      <div className="font-medium">${Number(booking.deposit_amount).toFixed(2)}</div>
                    </div>
                  )}
                  {booking.notes && (
                    <div className="col-span-full space-y-2">
                      <div className="text-sm text-muted-foreground">Notes</div>
                      <div className="text-sm bg-muted/30 p-3 rounded-lg">{booking.notes}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MidTermBookings;
