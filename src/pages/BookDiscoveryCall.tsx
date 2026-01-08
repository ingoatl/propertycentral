import { useState } from "react";
import { 
  Calendar, Clock, User, Check, ArrowRight, ArrowLeft, MapPin, Target, 
  Sparkles, Video, PhoneCall, Home, Briefcase, Building, AlertCircle, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

// Generate 30-minute time slots
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

// Property types
const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family Home", icon: Home },
  { value: "condo", label: "Condo / Townhouse", icon: Building },
  { value: "vacation_home", label: "Vacation Home", icon: Home },
  { value: "investment", label: "Investment Property", icon: Briefcase },
];

// Current management situation - key qualifying question
const CURRENT_MANAGEMENT = [
  { value: "self_managing", label: "I'm currently self-managing", description: "Handling everything myself but looking for help" },
  { value: "unhappy_pm", label: "Unhappy with current PM", description: "Have a property manager but not satisfied" },
  { value: "new_property", label: "New property / Just purchased", description: "Getting started with a new investment" },
  { value: "switching_use", label: "Switching rental strategy", description: "Moving from long-term to short-term or vice versa" },
  { value: "exploring", label: "Just exploring options", description: "Researching before making any decisions" },
];

// Rental strategy - key qualifying question
const RENTAL_STRATEGIES = [
  { 
    value: "str", 
    label: "Short-Term Rental (STR)", 
    icon: Home, 
    description: "Nightly stays on Airbnb, VRBO - highest revenue potential",
    recommended: true
  },
  { 
    value: "mtr", 
    label: "Mid-Term Rental (MTR)", 
    icon: Briefcase, 
    description: "30+ day furnished stays - less turnover, steady income" 
  },
  { 
    value: "ltr", 
    label: "Long-Term Rental (LTR)", 
    icon: Building, 
    description: "Traditional 12-month leases - lowest management needs" 
  },
  { 
    value: "not_sure", 
    label: "Not sure yet", 
    icon: Target, 
    description: "Let's discuss which strategy is best for your property" 
  },
];

// Timeline - when do they want to start
const START_TIMELINES = [
  { value: "asap", label: "As soon as possible", urgency: "high" },
  { value: "within_2_weeks", label: "Within 2 weeks", urgency: "high" },
  { value: "within_month", label: "Within the next month", urgency: "medium" },
  { value: "1_3_months", label: "1-3 months from now", urgency: "low" },
  { value: "exploring", label: "Just exploring options", urgency: "low" },
];

// Meeting types
const MEETING_TYPES = [
  { 
    value: "video", 
    label: "Video Call", 
    icon: Video, 
    description: "Better presentation with screen sharing via Google Meet",
    recommended: true
  },
  { 
    value: "phone", 
    label: "Phone Call", 
    icon: PhoneCall, 
    description: "Quick and convenient - we'll call you" 
  },
];

// Goals
const PROPERTY_GOALS = [
  { id: "maximize_revenue", label: "Maximize rental revenue" },
  { id: "minimize_hassle", label: "Minimize day-to-day hassle" },
  { id: "maintain_property", label: "Keep property well-maintained" },
  { id: "flexible_use", label: "Balance personal use with rentals" },
  { id: "not_sure", label: "Not sure yet, need guidance" },
];

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation - at least 10 digits
const validatePhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
};

