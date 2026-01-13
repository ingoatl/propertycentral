import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO, isSameDay } from "date-fns";
import { Calendar, Clock, Video, Phone, CheckCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallData {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingType: string;
  firstName: string;
}

export default function RescheduleCall() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [callData, setCallData] = useState<CallData | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (callId) {
      fetchCallData();
    }
  }, [callId]);

  const fetchCallData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke(
        "get-discovery-call-public",
        { body: { callId } }
      );

      if (fetchError) throw fetchError;

      if (data.error) {
        setError(data.error);
        return;
      }

      if (!data.canReschedule) {
        setError(data.error || "This call cannot be rescheduled");
        return;
      }

      setCallData(data.call);
      setAvailableSlots(data.availableSlots);
    } catch (err: any) {
      console.error("Error fetching call data:", err);
      setError("Failed to load appointment details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot || !callId) return;

    try {
      setSubmitting(true);

      const { data, error: rescheduleError } = await supabase.functions.invoke(
        "reschedule-discovery-call",
        { body: { callId, newScheduledAt: selectedSlot } }
      );

      if (rescheduleError) throw rescheduleError;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setSuccess(true);
      toast.success("Your call has been rescheduled successfully!");
    } catch (err: any) {
      console.error("Error rescheduling:", err);
      toast.error("Failed to reschedule. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Get unique dates from available slots
  const availableDates = [...new Set(
    availableSlots.map(slot => format(parseISO(slot), "yyyy-MM-dd"))
  )];

  // Get slots for selected date
  const slotsForSelectedDate = selectedDate
    ? availableSlots.filter(slot => isSameDay(parseISO(slot), selectedDate))
    : [];

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return availableDates.includes(dateStr);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading appointment details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Reschedule</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Successfully Rescheduled!</h2>
            <p className="text-muted-foreground mb-4">
              Your call has been rescheduled to:
            </p>
            <div className="bg-primary/10 rounded-lg p-4 mb-6">
              <p className="text-lg font-medium text-primary">
                {selectedSlot && format(parseISO(selectedSlot), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-primary">
                {selectedSlot && format(parseISO(selectedSlot), "h:mm a")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              You'll receive a confirmation email shortly with the updated details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Reschedule Your Call
          </h1>
          <p className="text-muted-foreground mt-2">
            Hi {callData?.firstName}, select a new time that works better for you
          </p>
        </div>

        {/* Current Appointment */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Current Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {callData?.meetingType === "video" ? (
                  <Video className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Phone className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm capitalize">{callData?.meetingType || "Video"} Call</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">
                  {callData?.scheduledAt && format(parseISO(callData.scheduledAt), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">
                  {callData?.scheduledAt && format(parseISO(callData.scheduledAt), "h:mm a")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date & Time Selection */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Calendar */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Select a Date</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    {format(currentMonth, "MMMM yyyy")}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {generateCalendarDays().map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }
                  
                  const isAvailable = isDateAvailable(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => isAvailable && !isPast && setSelectedDate(day)}
                      disabled={!isAvailable || isPast}
                      className={`
                        aspect-square rounded-lg text-sm font-medium transition-colors
                        ${isSelected 
                          ? "bg-primary text-primary-foreground" 
                          : isAvailable && !isPast
                            ? "hover:bg-primary/10 text-foreground"
                            : "text-muted-foreground/40 cursor-not-allowed"
                        }
                      `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {selectedDate 
                  ? `Available Times for ${format(selectedDate, "MMM d")}`
                  : "Select a Time"
                }
              </CardTitle>
              <CardDescription>
                {selectedDate 
                  ? `${slotsForSelectedDate.length} time slots available`
                  : "Choose a date first to see available times"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-3 opacity-50" />
                  <p>Select a date to view available times</p>
                </div>
              ) : slotsForSelectedDate.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
                  <p>No available times on this date</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                  {slotsForSelectedDate.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        p-3 rounded-lg border text-sm font-medium transition-colors
                        ${selectedSlot === slot
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary hover:bg-primary/5"
                        }
                      `}
                    >
                      {format(parseISO(slot), "h:mm a")}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Confirm Button */}
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={handleReschedule}
            disabled={!selectedSlot || submitting}
            className="min-w-[200px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              "Confirm New Time"
            )}
          </Button>
        </div>

        {/* Selected summary */}
        {selectedSlot && (
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              New appointment:{" "}
              <span className="font-medium text-foreground">
                {format(parseISO(selectedSlot), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
