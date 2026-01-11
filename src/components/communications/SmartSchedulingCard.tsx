import { useState, useMemo } from "react";
import { Calendar, Clock, Send, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, isAfter, startOfDay, parseISO } from "date-fns";

interface SmartSchedulingCardProps {
  detectedIntent: "tomorrow" | "this_week" | "call_request" | "schedule" | null;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  contactId?: string;
  contactType: string;
  leadId?: string;
  onDismiss: () => void;
  onScheduled?: () => void;
}

interface TimeSlot {
  time: string;
  display: string;
  available: boolean;
}

export function SmartSchedulingCard({
  detectedIntent,
  contactName,
  contactPhone,
  contactEmail,
  contactId,
  contactType,
  leadId,
  onDismiss,
  onScheduled,
}: SmartSchedulingCardProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Generate available dates based on intent
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    
    if (detectedIntent === "tomorrow") {
      dates.push(addDays(today, 1));
    } else {
      // Show next 5 business days
      let count = 0;
      let dayOffset = 1;
      while (count < 5) {
        const date = addDays(today, dayOffset);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
          dates.push(date);
          count++;
        }
        dayOffset++;
      }
    }
    
    return dates;
  }, [detectedIntent]);

  // Generate time slots for selected date
  const timeSlots = useMemo((): TimeSlot[] => {
    if (!selectedDate) return [];
    
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = startOfDay(selectedDate).getTime() === startOfDay(now).getTime();
    
    // Business hours: 9 AM - 5 PM EST
    for (let hour = 9; hour <= 17; hour++) {
      for (const minute of [0, 30]) {
        if (hour === 17 && minute === 30) continue; // Skip 5:30 PM
        
        const slotTime = setMinutes(setHours(selectedDate, hour), minute);
        const timeStr = format(slotTime, "HH:mm");
        const displayStr = format(slotTime, "h:mm a");
        
        // Check if slot is in the past for today
        const available = !isToday || isAfter(slotTime, now);
        
        slots.push({
          time: timeStr,
          display: displayStr,
          available,
        });
      }
    }
    
    return slots;
  }, [selectedDate]);

  const handleScheduleCall = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    setIsScheduling(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      // Create discovery call
      const { data: call, error: callError } = await supabase
        .from("discovery_calls")
        .insert({
          lead_id: leadId || contactId,
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
          meeting_type: "video",
          duration_minutes: 30,
        })
        .select()
        .single();

      if (callError) throw callError;

      // Try to sync to Google Calendar
      try {
        const { error: calError } = await supabase.functions.invoke("sync-discovery-call-to-calendar", {
          body: { discoveryCallId: call.id },
        });
        if (calError) {
          console.error("Calendar sync failed:", calError);
          // Don't throw - call is still scheduled
        }
      } catch (calSyncErr) {
        console.error("Calendar sync error:", calSyncErr);
      }

      // Send SMS invite to the contact
      if (contactPhone) {
        try {
          const userName = await getCurrentUserName();
          const formattedDate = format(scheduledAt, "EEEE, MMM d");
          const formattedTime = format(scheduledAt, "h:mm a");
          const message = `Hi ${contactName?.split(" ")[0] || "there"}! I've scheduled our call for ${formattedDate} at ${formattedTime}. Looking forward to chatting! - ${userName} @ PeachHaus Group`;
          
          await supabase.functions.invoke("ghl-send-sms", {
            body: {
              leadId: leadId || (contactType === "lead" ? contactId : undefined),
              phone: contactPhone,
              message,
            },
          });
        } catch (smsErr) {
          console.error("SMS invite failed:", smsErr);
        }
      }

      toast.success("Call scheduled successfully!");
      onScheduled?.();
      onDismiss();
    } catch (error: any) {
      console.error("Error scheduling call:", error);
      toast.error(`Failed to schedule: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSendInviteLink = async () => {
    if (!contactPhone) {
      toast.error("No phone number available to send invite");
      return;
    }

    setIsSendingInvite(true);
    try {
      const message = `Hi ${contactName?.split(" ")[0] || "there"}! Here's our calendar to pick a time that works for you: https://propertycentral.lovable.app/book-discovery-call - ${await getCurrentUserName()} @ PeachHaus Group`;

      const { error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          leadId: leadId || (contactType === "lead" ? contactId : undefined),
          phone: contactPhone,
          message,
        },
      });

      if (error) throw error;
      toast.success("Calendar invite link sent!");
      onDismiss();
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast.error(`Failed to send: ${error.message}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const getCurrentUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      return profile?.first_name || "PeachHaus";
    }
    return "PeachHaus";
  };

  if (!detectedIntent) return null;

  const intentMessages = {
    tomorrow: "They want to schedule for tomorrow",
    this_week: "They're looking to schedule this week",
    call_request: "They requested a call",
    schedule: "They want to schedule a meeting",
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">
              Schedule a Call
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        <Badge variant="secondary" className="w-fit text-xs">
          {intentMessages[detectedIntent]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Date Selection */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Select a date:</p>
          <div className="flex flex-wrap gap-1.5">
            {availableDates.map((date) => (
              <Button
                key={date.toISOString()}
                variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => {
                  setSelectedDate(date);
                  setSelectedTime(null);
                }}
              >
                {format(date, "EEE, MMM d")}
              </Button>
            ))}
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Select a time:</p>
            <div className="flex flex-wrap gap-1">
              {timeSlots.filter(s => s.available).slice(0, 8).map((slot) => (
                <Button
                  key={slot.time}
                  variant={selectedTime === slot.time ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setSelectedTime(slot.time)}
                >
                  {slot.display}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedDate && selectedTime && (
            <Button
              size="sm"
              onClick={handleScheduleCall}
              disabled={isScheduling}
              className="gap-1.5"
            >
              {isScheduling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Schedule for {format(selectedDate, "MMM d")} at {timeSlots.find(s => s.time === selectedTime)?.display}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendInviteLink}
            disabled={isSendingInvite || !contactPhone}
            className="gap-1.5"
          >
            {isSendingInvite ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Send Calendar Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility function to detect scheduling intent from message
export function detectSchedulingIntent(messages: Array<{ body: string; direction: string; created_at: string }>): "tomorrow" | "this_week" | "call_request" | "schedule" | null {
  // Look at the last few inbound messages
  const recentInbound = messages
    .filter(m => m.direction === "inbound")
    .slice(0, 3);

  if (recentInbound.length === 0) return null;

  const combinedText = recentInbound.map(m => m.body.toLowerCase()).join(" ");

  // Check for "tomorrow" mentions
  if (combinedText.includes("tomorrow") && (
    combinedText.includes("call") || 
    combinedText.includes("talk") || 
    combinedText.includes("meet") ||
    combinedText.includes("available") ||
    combinedText.includes("free") ||
    combinedText.includes("work")
  )) {
    return "tomorrow";
  }

  // Check for this week
  if ((combinedText.includes("this week") || combinedText.includes("next few days")) && (
    combinedText.includes("call") || 
    combinedText.includes("meet") ||
    combinedText.includes("schedule")
  )) {
    return "this_week";
  }

  // Check for call request
  if (
    combinedText.includes("give me a call") ||
    combinedText.includes("can you call") ||
    combinedText.includes("call me") ||
    combinedText.includes("want to talk") ||
    combinedText.includes("would like to talk") ||
    combinedText.includes("need to talk") ||
    combinedText.includes("let's chat") ||
    combinedText.includes("let's talk")
  ) {
    return "call_request";
  }

  // Check for general scheduling
  if (
    combinedText.includes("schedule") ||
    combinedText.includes("set up a time") ||
    combinedText.includes("when can we") ||
    combinedText.includes("when are you") ||
    combinedText.includes("what time")
  ) {
    return "schedule";
  }

  return null;
}
