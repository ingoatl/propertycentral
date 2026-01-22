import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, ArrowRight, Check, ChevronLeft, ChevronRight, Loader2, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const EST_TIMEZONE = 'America/New_York';

const CALL_TOPICS = [
  { value: "monthly_statement", label: "Monthly Statement Questions" },
  { value: "maintenance", label: "Maintenance & Repairs" },
  { value: "guest_concerns", label: "Guest Concerns" },
  { value: "pricing", label: "Pricing Discussion" },
  { value: "general_checkin", label: "General Check-in" },
  { value: "property_update", label: "Property Updates" },
  { value: "other", label: "Other (Please specify)" },
];

interface FormData {
  name: string;
  email: string;
  phone: string;
  topic: string;
  topicDetails: string;
}

interface PropertyInfo {
  id: string;
  name: string;
  address: string;
  image_path?: string;
}

export default function BookOwnerCall() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    topic: "",
    topicDetails: "",
  });
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);

  // Pre-fill from URL params (magic link support)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const name = params.get("name");
    const phone = params.get("phone");
    const propertyId = params.get("propertyId");
    const topic = params.get("topic");
    
    if (email || name || phone || topic) {
      setFormData(prev => ({
        ...prev,
        email: email || prev.email,
        name: name || prev.name,
        phone: phone || prev.phone,
        topic: topic || prev.topic,
      }));
    }

    // Fetch owner info to get property
    if (email) {
      fetchOwnerProperty(email, propertyId || undefined);
    } else if (propertyId) {
      fetchPropertyById(propertyId);
    }
  }, []);

  const fetchOwnerProperty = async (email: string, propertyId?: string) => {
    setIsLoadingProperty(true);
    try {
      // First try to find owner by email
      const { data: owner } = await supabase
        .from('property_owners')
        .select('id, name')
        .ilike('email', email)
        .maybeSingle();

      if (owner) {
        // Get owner's properties
        const { data: properties } = await supabase
          .from('properties')
          .select('id, name, address, image_path')
          .eq('owner_id', owner.id)
          .limit(1);

        if (properties && properties.length > 0) {
          const prop = propertyId 
            ? properties.find(p => p.id === propertyId) || properties[0]
            : properties[0];
          setPropertyInfo({
            id: prop.id,
            name: prop.name,
            address: prop.address || '',
            image_path: prop.image_path || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching owner property:', error);
    } finally {
      setIsLoadingProperty(false);
    }
  };

  const fetchPropertyById = async (propertyId: string) => {
    setIsLoadingProperty(true);
    try {
      const { data: prop } = await supabase
        .from('properties')
        .select('id, name, address, image_path')
        .eq('id', propertyId)
        .maybeSingle();

      if (prop) {
        setPropertyInfo({
          id: prop.id,
          name: prop.name,
          address: prop.address || '',
          image_path: prop.image_path || undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching property:', error);
    } finally {
      setIsLoadingProperty(false);
    }
  };

  const fetchAvailableSlots = useCallback(async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-owner-call-slots", {
        body: { date: format(selectedDate, "yyyy-MM-dd") }
      });

      if (error) throw error;
      setAvailableSlots(data?.slots || []);
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast.error("Failed to load available times");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDate, fetchAvailableSlots]);

  const generateCalendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    const startDayOfWeek = start.getDay();
    const paddedDays: (Date | null)[] = Array(startDayOfWeek).fill(null);
    
    return [...paddedDays, ...days];
  };

  const isDateAvailable = (date: Date) => {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    if (isBefore(startOfDay(date), startOfDay(new Date()))) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("owner-call-webhook", {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          topic: formData.topic,
          topicDetails: formData.topicDetails,
          scheduledAt: selectedTime,
          propertyId: propertyInfo?.id,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsSuccess(true);
      toast.success("Call scheduled successfully!");
    } catch (error: any) {
      console.error("Error booking call:", error);
      toast.error(error.message || "Failed to schedule call");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeSlot = (isoString: string) => {
    try {
      return formatInTimeZone(parseISO(isoString), EST_TIMEZONE, "h:mm a");
    } catch {
      return isoString;
    }
  };

  const isStep1Valid = formData.name && formData.email && formData.topic;
  const isStep2Valid = selectedDate && selectedTime;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg border-primary/10">
          <CardContent className="pt-8 pb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Call Scheduled!</h2>
            <p className="text-muted-foreground mb-4">
              Your owner call has been booked. You'll receive a confirmation email shortly with the meeting details.
            </p>
            {selectedTime && (
              <div className="bg-secondary rounded-xl p-4 text-sm">
                <p className="font-semibold text-foreground">{formatInTimeZone(parseISO(selectedTime), EST_TIMEZONE, "EEEE, MMMM d, yyyy")}</p>
                <p className="text-muted-foreground">{formatTimeSlot(selectedTime)} EST</p>
                <p className="text-muted-foreground mt-2">Topic: {CALL_TOPICS.find(t => t.value === formData.topic)?.label}</p>
                {propertyInfo && (
                  <p className="text-primary font-medium mt-2">{propertyInfo.name}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent/30">
      {/* Header */}
      <div className="bg-card border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-md">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">PeachHaus Owner Call</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Schedule a call with your property manager</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step >= 1 ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted'}`}>
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <span className="text-sm font-medium hidden sm:inline">Your Info</span>
          </div>
          <div className="w-8 sm:w-12 h-0.5 bg-border rounded-full" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${step >= 2 ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Schedule</span>
          </div>
        </div>

        {/* Step 1: Contact Info & Topic */}
        {step === 1 && (
          <Card className="max-w-xl mx-auto shadow-lg border-primary/10">
            {/* Property Card - Show if we have property info */}
            {propertyInfo && (
              <div className="bg-gradient-to-br from-secondary via-accent/30 to-secondary rounded-t-xl">
                <div className="p-5 sm:p-6">
                  <div className="flex gap-4 sm:gap-5 items-center">
                    {/* Property Image */}
                    {propertyInfo.image_path ? (
                      <div className="relative flex-shrink-0">
                        <img 
                          src={`https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/${propertyInfo.image_path}`}
                          alt={propertyInfo.name}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-lg ring-2 ring-background"
                        />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-background">
                        <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary/70" />
                      </div>
                    )}
                    
                    {/* Property Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-primary font-semibold uppercase tracking-widest mb-1.5">Your Property</p>
                      <h3 className="font-bold text-foreground text-lg sm:text-xl leading-tight truncate">{propertyInfo.name}</h3>
                      {propertyInfo.address && (
                        <div className="flex items-start gap-2 mt-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary/60" />
                          <span className="text-sm sm:text-base leading-snug">{propertyInfo.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isLoadingProperty && (
              <div className="bg-gradient-to-br from-secondary via-accent/30 to-secondary rounded-t-xl p-5 sm:p-6">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-muted/60 animate-pulse" />
                  <div className="flex-1 space-y-3">
                    <div className="h-2.5 w-20 bg-muted/60 animate-pulse rounded-full" />
                    <div className="h-5 w-44 bg-muted/60 animate-pulse rounded" />
                    <div className="h-4 w-56 bg-muted/60 animate-pulse rounded" />
                  </div>
                </div>
              </div>
            )}

            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-lg sm:text-xl">Your Information</CardTitle>
              <CardDescription className="text-sm">Tell us about yourself and what you'd like to discuss</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="h-11 sm:h-12 text-base"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="h-11 sm:h-12 text-base"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(404) 555-1234"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-11 sm:h-12 text-base"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic" className="text-sm font-medium">What would you like to discuss? <span className="text-destructive">*</span></Label>
                <Select value={formData.topic} onValueChange={(value) => setFormData(prev => ({ ...prev, topic: value }))}>
                  <SelectTrigger className="h-11 sm:h-12 text-base">
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_TOPICS.map((topic) => (
                      <SelectItem key={topic.value} value={topic.value} className="text-base">
                        {topic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.topic && (
                <div className="space-y-2">
                  <Label htmlFor="topicDetails" className="text-sm font-medium">
                    {formData.topic === "other" ? "Please describe your topic *" : "Any additional details?"} 
                    {formData.topic !== "other" && <span className="text-muted-foreground text-xs ml-1">(optional)</span>}
                  </Label>
                  <Textarea
                    id="topicDetails"
                    placeholder="Tell us more so we can prepare..."
                    value={formData.topicDetails}
                    onChange={(e) => setFormData(prev => ({ ...prev, topicDetails: e.target.value }))}
                    rows={3}
                    className="text-base resize-none"
                  />
                </div>
              )}

              <Button 
                onClick={() => setStep(2)} 
                disabled={!isStep1Valid || (formData.topic === "other" && !formData.topicDetails)}
                className="w-full h-12 sm:h-14 text-base font-semibold bg-primary hover:bg-primary/90 shadow-md"
              >
                Continue to Scheduling
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Calendar */}
        {step === 2 && (
          <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 max-w-4xl mx-auto">
            {/* Calendar */}
            <Card className="shadow-lg border-primary/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">Select a Date</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs sm:text-sm font-medium w-28 sm:w-32 text-center">
                      {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                    <div key={`${day}-${i}`} className="text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays().map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="h-9 sm:h-10" />;
                    }
                    
                    const available = isDateAvailable(day);
                    const selected = selectedDate && isSameDay(day, selectedDate);
                    const today = isToday(day);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => available && setSelectedDate(day)}
                        disabled={!available}
                        className={`
                          h-9 sm:h-10 rounded-lg text-sm font-medium transition-all touch-target-lg
                          ${!available ? 'text-muted-foreground/30 cursor-not-allowed' : 'hover:bg-primary/10 active:scale-95'}
                          ${selected ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90' : ''}
                          ${today && !selected ? 'ring-2 ring-primary/40' : ''}
                        `}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Available Monday - Friday, 11am - 5pm EST
                </p>
              </CardContent>
            </Card>

            {/* Time Slots */}
            <Card className="shadow-lg border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {selectedDate ? format(selectedDate, "EEE, MMM d") : "Select a date first"}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">All times shown in EST</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Please select a date to see available times
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-muted-foreground text-sm">
                      No available times for this date. Please try another day.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[280px] sm:max-h-[300px] overflow-y-auto scrollbar-hide">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`
                          px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg text-sm font-medium transition-all touch-target-lg active:scale-95
                          ${selectedTime === slot 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'bg-muted hover:bg-primary/10'}
                        `}
                      >
                        {formatTimeSlot(slot)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {selectedTime && (
                  <div className="mt-4 p-3 sm:p-4 bg-secondary rounded-xl border border-primary/10">
                    <p className="text-sm font-semibold text-foreground">Your Selection:</p>
                    <p className="text-sm text-muted-foreground">
                      {formatInTimeZone(parseISO(selectedTime), EST_TIMEZONE, "EEEE, MMMM d 'at' h:mm a")} EST
                    </p>
                    <p className="text-xs text-primary font-medium mt-1">30-minute call</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation & Submit */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:justify-between mt-2 sm:mt-4">
              <Button 
                variant="outline" 
                onClick={() => setStep(1)}
                className="h-12 sm:h-11 order-2 sm:order-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!isStep2Valid || isSubmitting}
                className="h-12 sm:h-11 bg-primary hover:bg-primary/90 shadow-md order-1 sm:order-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    Confirm Booking
                    <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
