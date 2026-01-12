import { useState, useMemo } from "react";
import { Calendar, Clock, Send, X, Loader2, Check, Phone, Video, ChevronDown, ChevronUp, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

type MeetingType = "phone" | "video";

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
  const [meetingType, setMeetingType] = useState<MeetingType>("video");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // First name input for calendar invite - extract from contactName if available
  const extractedFirstName = contactName?.split(" ")[0] || "";
  const isPhoneNumber = /^[\d\s\-\(\)\+\.]+$/.test(extractedFirstName);
  const [inviteFirstName, setInviteFirstName] = useState(isPhoneNumber ? "" : extractedFirstName);

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
      const endTime = new Date(scheduledAt.getTime() + 30 * 60 * 1000); // 30 min duration

      // Use first name input, falling back to contact name
      const displayName = inviteFirstName || contactName || "Contact";
      
      // Determine if we have a valid lead ID
      const validLeadId = leadId || (contactType === "lead" ? contactId : null);

      // Fixed Google Meet link
      const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

      let callId: string | null = null;

      // Only create discovery_call if we have a valid lead ID
      if (validLeadId) {
        const { data: call, error: callError } = await supabase
          .from("discovery_calls")
          .insert({
            lead_id: validLeadId,
            scheduled_at: scheduledAt.toISOString(),
            status: "scheduled",
            meeting_type: meetingType,
            duration_minutes: 30,
            google_meet_link: meetingType === "video" ? GOOGLE_MEET_LINK : null,
          })
          .select()
          .single();

        if (callError) {
          console.error("Discovery call creation error:", callError);
          // If lead doesn't exist, continue without creating discovery_call
          if (callError.code !== "23503") {
            throw callError;
          }
        } else {
          callId = call.id;
          
          // Send branded confirmation email and admin notification via discovery-call-notifications
          try {
            // Send confirmation to lead
            await supabase.functions.invoke("discovery-call-notifications", {
              body: {
                discoveryCallId: call.id,
                notificationType: "confirmation",
              },
            });
            
            // Send admin notification
            await supabase.functions.invoke("discovery-call-notifications", {
              body: {
                discoveryCallId: call.id,
                notificationType: "admin_notification",
              },
            });
            
            console.log("Discovery call notifications sent");
          } catch (notifErr) {
            console.error("Failed to send discovery call notifications:", notifErr);
          }
        }
      }

      // Get current user ID for calendar operations
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      if (!currentUserId) {
        throw new Error("You must be logged in to schedule calls");
      }

      // Create calendar event with Google Meet link and send invite to attendee
      try {
        const { data: calResult, error: calError } = await supabase.functions.invoke("google-calendar-sync", {
          body: {
            action: "create-event-direct",
            userId: currentUserId,
            summary: `${meetingType === "video" ? "Video" : "Phone"} Call with ${displayName}`,
            description: `${meetingType === "video" ? "Video" : "Phone"} call with ${displayName}${contactPhone ? `\nPhone: ${contactPhone}` : ""}${contactEmail ? `\nEmail: ${contactEmail}` : ""}${meetingType === "video" ? `\n\n📹 Google Meet: ${GOOGLE_MEET_LINK}` : ""}\n\n⚠️ Please confirm this calendar event by clicking "Yes" in the invitation email you received.\n\nScheduled via PeachHaus CRM`,
            startTime: scheduledAt.toISOString(),
            endTime: endTime.toISOString(),
            attendeeEmail: contactEmail || undefined,
            addConferenceData: false, // Use fixed meet link instead
            meetLink: meetingType === "video" ? GOOGLE_MEET_LINK : undefined,
          },
        });
        
        if (calError) {
          console.error("Calendar event creation failed:", calError);
          toast.error("Calendar event could not be created, but call is scheduled");
        } else {
          console.log("Calendar event created:", calResult);
        }
      } catch (calErr) {
        console.error("Calendar sync error:", calErr);
      }

      // Send SMS invite to the contact with calendar confirmation instruction
      if (contactPhone) {
        try {
          const userName = await getCurrentUserName();
          const formattedDate = format(scheduledAt, "EEEE, MMM d");
          const formattedTime = format(scheduledAt, "h:mm a");
          
          let message = `Hi ${displayName}! I've scheduled our ${meetingType === "video" ? "video" : "phone"} call for ${formattedDate} at ${formattedTime} EST.`;
          
          if (meetingType === "video") {
            message += ` Join here: ${GOOGLE_MEET_LINK}`;
          } else {
            message += " I'll call you at this number.";
          }
          
          message += ` Check your email & confirm the calendar invite! - ${userName} @ PeachHaus`;
          
          await supabase.functions.invoke("ghl-send-sms", {
            body: {
              leadId: validLeadId || undefined,
              phone: contactPhone,
              message,
            },
          });
        } catch (smsErr) {
          console.error("SMS invite failed:", smsErr);
        }
      }

      toast.success("Call scheduled successfully! Email confirmation sent.");
      onScheduled?.();
      onDismiss();
    } catch (error: any) {
      console.error("Error scheduling call:", error);
      toast.error(`Failed to schedule: ${error.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  // Send Calendar Invite - works like live scheduling (creates calendar event + sends invite)
  const handleSendCalendarInvite = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time first");
      return;
    }
    
    if (!inviteFirstName.trim()) {
      toast.error("Please enter a first name for the invite");
      return;
    }

    setIsSendingInvite(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);
      const endTime = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
      
      const displayName = inviteFirstName.trim();
      const formattedDate = format(scheduledAt, "EEEE, MMMM d, yyyy");
      const formattedTime = format(scheduledAt, "h:mm a");
      const userName = await getCurrentUserName();
      
      const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

      // Get current user ID for calendar operations
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      if (!currentUserId) {
        throw new Error("You must be logged in to send invites");
      }

      // Determine if we have a valid lead ID
      const validLeadId = leadId || (contactType === "lead" ? contactId : null);

      // Create discovery call record if we have a lead
      if (validLeadId) {
        const { data: call, error: callError } = await supabase
          .from("discovery_calls")
          .insert({
            lead_id: validLeadId,
            scheduled_at: scheduledAt.toISOString(),
            status: "scheduled",
            meeting_type: meetingType,
            duration_minutes: 30,
            google_meet_link: meetingType === "video" ? GOOGLE_MEET_LINK : null,
          })
          .select()
          .single();

        if (!callError && call) {
          // Send branded confirmation email
          try {
            await supabase.functions.invoke("discovery-call-notifications", {
              body: {
                discoveryCallId: call.id,
                notificationType: "confirmation",
              },
            });
          } catch (notifErr) {
            console.error("Failed to send discovery call notification:", notifErr);
          }
        }
      }

      // Send branded email via send-test-template-email
      const { error: emailError } = await supabase.functions.invoke("send-test-template-email", {
        body: {
          templateId: null,
          testEmail: contactEmail || "schaer76@gmail.com",
          customEmail: {
            subject: `${meetingType === "video" ? "Video" : "Phone"} Call Scheduled with ${displayName}`,
            body: `
Hi ${displayName}!

Your ${meetingType === "video" ? "video" : "phone"} call has been scheduled.

📅 Date: ${formattedDate}
🕐 Time: ${formattedTime} EST
${meetingType === "video" ? `📹 Google Meet Link: ${GOOGLE_MEET_LINK}` : "📞 We will call you at the number you provided."}

⚠️ IMPORTANT: You will receive a separate Google Calendar invitation. Please click "Yes" to confirm your attendance.

Looking forward to speaking with you!

- ${userName} @ PeachHaus Group
            `.trim()
          }
        },
      });

      if (emailError) {
        console.error("Email send error:", emailError);
      }

      // Create Google Calendar event with invite
      const { data: calResult, error: calError } = await supabase.functions.invoke("google-calendar-sync", {
        body: {
          action: "create-event-direct",
          userId: currentUserId,
          summary: `${meetingType === "video" ? "Video" : "Phone"} Call with ${displayName}`,
          description: `${meetingType === "video" ? "Video" : "Phone"} call with ${displayName}\nPhone: ${contactPhone || "N/A"}\nEmail: ${contactEmail || "N/A"}${meetingType === "video" ? `\n\n📹 Google Meet: ${GOOGLE_MEET_LINK}` : ""}\n\n⚠️ Please confirm this calendar event by clicking "Yes" in the invitation.\n\nScheduled via PeachHaus CRM`,
          startTime: scheduledAt.toISOString(),
          endTime: endTime.toISOString(),
          attendeeEmail: contactEmail || undefined,
          addConferenceData: false,
          meetLink: meetingType === "video" ? GOOGLE_MEET_LINK : undefined,
        },
      });
      
      if (calError) {
        console.error("Calendar event creation failed:", calError);
        toast.error("Email sent but calendar invite failed");
      } else {
        console.log("Calendar event created:", calResult);
        
        // Send SMS if we have phone
        if (contactPhone) {
          const smsFormattedDate = format(scheduledAt, "EEEE, MMM d");
          const smsFormattedTime = format(scheduledAt, "h:mm a");
          
          let message = `Hi ${displayName}! I've scheduled our ${meetingType === "video" ? "video" : "phone"} call for ${smsFormattedDate} at ${smsFormattedTime} EST.`;
          
          if (meetingType === "video") {
            message += ` Join here: ${GOOGLE_MEET_LINK}`;
          } else {
            message += " I'll call you at this number.";
          }
          
          message += ` Check your email & confirm the calendar invite! - ${userName} @ PeachHaus`;
          
          await supabase.functions.invoke("ghl-send-sms", {
            body: {
              leadId: validLeadId || undefined,
              phone: contactPhone,
              message,
            },
          });
        }
        
        toast.success("Calendar invite sent successfully!");
      }
      
      onDismiss();
    } catch (error: any) {
      console.error("Error sending calendar invite:", error);
      toast.error(`Failed to send invite: ${error.message}`);
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

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    try {
      const testDate = selectedDate || addDays(new Date(), 1);
      const testTime = selectedTime || "10:00";
      const [hours, minutes] = testTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(testDate, hours), minutes);
      const endTime = new Date(scheduledAt.getTime() + 30 * 60 * 1000);
      
      const displayName = inviteFirstName || contactName || "Test Contact";
      const formattedDate = format(scheduledAt, "EEEE, MMMM d, yyyy");
      const formattedTime = format(scheduledAt, "h:mm a");
      const userName = await getCurrentUserName();
      
      // Use the fixed Google Meet link
      const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

      // Get current user ID for calendar operations
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // Send branded email with calendar invite instructions
      const { error: emailError } = await supabase.functions.invoke("send-test-template-email", {
        body: {
          templateId: null,
          testEmail: "schaer76@gmail.com",
          customEmail: {
            subject: `${meetingType === "video" ? "Video" : "Phone"} Call Scheduled with ${displayName}`,
            body: `
Hi ${displayName.split(" ")[0]}!

Your ${meetingType === "video" ? "video" : "phone"} call has been scheduled.

📅 Date: ${formattedDate}
🕐 Time: ${formattedTime} EST
${meetingType === "video" ? `📹 Google Meet Link: ${GOOGLE_MEET_LINK}` : "📞 We will call you at the number you provided."}

Contact Details:
• Name: ${displayName}
• Phone: ${contactPhone || "Not provided"}
• Email: ${contactEmail || "schaer76@gmail.com"}
• Contact Type: ${contactType}
• Lead ID: ${leadId || contactId || "N/A"}

Scheduled by: ${userName} @ PeachHaus Group

Looking forward to our conversation!
            `.trim()
          }
        },
      });

      if (emailError) {
        console.error("Email send error:", emailError);
      }

      // Also create a test Google Calendar event with invite to schaer76@gmail.com
      if (currentUserId) {
        try {
          const { data: calResult, error: calError } = await supabase.functions.invoke("google-calendar-sync", {
            body: {
              action: "create-event-direct",
              userId: currentUserId,
              summary: `[TEST] ${meetingType === "video" ? "Video" : "Phone"} Call with ${displayName}`,
              description: `${meetingType === "video" ? "Video" : "Phone"} call with ${displayName}\nPhone: ${contactPhone || "N/A"}\nEmail: schaer76@gmail.com${meetingType === "video" ? `\n\n📹 Google Meet: ${GOOGLE_MEET_LINK}` : ""}\n\n⚠️ Please confirm this calendar event by clicking "Yes" in the invitation.\n\n[TEST EVENT - Scheduled via PeachHaus CRM]`,
              startTime: scheduledAt.toISOString(),
              endTime: endTime.toISOString(),
              attendeeEmail: "schaer76@gmail.com",
              addConferenceData: false,
              meetLink: meetingType === "video" ? GOOGLE_MEET_LINK : undefined,
            },
          });
          
          if (calError) {
            console.error("Calendar event creation failed:", calError);
            toast.error("Email sent but calendar invite failed");
          } else {
            console.log("Test calendar event created:", calResult);
            toast.success("Test email AND calendar invite sent to schaer76@gmail.com!");
          }
        } catch (calErr) {
          console.error("Calendar sync error:", calErr);
          toast.success("Test email sent! (Calendar invite failed)");
        }
      } else {
        toast.success("Test email sent to schaer76@gmail.com!");
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(`Failed to send test: ${error.message}`);
    } finally {
      setIsSendingTest(false);
    }
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
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto hover:bg-transparent">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  Schedule a Call
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-xs gap-1" 
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
              >
                {isSendingTest ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Mail className="h-3 w-3" />
                )}
                Test
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs">
            {intentMessages[detectedIntent]}
          </Badge>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {/* First Name Input */}
            <div>
              <Label htmlFor="inviteFirstName" className="text-xs text-muted-foreground">
                First name for invite:
              </Label>
              <Input
                id="inviteFirstName"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                placeholder="Enter first name..."
                className="h-8 text-sm mt-1"
              />
            </div>
            
            {/* Meeting Type Selection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Meeting type:</p>
              <RadioGroup 
                value={meetingType} 
                onValueChange={(v) => setMeetingType(v as MeetingType)}
                className="flex gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="video" id="video" />
                  <Label htmlFor="video" className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Video className="h-3.5 w-3.5" />
                    Google Meet
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="phone" id="phone" />
                  <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Phone className="h-3.5 w-3.5" />
                    Phone Call
                  </Label>
                </div>
              </RadioGroup>
            </div>

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
              {selectedDate && selectedTime ? (
                <>
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
                  
                  {/* Send Calendar Invite - works like live mode */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendCalendarInvite}
                    disabled={isSendingInvite || !inviteFirstName.trim()}
                    className="gap-1.5"
                  >
                    {isSendingInvite ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Send Calendar Invite
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Select a date and time above to schedule
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
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

// Admin component to delete scheduled calls
export function ScheduledCallsManager({ leadId }: { leadId?: string }) {
  const [scheduledCalls, setScheduledCalls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchScheduledCalls = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("discovery_calls")
        .select("*, leads(name, phone, email)")
        .eq("status", "scheduled")
        .order("scheduled_at", { ascending: true });
      
      if (leadId) {
        query = query.eq("lead_id", leadId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setScheduledCalls(data || []);
    } catch (error) {
      console.error("Error fetching scheduled calls:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCall = async (callId: string, calendarEventId?: string) => {
    setIsDeletingId(callId);
    try {
      // Delete from Google Calendar if we have an event ID
      if (calendarEventId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            await supabase.functions.invoke("google-calendar-sync", {
              body: {
                action: "delete-event",
                userId: user.id,
                eventId: calendarEventId,
              },
            });
          } catch (calErr) {
            console.error("Failed to delete calendar event:", calErr);
          }
        }
      }
      
      // Delete from database
      const { error } = await supabase
        .from("discovery_calls")
        .delete()
        .eq("id", callId);
      
      if (error) throw error;
      
      toast.success("Scheduled call deleted");
      fetchScheduledCalls();
    } catch (error: any) {
      console.error("Error deleting call:", error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeletingId(null);
    }
  };

  // Fetch on mount
  useState(() => {
    fetchScheduledCalls();
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading scheduled calls...
      </div>
    );
  }

  if (scheduledCalls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Scheduled Calls:</p>
      {scheduledCalls.map((call) => (
        <div
          key={call.id}
          className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
        >
          <div>
            <span className="font-medium">
              {call.leads?.name || "Unknown"} - {format(new Date(call.scheduled_at), "MMM d, h:mm a")}
            </span>
            <span className="text-muted-foreground ml-2">
              ({call.meeting_type || "video"})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleDeleteCall(call.id, call.google_calendar_event_id)}
            disabled={isDeletingId === call.id}
          >
            {isDeletingId === call.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