// Format phone as user types
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export default function BookDiscoveryCall() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    propertyAddress: "",
    propertyType: "",
    currentManagement: "",
    rentalStrategy: "",
    existingListingUrl: "",
    startTimeline: "",
    meetingType: "video",
    goals: [] as string[],
    additionalNotes: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isBooked, setIsBooked] = useState(false);

  // Fetch availability slots
  const { data: availabilitySlots = [] } = useQuery({
    queryKey: ["public-availability-slots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("is_active", true);
      return data || [];
    },
  });

  // Fetch blocked dates
  const { data: blockedDates = [] } = useQuery({
    queryKey: ["public-blocked-dates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_dates")
        .select("date")
        .gte("date", new Date().toISOString().split("T")[0]);
      return data?.map(d => new Date(d.date)) || [];
    },
  });

  // Fetch existing calls
  const { data: existingCalls = [] } = useQuery({
    queryKey: ["public-discovery-calls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discovery_calls")
        .select("scheduled_at, duration_minutes")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString());
      return data || [];
    },
  });

  const availableDays = availabilitySlots.map(slot => slot.day_of_week);

  const isDateDisabled = (date: Date) => {
    const dayOfWeek = getDay(date);
    const isBlocked = blockedDates.some(blocked => 
      format(blocked, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
    const isPast = isBefore(date, addDays(new Date(), -1));
    const isAvailable = availableDays.length === 0 || availableDays.includes(dayOfWeek);
    return isPast || isBlocked || !isAvailable;
  };

  const getTimeSlotsForDate = (date: Date) => {
    const dayOfWeek = getDay(date);
    const slot = availabilitySlots.find(s => s.day_of_week === dayOfWeek);
    if (!slot) return generateTimeSlots(9, 17);
    const startHour = parseInt(slot.start_time.split(":")[0]);
    const endHour = parseInt(slot.end_time.split(":")[0]);
    return generateTimeSlots(startHour, endHour);
  };

  const isTimeSlotBooked = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, 30);

    return existingCalls.some(call => {
      const callStart = new Date(call.scheduled_at);
      const callEnd = addMinutes(callStart, call.duration_minutes || 30);
      return slotStart < callEnd && slotEnd > callStart;
    });
  };

  const isTimeSlotPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    return isBefore(slotTime, new Date());
  };

  const availableTimeSlots = selectedDate
    ? getTimeSlotsForDate(selectedDate).filter(time => 
        !isTimeSlotBooked(selectedDate, time) && !isTimeSlotPast(selectedDate, time)
      )
    : [];

  // Validation
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = "Please enter your full name";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = "Please enter a valid 10-digit phone number";
    }
    
    setErrors(newErrors);
    setTouched({ name: true, email: true, phone: true });
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.propertyAddress.trim() || formData.propertyAddress.length < 10) {
      newErrors.propertyAddress = "Please enter a complete property address";
    }
    setErrors(prev => ({ ...prev, ...newErrors }));
    setTouched(prev => ({ ...prev, propertyAddress: true }));
    return !newErrors.propertyAddress;
  };

  const toggleGoal = (goalId: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter(g => g !== goalId)
        : [...prev.goals, goalId],
    }));
  };

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const notes = [
        `Current Situation: ${CURRENT_MANAGEMENT.find(c => c.value === formData.currentManagement)?.label || "Not specified"}`,
        `Rental Strategy: ${RENTAL_STRATEGIES.find(s => s.value === formData.rentalStrategy)?.label || "Not specified"}`,
        `Timeline: ${START_TIMELINES.find(t => t.value === formData.startTimeline)?.label || "Not specified"}`,
        `Meeting Type: ${formData.meetingType === "video" ? "Video Call (Google Meet)" : "Phone Call"}`,
        `Property Type: ${PROPERTY_TYPES.find(t => t.value === formData.propertyType)?.label || "Not specified"}`,
        `Goals: ${formData.goals.map(g => PROPERTY_GOALS.find(pg => pg.id === g)?.label).filter(Boolean).join(", ") || "Not specified"}`,
        formData.existingListingUrl ? `Existing Listing: ${formData.existingListingUrl}` : "",
        formData.additionalNotes ? `Notes: ${formData.additionalNotes}` : "",
      ].filter(Boolean).join("\n");

      // Create lead first
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone,
          property_address: formData.propertyAddress,
          property_type: formData.propertyType || null,
          stage: "call_scheduled",
          opportunity_source: "website_booking",
          notes: notes,
        })
        .select()
        .single();

      if (leadError) throw new Error(leadError.message);

      // Create discovery call
      const { data: call, error: callError } = await supabase
        .from("discovery_calls")
        .insert({
          lead_id: lead.id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: 30,
          status: "scheduled",
          meeting_type: formData.meetingType,
          rental_strategy: formData.rentalStrategy || null,
          existing_listing_url: formData.existingListingUrl || null,
          current_situation: formData.currentManagement || null,
          start_timeline: formData.startTimeline,
          meeting_notes: notes,
          google_meet_link: formData.meetingType === "video" ? GOOGLE_MEET_LINK : null,
        })
        .select()
        .single();

      if (callError) throw new Error(callError.message);

      // Send notifications (don't fail if this errors)
      try {
        await Promise.all([
          supabase.functions.invoke("discovery-call-notifications", {
            body: { discoveryCallId: call.id, notificationType: "confirmation" },
          }),
          supabase.functions.invoke("discovery-call-notifications", {
            body: { discoveryCallId: call.id, notificationType: "admin_notification" },
          }),
        ]);
      } catch (notifError) {
        console.error("Notification error:", notifError);
      }

      return { scheduledAt, meetingType: formData.meetingType };
    },
    onSuccess: () => {
      setIsBooked(true);
      queryClient.invalidateQueries({ queryKey: ["public-discovery-calls"] });
      toast.success("Your discovery call has been booked!");
    },
    onError: (error: Error) => {
      console.error("Booking error:", error);
      toast.error(`Booking failed: ${error.message}`);
    },
  });

  // Success screen
  if (isBooked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center shadow-xl border-primary/20">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">You're All Set!</h2>
            <p className="text-muted-foreground mb-4">
              Your discovery call is scheduled for{" "}
              <strong className="text-foreground">
                {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")} at{" "}
                {selectedTime && format(
                  setMinutes(setHours(new Date(), parseInt(selectedTime.split(":")[0])), parseInt(selectedTime.split(":")[1])),
                  "h:mm a"
                )}
              </strong>
            </p>
            
            {formData.meetingType === "video" ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="font-medium text-green-800 mb-2 flex items-center gap-2 justify-center">
                  <Video className="h-5 w-5" /> Video Call via Google Meet
                </p>
                <a 
                  href={GOOGLE_MEET_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Join Meeting
                </a>
                <p className="text-sm text-green-700 mt-2">{GOOGLE_MEET_LINK}</p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="font-medium text-blue-800 flex items-center gap-2 justify-center">
                  <PhoneCall className="h-5 w-5" /> We'll call you at: {formData.phone}
                </p>
              </div>
            )}
            
            <div className="bg-primary/5 rounded-lg p-4 mb-6 text-left">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> What happens next?
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Confirmation email sent to {formData.email}</li>
                <li>✓ Reminders 24 hours and 1 hour before</li>
                <li>✓ Our team will research your property</li>
                <li>✓ We'll prepare a revenue estimate</li>
              </ul>
            </div>
            
            {/* Signature */}
            <div className="border-t pt-6 mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Looking forward to speaking with you</p>
              <img 
                src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/anja-signature.png" 
                alt="Anja & Ingo Schaer" 
                className="h-10 mx-auto mb-2"
              />
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">PeachHaus Group</p>
              <div className="mt-3">
                <img 
                  src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/anja-ingo-hosts.jpg" 
                  alt="Anja & Ingo" 
                  className="w-16 h-16 rounded-full mx-auto border-2 border-muted object-cover"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = 7;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full shadow-xl border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Book Your Discovery Call</CardTitle>
          <CardDescription className="text-base">
            A free 30-minute call to explore how we can help maximize your property's potential
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Progress bar */}
          <div className="flex items-center justify-center gap-1 mb-6">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <div
                key={s}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  step >= s ? "bg-primary w-6" : "bg-muted w-3"
                )}
              />
            ))}
          </div>

          {/* Step 1: Contact Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Let's start with your contact info
              </h3>
              <p className="text-sm text-muted-foreground">
                We'll send confirmations and reminders here
              </p>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                    className={cn(touched.name && errors.name && "border-destructive")}
                  />
                  {touched.name && errors.name && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.name}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                    className={cn(touched.email && errors.email && "border-destructive")}
                  />
                  {touched.email && errors.email && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.email}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(404) 555-1234"
                    value={formData.phone}
                    onChange={e => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                    className={cn(touched.phone && errors.phone && "border-destructive")}
                  />
                  {touched.phone && errors.phone && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.phone}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    For reminders and if you choose a phone call
                  </p>
                </div>
              </div>
              
              <Button className="w-full" onClick={() => validateStep1() && setStep(2)}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Property Address */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Where is your property?
              </h3>
              <p className="text-sm text-muted-foreground">
                This helps us research your market and prepare insights
              </p>
              
              <div>
                <Label htmlFor="address">Property Address *</Label>
                <AddressAutocomplete
                  id="address"
                  placeholder="Start typing your property address..."
                  value={formData.propertyAddress}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, propertyAddress: value }));
                    setErrors(prev => ({ ...prev, propertyAddress: "" }));
                  }}
                  className={cn(touched.propertyAddress && errors.propertyAddress && "border-destructive")}
                />
                {touched.propertyAddress && errors.propertyAddress && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.propertyAddress}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your full property address (e.g., 123 Main St, Atlanta, GA 30301)
                </p>
              </div>
              
              <div>
                <Label className="mb-2 block">Property Type (optional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PROPERTY_TYPES.map(type => (
                    <div
                      key={type.value}
                      onClick={() => setFormData(prev => ({ ...prev, propertyType: type.value }))}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                        formData.propertyType === type.value
                          ? "bg-primary/10 border-primary"
                          : "bg-muted/30 border-transparent hover:border-primary/30"
                      )}
                    >
                      <type.icon className={cn(
                        "h-4 w-4",
                        formData.propertyType === type.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="text-sm">{type.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={() => validateStep2() && setStep(3)}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Current Situation */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                What's your current situation?
              </h3>
              <p className="text-sm text-muted-foreground">
                This helps us understand how we can best help you
              </p>
              
              <div className="space-y-2">
                {CURRENT_MANAGEMENT.map(option => (
                  <div
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, currentManagement: option.value }))}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all",
                      formData.currentManagement === option.value
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/30 border-transparent hover:border-primary/30"
                    )}
                  >
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  className="flex-1" 
                  disabled={!formData.currentManagement}
                  onClick={() => setStep(4)}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Rental Strategy */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                What type of rental are you interested in?
              </h3>
              <p className="text-sm text-muted-foreground">
                This helps us prepare the right information for your call
              </p>
              
              <div className="space-y-3">
                {RENTAL_STRATEGIES.map(strategy => (
                  <div
                    key={strategy.value}
                    onClick={() => setFormData(prev => ({ ...prev, rentalStrategy: strategy.value }))}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all relative",
                      formData.rentalStrategy === strategy.value
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/30 border-transparent hover:border-primary/30"
                    )}
                  >
                    {strategy.recommended && (
                      <span className="absolute -top-2 right-3 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      <strategy.icon className={cn(
                        "h-5 w-5 mt-0.5",
                        formData.rentalStrategy === strategy.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <p className="font-medium">{strategy.label}</p>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Existing Listing URL - show for STR/MTR */}
              {(formData.rentalStrategy === "str" || formData.rentalStrategy === "mtr") && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <Label htmlFor="listingUrl" className="text-sm font-medium">
                    Have an existing Airbnb or VRBO listing? (Optional)
                  </Label>
                  <Input
                    id="listingUrl"
                    placeholder="https://airbnb.com/rooms/..."
                    value={formData.existingListingUrl}
                    onChange={e => setFormData(prev => ({ ...prev, existingListingUrl: e.target.value }))}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If you share your listing, we can prepare a personalized revenue analysis
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  className="flex-1"
                  disabled={!formData.rentalStrategy}
                  onClick={() => setStep(5)}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Timeline */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                When do you need this in place?
              </h3>
              
              <RadioGroup
                value={formData.startTimeline}
                onValueChange={value => setFormData(prev => ({ ...prev, startTimeline: value }))}
                className="space-y-2"
              >
                {START_TIMELINES.map(timeline => (
                  <div
                    key={timeline.value}
                    onClick={() => setFormData(prev => ({ ...prev, startTimeline: timeline.value }))}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      formData.startTimeline === timeline.value
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/30 border-transparent hover:border-primary/30"
                    )}
                  >
                    <RadioGroupItem value={timeline.value} id={timeline.value} />
                    <Label htmlFor={timeline.value} className="cursor-pointer flex-1">
                      {timeline.label}
                    </Label>
                    {timeline.urgency === "high" && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                        Priority
                      </span>
                    )}
                  </div>
                ))}
              </RadioGroup>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!formData.startTimeline}
                  onClick={() => setStep(6)}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Meeting Type */}
          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                How would you like to meet?
              </h3>
              
              <div className="space-y-3">
                {MEETING_TYPES.map(type => (
                  <div
                    key={type.value}
                    onClick={() => setFormData(prev => ({ ...prev, meetingType: type.value }))}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all relative",
                      formData.meetingType === type.value
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/30 border-transparent hover:border-primary/30"
                    )}
                  >
                    {type.recommended && (
                      <span className="absolute -top-2 right-3 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Better Experience
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <type.icon className={cn(
                        "h-6 w-6",
                        formData.meetingType === type.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="flex-1">
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                        formData.meetingType === type.value ? "border-primary bg-primary" : "border-muted-foreground"
                      )}>
                        {formData.meetingType === type.value && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {formData.meetingType === "video" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  📹 Video calls allow us to share screen and show you market data, property comparisons, and revenue projections.
                </div>
              )}
              
              <div>
                <Label htmlFor="notes">Anything specific you'd like to discuss? (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="E.g., specific concerns, questions about our services..."
                  value={formData.additionalNotes}
                  onChange={e => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(5)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={() => setStep(7)}>
                  Pick a Time <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 7: Date & Time Selection */}
          {step === 7 && (
            <div className="space-y-4">
              {!selectedDate ? (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Pick a date
                  </h3>
                  <div className="flex justify-center">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={date => {
                        setSelectedDate(date);
                        setSelectedTime(null);
                      }}
                      disabled={isDateDisabled}
                      className="rounded-md border"
                    />
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => setStep(6)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Select a time for {format(selectedDate, "MMMM d")}
                  </h3>
                  
                  {availableTimeSlots.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-3">No available slots for this date.</p>
                      <Button variant="outline" onClick={() => setSelectedDate(undefined)}>
                        Choose Different Date
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="grid grid-cols-3 gap-2 pr-4">
                        {availableTimeSlots.map(time => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(time)}
                          >
                            {format(
                              setMinutes(setHours(new Date(), parseInt(time.split(":")[0])), parseInt(time.split(":")[1])),
                              "h:mm a"
                            )}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  {selectedTime && (
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <h4 className="font-medium">Booking Summary</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>Date:</strong> {format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                        <p><strong>Time:</strong> {format(
                          setMinutes(setHours(new Date(), parseInt(selectedTime.split(":")[0])), parseInt(selectedTime.split(":")[1])),
                          "h:mm a"
                        )} (30 min)</p>
                        <p><strong>Meeting:</strong> {formData.meetingType === "video" ? "Video Call" : "Phone Call"}</p>
                        <p><strong>Property:</strong> {formData.propertyAddress}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => selectedTime ? setSelectedTime(null) : setSelectedDate(undefined)}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!selectedTime || bookMutation.isPending}
                      onClick={() => bookMutation.mutate()}
                    >
                      {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
