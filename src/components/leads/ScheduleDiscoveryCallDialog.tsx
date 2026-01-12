import { useState } from "react";
import { Calendar, Clock, Phone, Video, HelpCircle, Check, Home, Briefcase, Building, Target, Link } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
const CALL_DURATION = 30; // 30 minute discovery calls

// Generate time slots from 9 AM to 5 PM in 30-minute increments
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
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

const RENTAL_STRATEGIES = [
  { value: "str", label: "Short-Term Rental (STR)", description: "Nightly stays on Airbnb, VRBO", icon: Home },
  { value: "mtr", label: "Mid-Term Rental (MTR)", description: "30+ day furnished stays", icon: Briefcase },
  { value: "ltr", label: "Long-Term Rental (LTR)", description: "Traditional 12-month leases", icon: Building },
  { value: "not_sure", label: "Not sure yet", description: "Let's discuss options", icon: Target },
];

const CURRENT_SITUATIONS = [
  { value: "self_managing", label: "Currently self-managing" },
  { value: "existing_pm", label: "Have a PM but looking to switch" },
  { value: "new_property", label: "New property - not listed yet" },
  { value: "exploring", label: "Just exploring options" },
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
  const [rentalStrategy, setRentalStrategy] = useState<string>("");
  const [currentSituation, setCurrentSituation] = useState<string>("");
  const [existingListingUrl, setExistingListingUrl] = useState<string>("");
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
        duration_minutes: CALL_DURATION,
        meeting_notes: notes || null,
        meeting_type: meetingType,
        rental_strategy: rentalStrategy || null,
        current_situation: currentSituation || null,
        existing_listing_url: existingListingUrl || null,
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
            duration: 30,
            meeting_type: meetingType,
            rental_strategy: rentalStrategy,
            current_situation: currentSituation,
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

      // Auto-schedule Recall.ai bot for video meetings to capture transcript
      if (meetingType === "video") {
        try {
          const { data: botResult, error: botError } = await supabase.functions.invoke("recall-auto-schedule-bot", {
            body: { discoveryCallId: newCall.id },
          });
          if (botError) {
            console.warn("Recall bot scheduling failed:", botError);
          } else {
            console.log("Recall bot scheduled:", botResult);
          }
        } catch (recallError) {
          console.warn("Recall bot scheduling failed:", recallError);
        }
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
    setRentalStrategy("");
    setCurrentSituation("");
    setExistingListingUrl("");
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
            <Badge className="ml-auto">30 min</Badge>
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

          {/* Rental Strategy */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              What type of rental?
            </Label>
            <RadioGroup
              value={rentalStrategy}
              onValueChange={setRentalStrategy}
              className="grid grid-cols-2 gap-2"
            >
              {RENTAL_STRATEGIES.map(strategy => (
                <Label
                  key={strategy.value}
                  htmlFor={`strategy-${strategy.value}`}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                    rentalStrategy === strategy.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <RadioGroupItem value={strategy.value} id={`strategy-${strategy.value}`} />
                  <strategy.icon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{strategy.label}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>
          
          {/* Current Situation */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current situation</Label>
            <Select value={currentSituation} onValueChange={setCurrentSituation}>
              <SelectTrigger>
                <SelectValue placeholder="Select current situation" />
              </SelectTrigger>
              <SelectContent>
                {CURRENT_SITUATIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Existing Listing URL - show for STR/MTR */}
          {(rentalStrategy === "str" || rentalStrategy === "mtr") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Link className="h-4 w-4" />
                Existing Airbnb/VRBO listing (optional)
              </Label>
              <Input
                placeholder="https://airbnb.com/rooms/..."
                value={existingListingUrl}
                onChange={(e) => setExistingListingUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Share the listing so we can prepare insights</p>
            </div>
          )}

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
