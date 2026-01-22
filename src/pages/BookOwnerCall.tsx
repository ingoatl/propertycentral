import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, User, Mail, Phone, MessageSquare, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfDay, parseISO, addMinutes } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

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

export default function BookOwnerCall() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    topic: "",
    topicDetails: "",
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Pre-fill from URL params (magic link support)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const name = params.get("name");
    const phone = params.get("phone");
    
    if (email || name || phone) {
      setFormData(prev => ({
        ...prev,
        email: email || prev.email,
        name: name || prev.name,
        phone: phone || prev.phone,
      }));
    }
  }, []);

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
    // Owner calls: Mon-Fri only
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-background to-purple-50/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Call Scheduled!</h2>
            <p className="text-muted-foreground mb-4">
              Your owner call has been booked. You'll receive a confirmation email shortly with the meeting details.
            </p>
            {selectedTime && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="font-medium">{formatInTimeZone(parseISO(selectedTime), EST_TIMEZONE, "EEEE, MMMM d, yyyy")}</p>
                <p className="text-muted-foreground">{formatTimeSlot(selectedTime)} EST</p>
                <p className="text-muted-foreground mt-2">Topic: {CALL_TOPICS.find(t => t.value === formData.topic)?.label}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-background to-purple-50/30">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">PeachHaus Owner Call</h1>
              <p className="text-sm text-muted-foreground">Schedule a call with your property manager</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-600' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-purple-600 text-white' : 'bg-muted'}`}>
              {step > 1 ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <span className="text-sm font-medium hidden sm:inline">Your Info</span>
          </div>
          <div className="w-12 h-px bg-border" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-purple-600' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-purple-600 text-white' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Schedule</span>
          </div>
        </div>

        {/* Step 1: Contact Info & Topic */}
        {step === 1 && (
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>Tell us about yourself and what you'd like to discuss</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(404) 555-1234"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topic">What would you like to discuss? *</Label>
                <Select value={formData.topic} onValueChange={(value) => setFormData(prev => ({ ...prev, topic: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_TOPICS.map((topic) => (
                      <SelectItem key={topic.value} value={topic.value}>
                        {topic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.topic && (
                <div className="space-y-2">
                  <Label htmlFor="topicDetails">
                    <MessageSquare className="inline h-4 w-4 mr-1" />
                    {formData.topic === "other" ? "Please describe your topic *" : "Any additional details? (optional)"}
                  </Label>
                  <Textarea
                    id="topicDetails"
                    placeholder="Tell us more so we can prepare..."
                    value={formData.topicDetails}
                    onChange={(e) => setFormData(prev => ({ ...prev, topicDetails: e.target.value }))}
                    rows={3}
                  />
                </div>
              )}

              <Button 
                onClick={() => setStep(2)} 
                disabled={!isStep1Valid || (formData.topic === "other" && !formData.topicDetails)}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Continue to Scheduling
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Calendar */}
        {step === 2 && (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Calendar */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Select a Date</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium w-32 text-center">
                      {format(currentMonth, "MMMM yyyy")}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays().map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="h-10" />;
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
                          h-10 rounded-lg text-sm font-medium transition-colors
                          ${!available ? 'text-muted-foreground/40 cursor-not-allowed' : 'hover:bg-purple-100'}
                          ${selected ? 'bg-purple-600 text-white hover:bg-purple-700' : ''}
                          ${today && !selected ? 'ring-1 ring-purple-400' : ''}
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a date first"}
                </CardTitle>
                <CardDescription>All times shown in EST</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedDate ? (
                  <p className="text-muted-foreground text-center py-8">
                    Please select a date to see available times
                  </p>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No available times for this date. Please try another day.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-colors
                          ${selectedTime === slot 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-muted hover:bg-purple-100'}
                        `}
                      >
                        {formatTimeSlot(slot)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {selectedTime && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-sm font-medium text-purple-900">Your Selection:</p>
                    <p className="text-sm text-purple-700">
                      {formatInTimeZone(parseISO(selectedTime), EST_TIMEZONE, "EEEE, MMMM d 'at' h:mm a")} EST
                    </p>
                    <p className="text-xs text-purple-600 mt-1">30-minute call</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="md:col-span-2 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!isStep2Valid || isSubmitting}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirm Booking
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
