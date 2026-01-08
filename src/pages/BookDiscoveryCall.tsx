import { useState, useCallback } from "react";
import { Calendar, Clock, User, Mail, Phone, Check, ArrowRight, ArrowLeft, MapPin, Target, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { emailSchema, phoneSchema, formatPhoneNumber, validateField } from "@/lib/validation";

// Generate time slots dynamically based on availability
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      slots.push(time);
    }
  }
  return slots;
};

const PROPERTY_GOALS = [
  { id: "maximize_revenue", label: "Maximize rental revenue" },
  { id: "minimize_hassle", label: "Minimize day-to-day hassle" },
  { id: "maintain_property", label: "Keep property well-maintained" },
  { id: "flexible_use", label: "Balance personal use with rentals" },
  { id: "long_term_tenant", label: "Find a reliable long-term tenant" },
  { id: "not_sure", label: "Not sure yet, need guidance" },
];

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family Home" },
  { value: "condo", label: "Condo / Townhouse" },
  { value: "multi_unit", label: "Multi-Unit Property" },
  { value: "vacation_home", label: "Vacation / Second Home" },
  { value: "investment", label: "Investment Property" },
];

export default function BookDiscoveryCall() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    propertyAddress: "",
    propertyType: "",
    goals: [] as string[],
    additionalNotes: "",
  });
  const [errors, setErrors] = useState<{ email?: string; phone?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; phone?: boolean }>({});
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
      return data?.map((d) => new Date(d.date)) || [];
    },
  });

  // Fetch existing scheduled calls
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

  // Get available days based on availability slots
  const availableDays = availabilitySlots.map((slot) => slot.day_of_week);

  // Check if a date is disabled
  const isDateDisabled = (date: Date) => {
    const dayOfWeek = getDay(date);
    const isBlocked = blockedDates.some(
      (blocked) => format(blocked, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
    );
    const isPast = isBefore(date, addDays(new Date(), -1));
    const isAvailable = availableDays.length === 0 || availableDays.includes(dayOfWeek);
    return isPast || isBlocked || !isAvailable;
  };

  // Get time slots for selected date
  const getTimeSlotsForDate = (date: Date) => {
    const dayOfWeek = getDay(date);
    const slot = availabilitySlots.find((s) => s.day_of_week === dayOfWeek);
    if (!slot) return generateTimeSlots(9, 17); // Default 9am-5pm

    const startHour = parseInt(slot.start_time.split(":")[0]);
    const endHour = parseInt(slot.end_time.split(":")[0]);
    return generateTimeSlots(startHour, endHour);
  };

  // Check if time is booked
  const isTimeSlotBooked = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, 15);

    return existingCalls.some((call) => {
      const callStart = new Date(call.scheduled_at);
      const callEnd = addMinutes(callStart, call.duration_minutes || 15);
      return slotStart >= callStart && slotStart < callEnd;
    });
  };

  // Check if time is past
  const isTimeSlotPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    return isBefore(slotTime, new Date());
  };

  const availableTimeSlots = selectedDate
    ? getTimeSlotsForDate(selectedDate).filter(
        (time) =>
          !isTimeSlotBooked(selectedDate, time) &&
          !isTimeSlotPast(selectedDate, time)
      )
    : [];

  const toggleGoal = (goalId: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter((g) => g !== goalId)
        : [...prev.goals, goalId],
    }));
  };

  // Validation handlers
  const validateEmail = useCallback((email: string) => {
    const error = validateField(emailSchema, email);
    setErrors((prev) => ({ ...prev, email: error || undefined }));
    return !error;
  }, []);

  const validatePhone = useCallback((phone: string) => {
    const error = validateField(phoneSchema, phone);
    setErrors((prev) => ({ ...prev, phone: error || undefined }));
    return !error;
  }, []);

  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, email });
    if (touched.email) {
      validateEmail(email);
    }
  };

  const handlePhoneChange = (rawPhone: string) => {
    // Format as user types
    const digitsOnly = rawPhone.replace(/\D/g, "");
    let formatted = rawPhone;
    
    // Auto-format if the user is typing digits
    if (digitsOnly.length <= 10) {
      if (digitsOnly.length >= 6) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
      } else if (digitsOnly.length >= 3) {
        formatted = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
      } else {
        formatted = digitsOnly;
      }
    }
    
    setFormData({ ...formData, phone: formatted });
    if (touched.phone) {
      validatePhone(formatted);
    }
  };

  const handleEmailBlur = () => {
    setTouched((prev) => ({ ...prev, email: true }));
    validateEmail(formData.email);
  };

  const handlePhoneBlur = () => {
    setTouched((prev) => ({ ...prev, phone: true }));
    validatePhone(formData.phone);
  };

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const goalsLabels = formData.goals
        .map((g) => PROPERTY_GOALS.find((pg) => pg.id === g)?.label)
        .filter(Boolean)
        .join(", ");

      const notes = [
        `Property Type: ${PROPERTY_TYPES.find((t) => t.value === formData.propertyType)?.label || "Not specified"}`,
        `Goals: ${goalsLabels || "Not specified"}`,
        formData.additionalNotes ? `Additional Notes: ${formData.additionalNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      // Create a lead and discovery call
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          property_address: formData.propertyAddress,
          property_type: formData.propertyType,
          stage: "call_scheduled" as const,
          opportunity_source: "website_booking",
          notes: notes,
        }])
        .select()
        .single();

      if (leadError) throw leadError;

      const { error: callError } = await supabase.from("discovery_calls").insert({
        lead_id: lead.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 30,
        status: "scheduled",
        meeting_notes: notes,
      });

      if (callError) throw callError;

      return scheduledAt;
    },
    onSuccess: () => {
      setIsBooked(true);
      toast.success("Your discovery call has been booked!");
    },
    onError: (error: any) => {
      toast.error(`Failed to book: ${error.message}`);
    },
  });

  // Enhanced validation for step 1
  const isStep1Valid = formData.name.trim().length >= 2 && 
    !errors.email && formData.email.trim() && 
    !errors.phone && formData.phone.trim();
  const canProceedStep2 = isStep1Valid;
  const canProceedStep3 = formData.propertyAddress;
  const canProceedStep4 = selectedDate;
  const canProceedStep5 = selectedTime;

  if (isBooked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-xl border-primary/20">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">You're All Set!</h2>
            <p className="text-muted-foreground mb-4">
              Your discovery call is scheduled for{" "}
              <strong className="text-foreground">
                {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")} at{" "}
                {selectedTime &&
                  format(
                    setMinutes(
                      setHours(new Date(), parseInt(selectedTime.split(":")[0])),
                      parseInt(selectedTime.split(":")[1])
                    ),
                    "h:mm a"
                  )}
              </strong>
            </p>
            <div className="bg-primary/5 rounded-lg p-4 mb-4 text-left">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                What happens next?
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• We'll send a confirmation email to {formData.email}</li>
                <li>• Our team will research your property and market</li>
                <li>• We'll prepare a personalized revenue analysis</li>
                <li>• You'll receive a calendar invite with call details</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Questions? Reply to our confirmation email anytime.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full shadow-xl border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Book Your Discovery Call</CardTitle>
          <CardDescription className="text-base">
            A free 30-minute call to explore how we can help with your property
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Why we ask info box */}
          <div className="bg-accent/10 rounded-lg p-3 mb-6 border border-accent/20">
            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">We prepare for every call.</strong> The information you share helps us research your property and market so we can provide specific insights during our conversation.
              </span>
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  step >= s ? "bg-primary w-8" : "bg-muted w-4"
                )}
              />
            ))}
          </div>

{/* Step 1: Contact Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Your Contact Information
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={handleEmailBlur}
                      className={cn(errors.email && touched.email && "border-destructive focus-visible:ring-destructive")}
                    />
                  </div>
                  {errors.email && touched.email && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(404) 555-1234"
                      value={formData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={handlePhoneBlur}
                      className={cn(errors.phone && touched.phone && "border-destructive focus-visible:ring-destructive")}
                    />
                  </div>
                  {errors.phone && touched.phone && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.phone}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll send appointment reminders to this number
                  </p>
                </div>
              </div>
              <Button 
                className="w-full" 
                disabled={!canProceedStep2} 
                onClick={() => {
                  // Validate all before proceeding
                  const emailValid = validateEmail(formData.email);
                  const phoneValid = validatePhone(formData.phone);
                  setTouched({ email: true, phone: true });
                  if (emailValid && phoneValid && formData.name.trim().length >= 2) {
                    setStep(2);
                  }
                }}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Property Info */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Tell Us About Your Property
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">Property Address *</Label>
                  <GooglePlacesAutocomplete
                    id="address"
                    placeholder="Start typing your property address..."
                    value={formData.propertyAddress}
                    onChange={(value) => setFormData({ ...formData, propertyAddress: value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This helps us research your area and provide relevant market insights
                  </p>
                </div>
                <div>
                  <Label>Property Type</Label>
                  <RadioGroup
                    value={formData.propertyType}
                    onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                    className="grid grid-cols-2 gap-2 mt-2"
                  >
                    {PROPERTY_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={type.value} id={type.value} />
                        <Label htmlFor={type.value} className="text-sm cursor-pointer">
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" disabled={!canProceedStep3} onClick={() => setStep(3)}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Goals */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                What Are Your Goals?
              </h3>
              <p className="text-sm text-muted-foreground">
                Select all that apply so we can tailor our conversation
              </p>
              <div className="space-y-2">
                {PROPERTY_GOALS.map((goal) => (
                  <div
                    key={goal.id}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      formData.goals.includes(goal.id)
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/50 border-transparent hover:border-primary/30"
                    )}
                    onClick={() => toggleGoal(goal.id)}
                  >
                    <Checkbox
                      checked={formData.goals.includes(goal.id)}
                      onCheckedChange={() => toggleGoal(goal.id)}
                    />
                    <Label className="cursor-pointer flex-1">{goal.label}</Label>
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="notes">Anything else we should know? (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="E.g., timeline, specific concerns, current situation..."
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Date Selection */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Pick a Date
              </h3>
              <div className="flex justify-center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }}
                  disabled={isDateDisabled}
                  className={cn("rounded-md border pointer-events-auto")}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1" disabled={!canProceedStep4} onClick={() => setStep(5)}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Time Selection & Confirm */}
          {step === 5 && selectedDate && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Select a Time for {format(selectedDate, "MMMM d")}
              </h3>
              {availableTimeSlots.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  No available slots for this date. Please select another day.
                </p>
              ) : (
                <ScrollArea className="h-40">
                  <div className="grid grid-cols-3 gap-2">
                    {availableTimeSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                        className="text-sm"
                      >
                        {format(
                          setMinutes(
                            setHours(new Date(), parseInt(time.split(":")[0])),
                            parseInt(time.split(":")[1])
                          ),
                          "h:mm a"
                        )}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Booking Summary */}
              {selectedTime && (
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <h4 className="font-medium">Booking Summary</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Date:</strong> {format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                    <p>
                      <strong>Time:</strong>{" "}
                      {format(
                        setMinutes(
                          setHours(new Date(), parseInt(selectedTime.split(":")[0])),
                          parseInt(selectedTime.split(":")[1])
                        ),
                        "h:mm a"
                      )}{" "}
                      (15 minutes)
                    </p>
                    <p><strong>Property:</strong> {formData.propertyAddress}</p>
                    <p><strong>Contact:</strong> {formData.name} ({formData.email})</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canProceedStep5 || bookMutation.isPending}
                  onClick={() => bookMutation.mutate()}
                >
                  {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
