import { useState } from "react";
import { Calendar, Clock, Phone, Video, MapPin, HelpCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes } from "date-fns";

interface ScheduleDiscoveryCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string;
  onScheduled?: () => void;
}

const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

// Generate time slots from 9 AM to 5 PM in 15-minute increments
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      slots.push(time);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const START_TIMELINE_OPTIONS = [
  { value: "immediately", label: "Immediately - ready to start" },
  { value: "1_2_weeks", label: "1-2 weeks" },
  { value: "1_month", label: "Within a month" },
  { value: "2_3_months", label: "2-3 months" },
  { value: "just_exploring", label: "Just exploring options" },
];

export function ScheduleDiscoveryCallDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
  onScheduled,
}: ScheduleDiscoveryCallDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<"phone" | "video">("phone");
  const [serviceInterest, setServiceInterest] = useState<string>("");
  const [startTimeline, setStartTimeline] = useState<string>("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch existing scheduled calls to block those times
  const { data: existingCalls = [] } = useQuery({
    queryKey: ["discovery-calls-scheduled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discovery_calls")
        .select("scheduled_at, duration_minutes")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString());
      return data || [];
    },
    enabled: open,
  });

  // Check if a time slot is already booked
  const isTimeSlotBooked = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, 15);

    return existingCalls.some((call) => {
      const callStart = new Date(call.scheduled_at);
      const callEnd = addMinutes(callStart, call.duration_minutes || 15);
      return (
        (slotStart >= callStart && slotStart < callEnd) ||
        (slotEnd > callStart && slotEnd <= callEnd)
      );
    });
  };

  // Check if time slot is in the past
  const isTimeSlotPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    return isBefore(slotTime, new Date());
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error("Please log in to schedule a call");
      }

      // Insert discovery call with new fields
      const { data: newCall, error } = await supabase.from("discovery_calls").insert({
        lead_id: leadId,
        scheduled_by: user.user?.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 15,
        meeting_notes: notes || null,
        meeting_type: meetingType,
        service_interest: serviceInterest || null,
        start_timeline: startTimeline || null,
        google_meet_link: meetingType === "video" ? GOOGLE_MEET_LINK : null,
      }).select().single();

      if (error) throw error;

      // Timeline entry is non-critical
      try {
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "discovery_call_scheduled",
          metadata: {
            scheduled_at: scheduledAt.toISOString(),
            duration: 15,
            meeting_type: meetingType,
            service_interest: serviceInterest,
          },
        });
      } catch (timelineError) {
        console.warn("Timeline entry failed but booking succeeded:", timelineError);
      }

      // Send confirmation email and admin notification
      try {
        await supabase.functions.invoke("discovery-call-notifications", {
          body: { discoveryCallId: newCall.id, notificationType: "confirmation" },
        });
        await supabase.functions.invoke("discovery-call-notifications", {
          body: { discoveryCallId: newCall.id, notificationType: "admin_notification" },
        });
      } catch (notifError) {
        console.warn("Notification sending failed:", notifError);
      }

      return { scheduledAt, meetingType };
    },
    onSuccess: ({ scheduledAt, meetingType }) => {
      const meetingInfo = meetingType === "video" 
        ? ` (Video call: ${GOOGLE_MEET_LINK})` 
        : " (Phone call)";
      toast.success(`Discovery call scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}${meetingInfo}`);
      queryClient.invalidateQueries({ queryKey: ["discovery-calls"] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline"] });
      onScheduled?.();
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Calendar booking final error:", error);
      toast.error(`Failed to book: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedDate(undefined);
    setSelectedTime(null);
    setMeetingType("phone");
    setServiceInterest("");
    setStartTimeline("");
    setNotes("");
  };

  const availableTimeSlots = selectedDate
    ? TIME_SLOTS.filter(
        (time) =>
          !isTimeSlotBooked(selectedDate, time) &&
          !isTimeSlotPast(selectedDate, time)
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Discovery Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Lead info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="p-2 rounded-full bg-primary/10">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">{leadName}</p>
              {leadPhone && (
                <p className="text-sm text-muted-foreground">{leadPhone}</p>
              )}
            </div>
            <Badge className="ml-auto">15 min</Badge>
          </div>

          {/* Meeting Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Meeting Type</Label>
            <RadioGroup
              value={meetingType}
              onValueChange={(value) => setMeetingType(value as "phone" | "video")}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="phone"
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  meetingType === "phone"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="phone" id="phone" />
                <Phone className="h-5 w-5" />
                <div>
                  <p className="font-medium">Phone Call</p>
                  <p className="text-xs text-muted-foreground">We'll call you</p>
                </div>
              </Label>
              <Label
                htmlFor="video"
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  meetingType === "video"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="video" id="video" />
                <Video className="h-5 w-5" />
                <div>
                  <p className="font-medium">Video Call</p>
                  <p className="text-xs text-muted-foreground">Google Meet</p>
                </div>
              </Label>
            </RadioGroup>
            {meetingType === "video" && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video calls allow for a better property presentation with screen sharing!
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Meeting link: {GOOGLE_MEET_LINK}
                </p>
              </div>
            )}
          </div>

          {/* Service Interest */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              What are you looking for?
            </Label>
            <RadioGroup
              value={serviceInterest}
              onValueChange={setServiceInterest}
              className="space-y-2"
            >
              <Label
                htmlFor="property_management"
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  serviceInterest === "property_management"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="property_management" id="property_management" />
                <div>
                  <p className="font-medium">Full Property Management</p>
                  <p className="text-xs text-muted-foreground">Complete hands-off management of your property</p>
                </div>
              </Label>
              <Label
                htmlFor="cohosting"
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  serviceInterest === "cohosting"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="cohosting" id="cohosting" />
                <div>
                  <p className="font-medium">Co-hosting Partnership</p>
                  <p className="text-xs text-muted-foreground">We handle guests while you stay involved</p>
                </div>
              </Label>
              <Label
                htmlFor="undecided"
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  serviceInterest === "undecided"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value="undecided" id="undecided" />
                <div>
                  <p className="font-medium">Not sure yet</p>
                  <p className="text-xs text-muted-foreground">Let's discuss what's best for you</p>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* Start Timeline */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              When are you looking to get started?
            </Label>
            <Select value={startTimeline} onValueChange={setStartTimeline}>
              <SelectTrigger>
                <SelectValue placeholder="Select a timeline" />
              </SelectTrigger>
              <SelectContent>
                {START_TIMELINE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calendar */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select a Date</Label>
            <div className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => isBefore(date, addDays(new Date(), -1)) || date.getDay() === 0 || date.getDay() === 6}
                className="rounded-md border"
              />
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Available Times for {format(selectedDate, "MMM d, yyyy")}
              </label>
              {availableTimeSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available slots for this date
                </p>
              ) : (
                <ScrollArea className="h-32">
                  <div className="grid grid-cols-4 gap-2">
                    {availableTimeSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                        className="text-xs"
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

          {/* Notes */}
          {selectedTime && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Any specific questions or topics you'd like to discuss..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={!selectedDate || !selectedTime || scheduleMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Call"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
