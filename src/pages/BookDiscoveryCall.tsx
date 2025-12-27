import { useState, useEffect } from "react";
import { Calendar, Clock, User, Mail, Phone, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes, getDay } from "date-fns";
import { cn } from "@/lib/utils";

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

export default function BookDiscoveryCall() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
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
    const isAvailable = availableDays.includes(dayOfWeek);
    return isPast || isBlocked || !isAvailable;
  };

  // Get time slots for selected date
  const getTimeSlotsForDate = (date: Date) => {
    const dayOfWeek = getDay(date);
    const slot = availabilitySlots.find((s) => s.day_of_week === dayOfWeek);
    if (!slot) return [];

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

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      // Create a lead and discovery call
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          stage: "call_scheduled" as const,
          opportunity_source: "website_booking",
        }])
        .select()
        .single();

      if (leadError) throw leadError;

      const { error: callError } = await supabase.from("discovery_calls").insert({
        lead_id: lead.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 15,
        status: "scheduled",
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

  if (isBooked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-4">
              Your discovery call is scheduled for{" "}
              <strong>
                {selectedDate && format(selectedDate, "MMMM d, yyyy")} at{" "}
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
            <p className="text-sm text-muted-foreground">
              We'll send a confirmation email to {formData.email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Calendar className="h-6 w-6 text-primary" />
            Book a Discovery Call
          </CardTitle>
          <CardDescription>
            Schedule a free 15-minute call to discuss your property management needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step >= s ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-center mb-4">Select a Date</h3>
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
              <Button
                className="w-full"
                disabled={!selectedDate}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && selectedDate && (
            <div className="space-y-4">
              <h3 className="font-medium text-center mb-4">
                Select a Time for {format(selectedDate, "MMMM d")}
              </h3>
              {availableTimeSlots.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No available slots for this date. Please select another day.
                </p>
              ) : (
                <ScrollArea className="h-48">
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
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedTime}
                  onClick={() => setStep(3)}
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium text-center mb-4">Your Information</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Your Appointment:</p>
                <p className="text-muted-foreground">
                  {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")} at{" "}
                  {selectedTime &&
                    format(
                      setMinutes(
                        setHours(new Date(), parseInt(selectedTime.split(":")[0])),
                        parseInt(selectedTime.split(":")[1])
                      ),
                      "h:mm a"
                    )}{" "}
                  (15 min)
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    !formData.name ||
                    !formData.email ||
                    !formData.phone ||
                    bookMutation.isPending
                  }
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
