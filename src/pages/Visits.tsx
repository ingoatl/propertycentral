import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Property, Visit } from "@/types";
import { toast } from "sonner";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { validateVisitForReconciliation } from "@/lib/visitDataValidation";
import { VisitReconciliationStatus } from "@/components/visits/VisitReconciliationStatus";

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
  date: z.date({ required_error: "Date is required" }),
});

// Memoized visit item component for performance
const VisitItem = memo(({ visit, getPropertyName, getPropertyAddress }: any) => {
  const billingStatus = (visit as any).billed;
  
  return (
    <div 
      className="p-4 sm:p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 bg-gradient-subtle animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base sm:text-lg text-foreground">
              {getPropertyName(visit.propertyId)}
            </h3>
            {billingStatus ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                ✓ Billed
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                Unbilled
              </Badge>
            )}
          </div>
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
  );
});

VisitItem.displayName = "VisitItem";

const Visits = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [showReconciliationStatus, setShowReconciliationStatus] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isMobile = useIsMobile();
  
  const [formData, setFormData] = useState({
    propertyId: "",
    visitedBy: "",
    hours: "0",
    notes: "",
    date: new Date(),
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Validate existing visits when loaded
  useEffect(() => {
    if (visits.length > 0) {
      const errors: string[] = [];
      visits.slice(0, 10).forEach((visit) => {
        const validation = validateVisitForReconciliation({
          ...visit,
          property_id: visit.propertyId,
          visited_by: "Unknown",
          hours: 0,
        });
        if (!validation.isValid) {
          errors.push(
            `Visit on ${visit.date}: ${validation.errors[0]}`
          );
        }
      });
      setValidationErrors(errors);
    }
  }, [visits]);

  // Set up realtime subscription for visits - only for updates/deletes
  // (Inserts are handled optimistically in handleSubmit)
  useEffect(() => {
    const channel = supabase
      .channel('visits-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'visits'
        },
        (payload) => {
          // Update existing visit in the list
          setVisits(prev => prev.map(visit => 
            visit.id === payload.new.id 
              ? {
                  id: payload.new.id,
                  propertyId: payload.new.property_id,
                  date: payload.new.date,
                  time: payload.new.time,
                  price: Number(payload.new.price),
                  notes: payload.new.notes,
                  createdAt: payload.new.created_at,
                }
              : visit
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'visits'
        },
        (payload) => {
          // Remove deleted visit from the list
          setVisits(prev => prev.filter(visit => visit.id !== payload.old.id));
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

      // Only fetch UNBILLED visits to display in the Visits tab
      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .eq("billed", false)
        .order("date", { ascending: false })
        .order("time", { ascending: false });

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
      date: formData.date,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    // Additional validation for amount
    if (calculatedPrice <= 0) {
      toast.error("Visit price must be greater than zero");
      return;
    }

    // Date format validation (YYYY-MM-DD)
    const visitDate = formData.date.toISOString().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      toast.error("Invalid date format. Must be YYYY-MM-DD");
      return;
    }

    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      // Use selected date and current time (already validated above)
      const currentTime = new Date().toTimeString().slice(0, 5);

      // Get the property to get visit price
      const property = properties.find(p => p.id === formData.propertyId);
      if (!property) throw new Error("Property not found");

      // Optimistic UI update - add visit immediately
      const tempId = `temp-${Date.now()}`;
      const optimisticVisit: Visit = {
        id: tempId,
        propertyId: formData.propertyId,
        date: visitDate,
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
        date: new Date(),
      });

      // Collapse form on mobile after submit
      if (isMobile) {
        setIsFormOpen(false);
      }

      // Vibrate on success (mobile haptic feedback)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      // Use the selected date from the form
      const selectedDate = previousFormData.date.toISOString().split("T")[0];
      
      // Insert visit in background
      const { data: insertedVisit, error: visitError } = await supabase
        .from("visits")
        .insert({
          property_id: previousFormData.propertyId,
          date: selectedDate,
          time: currentTime,
          price: calculatedPrice,
          hours,
          visited_by: previousFormData.visitedBy,
          notes: previousFormData.notes || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (visitError) throw visitError;

      // Replace optimistic visit with real one
      if (insertedVisit) {
        setVisits(prev => prev.map(visit => 
          visit.id === tempId 
            ? {
                id: insertedVisit.id,
                propertyId: insertedVisit.property_id,
                date: insertedVisit.date,
                time: insertedVisit.time,
                price: Number(insertedVisit.price),
                notes: insertedVisit.notes,
                createdAt: insertedVisit.created_at,
              }
            : visit
        ));
      }

      toast.success("Visit logged successfully!");
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

                {/* Date Picker */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold">Visit Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 sm:h-14 text-base sm:text-lg border-2 justify-start text-left font-normal",
                          !formData.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => date && setFormData({ ...formData, date })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Select the date of the visit (past dates allowed)
                  </p>
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
                    <p className="font-semibold text-foreground mb-0.5">Time Auto-tracked</p>
                    <p>Current time recorded, date can be set above</p>
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

      {/* Validation Errors Alert */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-1">Data Validation Errors:</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Reconciliation Status Toggle */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowReconciliationStatus(!showReconciliationStatus)}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          {showReconciliationStatus ? "Hide" : "Show"} Reconciliation Status
        </Button>
      </div>

      {/* Reconciliation Status Card */}
      {showReconciliationStatus && <VisitReconciliationStatus showAll={false} />}

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
