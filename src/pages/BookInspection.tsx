import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Calendar, Clock, User, Check, ArrowRight, ArrowLeft, MapPin, 
  ClipboardCheck, Home, Phone, Mail, Download, ExternalLink,
  Flame, ShowerHead, LockKeyhole, CheckCircle2, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes, getDay, getMonth, getDate, getYear } from "date-fns";
import { cn } from "@/lib/utils";

// US General Holidays (not bank holidays)
const isUSHoliday = (date: Date): boolean => {
  const month = getMonth(date);
  const day = getDate(date);
  const year = getYear(date);
  const dayOfWeek = getDay(date);
  
  // Fixed-date holidays
  if (month === 0 && day === 1) return true; // New Year's Day
  if (month === 6 && day === 4) return true; // Independence Day
  if (month === 10 && day === 11) return true; // Veterans Day
  if (month === 11 && day === 25) return true; // Christmas Day
  
  // MLK Day - Third Monday of January
  if (month === 0 && dayOfWeek === 1) {
    const firstOfMonth = new Date(year, 0, 1);
    const firstMonday = (8 - getDay(firstOfMonth)) % 7 || 7;
    const thirdMonday = firstMonday + 14;
    if (day === thirdMonday) return true;
  }
  
  // Presidents Day - Third Monday of February
  if (month === 1 && dayOfWeek === 1) {
    const firstOfMonth = new Date(year, 1, 1);
    const firstMonday = (8 - getDay(firstOfMonth)) % 7 || 7;
    const thirdMonday = firstMonday + 14;
    if (day === thirdMonday) return true;
  }
  
  // Memorial Day - Last Monday of May
  if (month === 4 && dayOfWeek === 1) {
    const lastDayOfMay = new Date(year, 5, 0).getDate();
    const lastMonday = lastDayOfMay - ((getDay(new Date(year, 4, lastDayOfMay)) + 6) % 7);
    if (day === lastMonday) return true;
  }
  
  // Labor Day - First Monday of September
  if (month === 8 && dayOfWeek === 1) {
    const firstOfMonth = new Date(year, 8, 1);
    const firstMonday = (8 - getDay(firstOfMonth)) % 7 || 7;
    if (day === firstMonday) return true;
  }
  
  // Thanksgiving - Fourth Thursday of November
  if (month === 10 && dayOfWeek === 4) {
    const firstOfMonth = new Date(year, 10, 1);
    const firstThursday = (11 - getDay(firstOfMonth)) % 7 || 7;
    const fourthThursday = firstThursday + 21;
    if (day === fourthThursday) return true;
  }
  
  return false;
};

// Generate 30-minute time slots (11 AM - 3 PM EST)
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 11; hour < 15; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

const INSPECTION_TYPES = [
  { 
    value: "in_person", 
    label: "In-Person Inspection", 
    icon: Home, 
    description: "We'll visit your property - recommended for best results",
    recommended: true
  },
  { 
    value: "virtual", 
    label: "Virtual Walkthrough", 
    icon: Phone, 
    description: "Video call where you show us around your property" 
  },
];

const SMART_LOCK_URL = "https://www.amazon.com/Yale-Security-Connected-Back-Up-YRD410-WF1-BSP/dp/B0B9HWYMV5";
const CHECKLIST_PATH = "/documents/MTR_Start_Up_Checklist.pdf";

// Helper function to download PDF
const downloadChecklist = () => {
  const link = document.createElement('a');
  link.href = CHECKLIST_PATH;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = 'MTR_Start_Up_Checklist.pdf';
  link.click();
};

