import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes, getDay, getMonth, getDate, getYear } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { Calendar as CalendarIcon, Clock, Check, Loader2, ArrowRight, ArrowLeft, Phone, Video, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import anjaSignature from "@/assets/anja-signature.png";
import anjaIngoHosts from "@/assets/anja-ingo-hosts.jpg";

// US General Holidays
const isUSHoliday = (date: Date): boolean => {
  const month = getMonth(date);
  const day = getDate(date);
  const year = getYear(date);
  
  if (month === 0 && day === 1) return true; // New Year's
  if (month === 6 && day === 4) return true; // Independence Day
  if (month === 10 && day === 11) return true; // Veterans Day
  if (month === 11 && day === 25) return true; // Christmas
  
  const dayOfWeek = getDay(date);
  
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

// Generate 30-minute time slots for EST business hours (11 AM - 4 PM)
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

export default function RequestReschedule() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callId = searchParams.get("id");
  const token = searchParams.get("token");
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<"info" | "calendar" | "confirm" | "success">("info");

  // Fetch discovery call details
  const { data: callData, isLoading: loadingCall, error: callError } = useQuery({
    queryKey: ["public-reschedule-call", callId],
    queryFn: async () => {
      if (!callId) throw new Error("No call ID provided");
      
      const { data, error } = await supabase.functions.invoke("get-discovery-call-public", {
        body: { callId, token },
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!callId,
  });

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

  // Fetch existing calls for conflict checking
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
    const isHoliday = isUSHoliday(date);
    return isPast || isBlocked || !isAvailable || isHoliday;
  };

  const getTimeSlotsForDate = (date: Date) => {
    const dayOfWeek = getDay(date);
    const slot = availabilitySlots.find(s => s.day_of_week === dayOfWeek);
    if (!slot) return generateTimeSlots(11, 16); // Default: 11 AM - 4 PM EST
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

  // Submit reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime || !callId) {
        throw new Error("Please select a date and time");
      }

      const [hours, minutes] = selectedTime.split(":").map(Number);
      
      // Build a date string representing the selected EST time
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const hourStr = String(hours).padStart(2, '0');
      const minStr = String(minutes).padStart(2, '0');
      
      // This represents the time as selected in EST
      const estTimeString = `${year}-${month}-${day} ${hourStr}:${minStr}:00`;
      
      // Use date-fns-tz to correctly convert EST time to UTC
      const newScheduledAt = fromZonedTime(estTimeString, 'America/New_York');

      const { data, error } = await supabase.functions.invoke("reschedule-discovery-call", {
        body: {
          callId,
          token,
          newScheduledAt: newScheduledAt.toISOString(),
          rescheduledByType: "client",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      setStep("success");
      toast.success("Your call has been rescheduled!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (loadingCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (callError || !callData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Unable to Load Appointment</h2>
            <p className="text-muted-foreground">
              This reschedule link may have expired or the appointment has already been changed. 
              Please contact us directly to reschedule.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSchedule = new Date(callData.scheduled_at);

  // Success screen
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center shadow-xl border-amber-200">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Successfully Rescheduled!</h2>
            <p className="text-muted-foreground mb-6">
              Your call has been moved to{" "}
              <strong className="text-foreground">
                {selectedDate && selectedTime && format(
                  setMinutes(setHours(selectedDate, parseInt(selectedTime.split(":")[0])), parseInt(selectedTime.split(":")[1])),
                  "EEEE, MMMM d 'at' h:mm a"
                )} EST
              </strong>
            </p>
            
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-6">
              <p className="text-sm text-amber-800">
                You'll receive a confirmation email shortly with updated calendar details.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4">
              <img
                src={anjaIngoHosts}
                alt="Your Hosts"
                className="h-12 w-12 rounded-full object-cover border-2 border-white shadow"
              />
              <div className="text-left">
                <p className="text-sm font-medium">Looking forward to speaking with you!</p>
                <p className="text-xs text-muted-foreground">— The PeachHaus Team</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <img 
              src="/images/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">Reschedule Your Call</h1>
              <p className="text-sm text-muted-foreground">Find a time that works better for you</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Step: Info - Explain why we're rescheduling */}
        {step === "info" && (
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="shadow-lg border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <CalendarIcon className="h-5 w-5" />
                  Need to Find a Better Time?
                </CardTitle>
                <CardDescription>
                  We completely understand that schedules change. Let's find a time that works perfectly for both of us.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Your Current Appointment</p>
                  <p className="font-semibold text-lg">{format(currentSchedule, "EEEE, MMMM d, yyyy")}</p>
                  <p className="text-amber-700 font-medium">{format(currentSchedule, "h:mm a")} EST</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {callData.meeting_type === "video" ? (
                      <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Video Call</span>
                    ) : (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone Call</span>
                    )}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-800 mb-2">Why Reschedule?</h4>
                  <p className="text-sm text-amber-900">
                    Life happens! Whether it's a work conflict, travel plans, or just needing a bit more 
                    flexibility, we're happy to find a new time. Our goal is to have a productive 
                    conversation when you're ready and focused.
                  </p>
                </div>

                <Button 
                  onClick={() => setStep("calendar")} 
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  size="lg"
                >
                  Choose New Time <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6 border">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <img src={anjaIngoHosts} alt="Hosts" className="h-10 w-10 rounded-full object-cover" />
                  A Note From Your Hosts
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We know your time is valuable, and we want our conversation to be as helpful as possible. 
                  Please pick a time when you can be present and ready to discuss your property goals.
                </p>
                <img 
                  src={anjaSignature}
                  alt="Anja's Signature" 
                  className="h-12 opacity-80"
                />
              </div>

              <div className="bg-white rounded-lg shadow p-6 border">
                <h4 className="font-medium mb-3">What to Expect</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5" />
                    30-minute discovery call
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5" />
                    Discussion of your property and goals
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5" />
                    Personalized revenue projections
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-600 mt-0.5" />
                    No obligation, just helpful advice
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Step: Calendar - Select new date/time */}
        {step === "calendar" && (
          <Card className="shadow-lg max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Select a New Time</CardTitle>
                  <CardDescription>All times shown in Eastern Time (EST/EDT)</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep("info")}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Calendar */}
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }}
                  disabled={isDateDisabled}
                  className={cn("rounded-md border pointer-events-auto")}
                  fromDate={new Date()}
                  toDate={addDays(new Date(), 60)}
                />
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div className="space-y-3">
                  <h4 className="font-medium text-center">
                    Available times for {format(selectedDate, "MMMM d")}
                  </h4>
                  
                  {availableTimeSlots.length === 0 ? (
                    <div className="text-center py-6 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">No available times for this date.</p>
                      <p className="text-sm text-muted-foreground mt-1">Please select another date.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-36">
                      <div className="grid grid-cols-4 gap-2 px-1">
                        {availableTimeSlots.map(time => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              selectedTime === time && "bg-amber-600 hover:bg-amber-700"
                            )}
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
                </div>
              )}

              {/* Summary & Confirm */}
              {selectedDate && selectedTime && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">New Appointment</h4>
                    <p className="text-green-900 font-semibold">
                      {format(selectedDate, "EEEE, MMMM d, yyyy")} at{" "}
                      {format(
                        setMinutes(setHours(new Date(), parseInt(selectedTime.split(":")[0])), parseInt(selectedTime.split(":")[1])),
                        "h:mm a"
                      )} EST
                    </p>
                  </div>

                  <Button 
                    onClick={() => rescheduleMutation.mutate()}
                    disabled={rescheduleMutation.isPending}
                    className="w-full bg-amber-600 hover:bg-amber-700"
                    size="lg"
                  >
                    {rescheduleMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Rescheduling...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Confirm New Time
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
