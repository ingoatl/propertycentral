import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Property, Visit } from "@/types";
import { toast } from "sonner";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";

const HOURLY_RATE = 50;

const VISITOR_OPTIONS = [
  "Anja Schaer",
  "Ingo Schaer",
  "Contractor",
  "Cleaner"
];

const visitSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  visitedBy: z.string().min(1, "Please select who visited"),
  hours: z.number().min(0, "Hours cannot be negative").max(24, "Hours cannot exceed 24"),
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
});

// Memoized visit item component for performance
const VisitItem = memo(({ visit, getPropertyName, getPropertyAddress }: any) => (
  <div 
    className="p-4 sm:p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 bg-gradient-subtle animate-fade-in"
  >
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <h3 className="font-semibold text-base sm:text-lg text-foreground">
          {getPropertyName(visit.propertyId)}
        </h3>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{getPropertyAddress(visit.propertyId)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5" />
            {new Date(visit.date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {visit.time}
          </span>
        </div>
        {(visit as any).visited_by && (
          <p className="text-sm font-medium text-foreground">
            👤 {(visit as any).visited_by}
          </p>
        )}
        {visit.notes && (
          <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
            {visit.notes}
          </p>
        )}
      </div>
      <div className="text-left sm:text-right">
        <p className="text-2xl font-bold text-primary">${visit.price.toFixed(2)}</p>
      </div>
    </div>
  </div>
));

VisitItem.displayName = "VisitItem";

const Visits = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const isMobile = useIsMobile();
  
  const [formData, setFormData] = useState({
    propertyId: "",
    visitedBy: "",
    hours: "0",
    notes: "",
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Set up realtime subscription for visits
  useEffect(() => {
    const channel = supabase
      .channel('visits-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Add new visit to the list
            const newVisit: Visit = {
              id: payload.new.id,
              propertyId: payload.new.property_id,
              date: payload.new.date,
              time: payload.new.time,
              price: Number(payload.new.price),
              notes: payload.new.notes,
              createdAt: payload.new.created_at,
            };
            setVisits(prev => [newVisit, ...prev.slice(0, 9)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("*")
        .order("name");

      if (propertiesError) throw propertiesError;

      setProperties((propertiesData || []).map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        visitPrice: Number(p.visit_price),
        createdAt: p.created_at,
      })));

      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(10);

      if (visitsError) throw visitsError;

      setVisits((visitsData || []).map(v => ({
        id: v.id,
        propertyId: v.property_id,
        date: v.date,
        time: v.time,
        price: Number(v.price),
        notes: v.notes,
        createdAt: v.created_at,
      })));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading data:", error);
      }
      toast.error("Failed to load data");
    } finally {
      setInitialLoading(false);
    }
  };

  const handlePropertySelect = (propertyId: string) => {
    setFormData({
      ...formData,
      propertyId,
    });
  };

  // Memoize expensive calculations
  const calculateTotalPrice = useCallback(() => {
    const property = properties.find(p => p.id === formData.propertyId);
    const hours = parseFloat(formData.hours) || 0;
    const visitFee = property?.visitPrice || 0;
    const hourlyCharges = hours * HOURLY_RATE;
    return visitFee + hourlyCharges;
  }, [formData.propertyId, formData.hours, properties]);

  const totalPrice = useMemo(() => calculateTotalPrice(), [calculateTotalPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hours = parseFloat(formData.hours);
    const calculatedPrice = calculateTotalPrice();
    
    // Validate with zod
    const validation = visitSchema.safeParse({
      propertyId: formData.propertyId,
      visitedBy: formData.visitedBy,
      hours,
      notes: formData.notes,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      // Capture current date and time automatically
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5);

      // Get the property to get visit price
      const property = properties.find(p => p.id === formData.propertyId);
      if (!property) throw new Error("Property not found");

      // Optimistic UI update - add visit immediately
      const optimisticVisit: Visit = {
        id: `temp-${Date.now()}`,
        propertyId: formData.propertyId,
        date: currentDate,
        time: currentTime,
        price: calculatedPrice,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
      };

      // Add to state immediately for instant feedback
      setVisits(prev => [optimisticVisit, ...prev]);

      // Reset form immediately
      const previousFormData = { ...formData };
      setFormData({
        propertyId: "",
        visitedBy: "",
        hours: "0",
        notes: "",
      });

      // Collapse form on mobile after submit
      if (isMobile) {
        setIsFormOpen(false);
      }

      // Vibrate on success (mobile haptic feedback)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      // Insert visit in background
      const { error: visitError } = await supabase
        .from("visits")
        .insert({
          property_id: previousFormData.propertyId,
          date: currentDate,
          time: currentTime,
          price: calculatedPrice,
          hours,
          visited_by: previousFormData.visitedBy,
          notes: previousFormData.notes || null,
          user_id: user.id,
        });

      if (visitError) throw visitError;

      // Create expenses array
      const expenses = [];

      // Build base description with notes if present
      const notesAddition = previousFormData.notes ? ` - ${previousFormData.notes}` : '';

      // 1. Always add visit price expense
      expenses.push({
        property_id: previousFormData.propertyId,
        amount: property.visitPrice,
        date: currentDate,
        purpose: `Visit fee (${previousFormData.visitedBy})${notesAddition}`,
        category: "Visit Charges",
        vendor: "PeachHaus",
        user_id: user.id,
      });

      // 2. Add hourly charges expense only if hours > 0
      if (hours > 0) {
        const hourlyCharges = hours * HOURLY_RATE;
        expenses.push({
          property_id: previousFormData.propertyId,
          amount: hourlyCharges,
          date: currentDate,
          purpose: `Hourly charges - ${hours} hour${hours !== 1 ? 's' : ''} @ $${HOURLY_RATE}/hr (${previousFormData.visitedBy})${notesAddition}`,
          category: "Visit Charges",
          vendor: "PeachHaus",
          user_id: user.id,
        });
      }

      // Insert all expenses
      const { error: expenseError } = await supabase
        .from("expenses")
        .insert(expenses);

      if (expenseError) throw expenseError;

      toast.success("Visit and expense logged successfully!");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error adding visit:", error);
      }
      toast.error(error.message || "Failed to log visit");
      
      // Reload data on error to sync state
      loadInitialData();
    } finally {
      setLoading(false);
    }
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property?.name || "Unknown";
  };

  const getPropertyAddress = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property?.address || "";
  };

  return (
    <div className="space-y-4 animate-fade-in pb-6 px-2 sm:px-0">
      <div className="pb-3 border-b border-border/50">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Log Visit</h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Quick entry for property visits</p>
      </div>

      {/* Collapsible form - sticky on mobile */}
      <Card className={`shadow-card border-border/50 ${isMobile ? 'sticky top-0 z-10' : ''}`}>
        <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="bg-gradient-subtle rounded-t-lg pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg md:text-xl text-foreground">New Visit Entry</CardTitle>
                  <CardDescription className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                    {isFormOpen ? 'Select property and log your visit' : 'Tap to add a visit'}
                  </CardDescription>
                </div>
                {isFormOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-4 pb-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Property Selection - Large and prominent */}
                <div className="space-y-2">
                  <Label htmlFor="property" className="text-sm sm:text-base font-semibold">Select Property *</Label>
                  <Select value={formData.propertyId} onValueChange={handlePropertySelect}>
                    <SelectTrigger id="property" className="h-12 sm:h-14 text-base sm:text-lg border-2 focus:border-primary bg-background z-50">
                      <SelectValue placeholder="Choose a property" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id} className="text-sm sm:text-base py-2 sm:py-3 min-h-[44px]">
                          <div className="flex flex-col">
                            <span className="font-semibold">{property.name}</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">${property.visitPrice.toFixed(2)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Visited By Selection */}
                <div className="space-y-2">
                  <Label htmlFor="visitedBy" className="text-sm sm:text-base font-semibold">Visited By *</Label>
                  <Select value={formData.visitedBy} onValueChange={(value) => setFormData({ ...formData, visitedBy: value })}>
                    <SelectTrigger id="visitedBy" className="h-12 sm:h-14 text-base sm:text-lg border-2 focus:border-primary bg-background z-50">
                      <SelectValue placeholder="Select who visited" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      {VISITOR_OPTIONS.map((visitor) => (
                        <SelectItem key={visitor} value={visitor} className="text-sm sm:text-base py-2 sm:py-3 min-h-[44px]">
                          {visitor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours" className="text-sm sm:text-base font-semibold">Hours (Optional)</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    className="h-12 sm:h-14 text-base sm:text-lg border-2 focus:border-primary"
                    placeholder="Enter hours (0 if just visiting)"
                  />
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Rate: ${HOURLY_RATE}/hour{parseFloat(formData.hours) > 0 ? ` | Hourly: $${(parseFloat(formData.hours) * HOURLY_RATE).toFixed(2)}` : ''} | Total: ${totalPrice.toFixed(2)}
                  </p>
                </div>

                {/* Notes - Optional */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm sm:text-base font-semibold">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any notes about this visit..."
                    className="text-sm sm:text-base min-h-[100px] sm:min-h-[120px] border-2 focus:border-primary resize-none"
                    maxLength={2000}
                  />
                </div>

                {/* Auto-capture notice */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground mb-0.5">Auto-tracked</p>
                    <p>Date and time recorded automatically</p>
                  </div>
                </div>

                {/* Large submit button with proper touch target */}
                <Button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold shadow-warm hover:scale-[1.02] active:scale-[0.98] transition-transform touch-manipulation"
                >
                  {loading ? (
                    "Logging..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      Log Visit Now
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Recent Visits - with loading skeletons */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg pb-3">
          <CardTitle className="text-base sm:text-lg md:text-xl">Recent Visits</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {initialLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 border border-border/50 rounded-xl space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <CalendarIcon className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base text-muted-foreground">No visits logged yet</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {visits.map((visit) => (
                <VisitItem 
                  key={visit.id} 
                  visit={visit} 
                  getPropertyName={getPropertyName}
                  getPropertyAddress={getPropertyAddress}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Visits;