// Email and phone validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validatePhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
};
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export default function BookInspection() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    propertyAddress: "",
    inspectionType: "in_person",
    hasFireExtinguisher: "",
    hasFireBlanket: "",
    stoveType: "",
    hasPlungers: "",
    hasSmartLock: "",
    wifiWorking: "",
    additionalNotes: "",
    leadId: "",
    propertyId: "",
    propertyImage: "",
  });

  // Prefill from URL params (from lead/onboarding)
  useEffect(() => {
    const name = searchParams.get('name');
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const address = searchParams.get('address');
    const leadId = searchParams.get('leadId');
    const propertyId = searchParams.get('propertyId');
    const propertyImage = searchParams.get('propertyImage');

    if (name || email || address) {
      setFormData(prev => ({
        ...prev,
        name: name || prev.name,
        email: email || prev.email,
        phone: phone || prev.phone,
        propertyAddress: address || prev.propertyAddress,
        leadId: leadId || prev.leadId,
        propertyId: propertyId || prev.propertyId,
        propertyImage: propertyImage || prev.propertyImage,
      }));
    }
  }, [searchParams]);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isBooked, setIsBooked] = useState(false);
  const [bookedDateTime, setBookedDateTime] = useState<{ date: Date; time: string } | null>(null);

  // Only allow Tuesdays (2), Wednesdays (3), and Thursdays (4)
  const isDateDisabled = (date: Date) => {
    const dayOfWeek = getDay(date);
    const isPast = isBefore(date, addDays(new Date(), -1));
    const isAllowedDay = dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4; // Tuesday, Wednesday, Thursday
    const isHoliday = isUSHoliday(date);
    return isPast || !isAllowedDay || isHoliday;
  };

  const isTimeSlotPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    return isBefore(slotTime, new Date());
  };

  const availableTimeSlots = selectedDate
    ? generateTimeSlots().filter(time => !isTimeSlotPast(selectedDate, time))
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
    if (!formData.propertyAddress.trim() || formData.propertyAddress.length < 10) {
      newErrors.propertyAddress = "Please enter a complete property address";
    }
    
    setErrors(newErrors);
    setTouched({ name: true, email: true, phone: true, propertyAddress: true });
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.hasFireExtinguisher) {
      newErrors.hasFireExtinguisher = "Please answer this question";
    }
    if (!formData.hasFireBlanket) {
      newErrors.hasFireBlanket = "Please answer this question";
    }
    if (!formData.stoveType) {
      newErrors.stoveType = "Please select your stove type";
    }
    if (!formData.hasPlungers) {
      newErrors.hasPlungers = "Please answer this question";
    }
    if (!formData.hasSmartLock) {
      newErrors.hasSmartLock = "Please answer this question";
    }
    if (!formData.wifiWorking) {
      newErrors.wifiWorking = "Please answer this question";
    }
    
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      // Structured checklist responses for database storage
      const checklistResponses = {
        hasFireExtinguisher: formData.hasFireExtinguisher,
        hasFireBlanket: formData.hasFireBlanket,
        stoveType: formData.stoveType,
        hasPlungers: formData.hasPlungers,
        hasSmartLock: formData.hasSmartLock,
        wifiWorking: formData.wifiWorking,
        additionalNotes: formData.additionalNotes,
      };

      const safetyNotes = [
        `Fire Extinguisher: ${formData.hasFireExtinguisher === 'yes' ? 'Yes' : 'No'}`,
        `Fire Blanket Near Stove: ${formData.hasFireBlanket === 'yes' ? 'Yes' : 'No'}`,
        `Stove Type: ${formData.stoveType === 'gas' ? 'Gas' : 'Electric'}`,
        `Plunger in Every Bathroom: ${formData.hasPlungers === 'yes' ? 'Yes' : 'No'}`,
        `Has Smart Lock: ${formData.hasSmartLock === 'yes' ? 'Yes, already installed' : formData.hasSmartLock === 'need_install' ? 'Need PeachHaus to install' : 'Will purchase and install'}`,
        `WiFi Working: ${formData.wifiWorking === 'yes' ? 'Yes' : 'No'}`,
        formData.additionalNotes ? `Additional Notes: ${formData.additionalNotes}` : "",
      ].filter(Boolean).join("\n");

      // Call the inspection notifications edge function
      const { data, error } = await supabase.functions.invoke('inspection-notifications', {
        body: {
          type: 'booking',
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone,
          propertyAddress: formData.propertyAddress,
          inspectionType: formData.inspectionType,
          scheduledAt: scheduledAt.toISOString(),
          safetyNotes,
          checklistResponses,
          leadId: formData.leadId || undefined,
          propertyId: formData.propertyId || undefined,
          propertyImage: formData.propertyImage || undefined,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Booking failed");

      return { scheduledAt };
    },
    onSuccess: (data) => {
      setBookedDateTime({ date: data.scheduledAt, time: selectedTime! });
      setIsBooked(true);
      toast.success("Your inspection has been booked!");
    },
    onError: (error: Error) => {
      console.error("Booking error:", error);
      toast.error(`Booking failed: ${error.message}`);
    },
  });

  // Success screen
  if (isBooked && bookedDateTime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center shadow-xl border-primary/20">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Inspection Scheduled!</h2>
            <p className="text-muted-foreground mb-4">
              Your onboarding inspection is scheduled for{" "}
              <strong className="text-foreground">
                {format(bookedDateTime.date, "EEEE, MMMM d, yyyy")}
              </strong>{" "}
              at{" "}
              <strong className="text-foreground">
                {format(setHours(setMinutes(new Date(), parseInt(bookedDateTime.time.split(":")[1])), parseInt(bookedDateTime.time.split(":")[0])), "h:mm a")} EST
              </strong>
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Before Your Inspection
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Review the inventory checklist (link below)</li>
                <li>• Ensure all areas are accessible</li>
                <li>• Have all appliance manuals ready if available</li>
                <li>• Test your smart lock is working</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={downloadChecklist}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Inventory Checklist
              </Button>
              <p className="text-xs text-muted-foreground">
                A confirmation email has been sent to {formData.email}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-8"
            />
            <div className="h-6 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">Onboarding Inspection</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Step {step} of {totalSteps}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Contact & Property Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Schedule Your Onboarding Inspection</h1>
              <p className="text-muted-foreground">
                Let's capture your information and prepare for your property inspection.
              </p>
            </div>

            {/* What to Expect Card */}
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-amber-600" />
                  What We'll Cover During Your Inspection
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Safety equipment verification (fire extinguishers, smoke/CO detectors)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Document all appliance serial numbers</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Inventory check for guest essentials</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>Smart lock verification & connection</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-amber-200 flex flex-wrap gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white"
                    onClick={downloadChecklist}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Inventory Checklist
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={errors.name && touched.name ? "border-destructive" : ""}
                />
                {errors.name && touched.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={errors.email && touched.email ? "border-destructive" : ""}
                />
                {errors.email && touched.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  placeholder="(404) 555-1234"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                  className={errors.phone && touched.phone ? "border-destructive" : ""}
                />
                {errors.phone && touched.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyAddress">Property Address *</Label>
                <Input
                  id="propertyAddress"
                  placeholder="123 Main St, Atlanta, GA 30301"
                  value={formData.propertyAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, propertyAddress: e.target.value }))}
                  className={errors.propertyAddress && touched.propertyAddress ? "border-destructive" : ""}
                />
                {errors.propertyAddress && touched.propertyAddress && (
                  <p className="text-xs text-destructive">{errors.propertyAddress}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Inspection Type</Label>
              <RadioGroup
                value={formData.inspectionType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, inspectionType: value }))}
                className="grid sm:grid-cols-2 gap-3"
              >
                {INSPECTION_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={cn(
                      "relative flex cursor-pointer rounded-lg border p-4 transition-all",
                      formData.inspectionType === type.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={type.value} className="sr-only" />
                    <div className="flex items-start gap-3">
                      <type.icon className={cn(
                        "h-5 w-5 mt-0.5",
                        formData.inspectionType === type.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{type.label}</span>
                          {type.recommended && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="min-w-[140px]"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Safety Questions */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Safety & Equipment Questions</h1>
              <p className="text-muted-foreground">
                Help us prepare for your inspection by answering a few questions.
              </p>
            </div>

            <div className="space-y-6">
              {/* Fire Extinguisher */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-500" />
                  Do you have a fire extinguisher on the property? *
                </Label>
                <RadioGroup
                  value={formData.hasFireExtinguisher}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, hasFireExtinguisher: value }))}
                  className="flex gap-4"
                >
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.hasFireExtinguisher === "yes" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="yes" />
                    <span>Yes</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.hasFireExtinguisher === "no" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="no" />
                    <span>No</span>
                  </label>
                </RadioGroup>
                {errors.hasFireExtinguisher && (
                  <p className="text-xs text-destructive">{errors.hasFireExtinguisher}</p>
                )}
              </div>

              {/* Fire Blanket */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Is there a fire blanket near the stove? *
                </Label>
                <RadioGroup
                  value={formData.hasFireBlanket}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, hasFireBlanket: value }))}
                  className="flex gap-4"
                >
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.hasFireBlanket === "yes" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="yes" />
                    <span>Yes</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.hasFireBlanket === "no" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="no" />
                    <span>No</span>
                  </label>
                </RadioGroup>
                {errors.hasFireBlanket && (
                  <p className="text-xs text-destructive">{errors.hasFireBlanket}</p>
                )}
              </div>

              {/* Stove Type */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-blue-500" />
                  What type of stove do you have? *
                </Label>
                <RadioGroup
                  value={formData.stoveType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, stoveType: value }))}
                  className="flex gap-4"
                >
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.stoveType === "gas" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="gas" />
                    <span>Gas</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.stoveType === "electric" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="electric" />
                    <span>Electric</span>
                  </label>
                </RadioGroup>
                {errors.stoveType && (
                  <p className="text-xs text-destructive">{errors.stoveType}</p>
                )}
              </div>

              {/* Plungers */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <ShowerHead className="h-4 w-4 text-blue-500" />
                  Is there a plunger in every bathroom? *
                </Label>
                <RadioGroup
                  value={formData.hasPlungers}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, hasPlungers: value }))}
                  className="flex gap-4"
                >
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.hasPlungers === "yes" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="yes" />
                    <span>Yes</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.hasPlungers === "no" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="no" />
                    <span>No</span>
                  </label>
                </RadioGroup>
                {errors.hasPlungers && (
                  <p className="text-xs text-destructive">{errors.hasPlungers}</p>
                )}
              </div>

              {/* Smart Lock */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-primary" />
                  Do you have a smart lock installed? *
                </Label>
                <RadioGroup
                  value={formData.hasSmartLock}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, hasSmartLock: value }))}
                  className="grid sm:grid-cols-3 gap-3"
                >
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer",
                    formData.hasSmartLock === "yes" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="yes" />
                    <span className="text-sm">Yes, already installed</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer",
                    formData.hasSmartLock === "will_buy" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="will_buy" />
                    <span className="text-sm">Will purchase & install</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer",
                    formData.hasSmartLock === "need_install" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="need_install" />
                    <span className="text-sm">Need PeachHaus to install</span>
                  </label>
                </RadioGroup>
                {errors.hasSmartLock && (
                  <p className="text-xs text-destructive">{errors.hasSmartLock}</p>
                )}
                
                {(formData.hasSmartLock === "will_buy" || formData.hasSmartLock === "need_install") && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      {formData.hasSmartLock === "need_install" ? (
                        <>
                          <p className="text-sm text-blue-800 mb-2">
                            <strong>✓ We'll buy and install your smart lock!</strong>
                          </p>
                          <p className="text-xs text-blue-700 mb-3">
                            We use the Yale Security Connected Smart Lock because it integrates directly with our property management system to generate unique access codes automatically for each guest. Not all smart locks support this—we'll bring one that works seamlessly with our system.
                          </p>
                          <Button variant="outline" size="sm" asChild className="bg-white">
                            <a href={SMART_LOCK_URL} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Recommended Lock
                            </a>
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-blue-800 mb-2">
                            <strong>Important:</strong> Not all smart locks are compatible with our system.
                          </p>
                          <p className="text-xs text-blue-700 mb-3">
                            We need a lock that connects with our property management system to automatically generate unique access codes for each guest. We recommend the Yale Security Connected Smart Lock for reliable, automated guest access.
                          </p>
                          <Button variant="outline" size="sm" asChild className="bg-white">
                            <a href={SMART_LOCK_URL} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Recommended Lock on Amazon
                            </a>
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* WiFi */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-500" />
                  Is the WiFi set up and working at the property? *
                </Label>
                <RadioGroup
                  value={formData.wifiWorking}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, wifiWorking: value }))}
                  className="flex gap-4"
                >
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.wifiWorking === "yes" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="yes" />
                    <span>Yes, working</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer",
                    formData.wifiWorking === "no" ? "border-primary bg-primary/5" : "border-muted"
                  )}>
                    <RadioGroupItem value="no" />
                    <span>Not yet / Not sure</span>
                  </label>
                </RadioGroup>
                {errors.wifiWorking && (
                  <p className="text-xs text-destructive">{errors.wifiWorking}</p>
                )}
                {formData.wifiWorking === "no" && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ Please ensure WiFi is set up before the inspection. Smart lock configuration requires an active internet connection.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Select Date & Time */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Choose Your Inspection Date</h1>
              <p className="text-muted-foreground">
                Inspections are available Tuesday - Thursday, 11 AM - 3 PM EST.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Calendar */}
              <Card>
                <CardContent className="pt-6">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setSelectedTime(null);
                    }}
                    disabled={isDateDisabled}
                    className="rounded-md border pointer-events-auto"
                    fromDate={new Date()}
                  />
                </CardContent>
              </Card>

              {/* Time Slots */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {selectedDate 
                      ? `Available times for ${format(selectedDate, "MMM d")}`
                      : "Select a date first"
                    }
                  </h3>
                  
                  {selectedDate ? (
                    <ScrollArea className="h-[280px]">
                      <div className="grid grid-cols-2 gap-2 pr-4">
                        {availableTimeSlots.length > 0 ? (
                          availableTimeSlots.map((time) => (
                            <Button
                              key={time}
                              variant={selectedTime === time ? "default" : "outline"}
                              className="justify-center"
                              onClick={() => setSelectedTime(time)}
                            >
                              {format(setHours(setMinutes(new Date(), parseInt(time.split(":")[1])), parseInt(time.split(":")[0])), "h:mm a")}
                            </Button>
                          ))
                        ) : (
                          <p className="col-span-2 text-sm text-muted-foreground text-center py-8">
                            No available times for this date. Please select another date.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                      <Calendar className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!selectedDate || !selectedTime}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Confirm */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Review & Confirm</h1>
              <p className="text-muted-foreground">
                Please review your inspection details before confirming.
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contact</div>
                    <div className="font-medium">{formData.name}</div>
                    <div className="text-sm text-muted-foreground">{formData.email}</div>
                    <div className="text-sm text-muted-foreground">{formData.phone}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Property</div>
                    <div className="font-medium">{formData.propertyAddress}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {formData.inspectionType === "in_person" ? "In-Person" : "Virtual"} Inspection
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date & Time</div>
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {selectedTime && format(setHours(setMinutes(new Date(), parseInt(selectedTime.split(":")[1])), parseInt(selectedTime.split(":")[0])), "h:mm a")} EST
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Safety Checklist</div>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {formData.hasFireExtinguisher === "yes" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      Fire Extinguisher
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.hasFireBlanket === "yes" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      Fire Blanket
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Stove:</span>
                      <span className="capitalize">{formData.stoveType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.hasPlungers === "yes" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-muted" />
                      )}
                      Plunger in Bathrooms
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <span className="text-muted-foreground">Smart Lock:</span>
                      <span>
                        {formData.hasSmartLock === "yes" && "Already installed"}
                        {formData.hasSmartLock === "will_buy" && "Will purchase & install"}
                        {formData.hasSmartLock === "need_install" && "PeachHaus will install (free)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions or things we should know..."
                    value={formData.additionalNotes}
                    onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                className="min-w-[180px]"
              >
                {bookMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Confirming...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm Inspection
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} PeachHaus Group LLC · Atlanta, GA
        </div>
      </footer>
    </div>
  );
}
