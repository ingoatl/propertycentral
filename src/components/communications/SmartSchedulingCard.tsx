import { useState, useMemo, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Clock, Send, X, Loader2, Check, Phone, Video, ChevronDown, ChevronUp, Mail, Trash2, MapPin, Home, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, isAfter, startOfDay, parseISO, isWeekend, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// Helper to extract email addresses from text
function extractEmailFromText(text: string): string | null {
  if (!text) return null;
  // Look for email= pattern in URLs first (from GHL unsubscribe links)
  const emailParamMatch = text.match(/email=([^&\s\]]+)/i);
  if (emailParamMatch) {
    const decoded = decodeURIComponent(emailParamMatch[1]);
    if (decoded.includes("@")) return decoded;
  }
  // General email pattern
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    // Filter out our own emails
    const email = emailMatch[0].toLowerCase();
    if (!email.includes("peachhausgroup.com") && !email.includes("peachhaus.com") && !email.includes("msgsndr.com")) {
      return email;
    }
  }
  return null;
}

// Helper to extract first name from message body (e.g., "Hi Hector!")
function extractFirstNameFromText(text: string): string | null {
  if (!text) return null;
  const greetingMatch = text.match(/(?:Hi|Hello|Hey|Dear)\s+([A-Z][a-z]+)[!,.\s]/i);
  if (greetingMatch) {
    return greetingMatch[1];
  }
  return null;
}

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

type MeetingType = "phone" | "video" | "onsite";

interface Property {
  id: string;
  name: string;
  address: string;
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
  const [meetingType, setMeetingType] = useState<MeetingType>("video");
  const [isScheduling, setIsScheduling] = useState(false);
  
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // On-site meeting state
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [customAddress, setCustomAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  
  // First name input for calendar invite - extract from contactName if available
  const extractedFirstName = contactName?.split(" ")[0] || "";
  const isPhoneNumber = /^[\d\s\-\(\)\+\.]+$/.test(extractedFirstName);
  const [inviteFirstName, setInviteFirstName] = useState(isPhoneNumber ? "" : extractedFirstName);
  
  // Email input for calendar invite - use provided email or allow manual entry
  const [inviteEmail, setInviteEmail] = useState(contactEmail || "");
  
  // Track if we've attempted to extract from conversations
  const [hasExtractedFromConversations, setHasExtractedFromConversations] = useState(false);

  // Fetch managed properties for on-site meetings
  const { data: properties = [] } = useQuery({
    queryKey: ["managed-properties-scheduling"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("offboarded_at", null)
        .order("name");
      if (error) throw error;
      return (data || []) as Property[];
    },
    staleTime: 60000,
  });

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (typeof google !== "undefined" && google.maps?.places) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
    }
  }, []);

  // Handle address input for Google autocomplete
  const handleAddressChange = async (value: string) => {
    setCustomAddress(value);
    if (value.length > 3 && autocompleteService.current) {
      try {
        const result = await autocompleteService.current.getPlacePredictions({
          input: value,
          componentRestrictions: { country: "us" },
          types: ["address"],
        });
        setAddressSuggestions(result?.predictions || []);
        setShowAddressSuggestions(true);
      } catch (error) {
        console.error("Autocomplete error:", error);
        setAddressSuggestions([]);
      }
    } else {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    }
  };

  const handleSelectAddress = (prediction: google.maps.places.AutocompletePrediction) => {
    setCustomAddress(prediction.description);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  // Get meeting location for on-site meetings
  const getMeetingLocation = (): string => {
    if (meetingType !== "onsite") return "";
    if (selectedPropertyId) {
      const prop = properties.find(p => p.id === selectedPropertyId);
      return prop?.address || prop?.name || "";
    }
    return customAddress;
  };

  // Auto-extract email and name from conversation history + GHL metadata
  useEffect(() => {
    if (hasExtractedFromConversations) return;
    
    const extractFromConversations = async () => {
      try {
        const ownerId = contactType === "owner" ? contactId : null;
        let foundEmail: string | null = null;
        let foundName: string | null = null;
        
        // Strategy 1: Search by lead_id or owner_id if available
        if (leadId || ownerId) {
          const query = supabase
            .from("lead_communications")
            .select("body, subject, metadata")
            .order("created_at", { ascending: false })
            .limit(30);
          
          if (leadId) {
            query.eq("lead_id", leadId);
          } else if (ownerId) {
            query.eq("owner_id", ownerId);
          }
          
          const { data: communications } = await query;
          
          if (communications && communications.length > 0) {
            for (const comm of communications) {
              // Check GHL metadata for email (most reliable source)
              const metadata = comm.metadata as { ghl_data?: { contactEmail?: string; contactName?: string } } | null;
              if (!foundEmail && metadata?.ghl_data?.contactEmail) {
                foundEmail = metadata.ghl_data.contactEmail;
              }
              if (!foundName && metadata?.ghl_data?.contactName && metadata.ghl_data.contactName !== "Contact") {
                foundName = metadata.ghl_data.contactName;
              }
              // Fallback to body extraction
              if (!foundEmail && comm.body) {
                foundEmail = extractEmailFromText(comm.body);
              }
              if (!foundName && comm.body) {
                foundName = extractFirstNameFromText(comm.body);
              }
              if (foundEmail && foundName) break;
            }
          }
        }
        
        // Strategy 2: Search ALL messages by phone number - find any with email
        // This is crucial for unmatched GHL conversations where some messages have email, some don't
        if ((!foundEmail || !foundName) && contactPhone) {
          const normalizedPhone = contactPhone.replace(/[^\d]/g, "");
          const last10 = normalizedPhone.slice(-10);
          
          // Search ALL lead_communications and check metadata for matching phone
          const { data: allComms } = await supabase
            .from("lead_communications")
            .select("body, metadata")
            .not("metadata", "is", null)
            .order("created_at", { ascending: false })
            .limit(200);
          
          if (allComms) {
            for (const comm of allComms) {
              const metadata = comm.metadata as { 
                ghl_data?: { contactEmail?: string; contactName?: string; contactPhone?: string };
                unmatched_phone?: string;
              } | null;
              
              if (!metadata) continue;
              
              const commPhone = metadata.ghl_data?.contactPhone || metadata.unmatched_phone;
              if (!commPhone) continue;
              
              // Normalize and compare phone numbers
              const normalizedCommPhone = commPhone.replace(/[^\d]/g, "");
              const commLast10 = normalizedCommPhone.slice(-10);
              
              if (commLast10 === last10) {
                // Found a message from the same phone number
                const email = metadata.ghl_data?.contactEmail;
                const name = metadata.ghl_data?.contactName;
                
                // Take email if we don't have one yet and it's not empty
                if (!foundEmail && email && email.trim().length > 0) {
                  foundEmail = email;
                  console.log("Found email from phone match:", foundEmail);
                }
                
                // Take name if we don't have one yet and it's not "Contact" placeholder
                if (!foundName && name && name !== "Contact" && name.trim().length > 0) {
                  foundName = name;
                  console.log("Found name from phone match:", foundName);
                }
                
                // Also check body for email
                if (!foundEmail && comm.body) {
                  foundEmail = extractEmailFromText(comm.body);
                }
                
                if (foundEmail && foundName) break;
              }
            }
          }
        }
        
        // Update state if we found info and fields are empty
        if (foundEmail && !inviteEmail) {
          console.log("Auto-extracted email from conversation:", foundEmail);
          setInviteEmail(foundEmail);
        }
        if (foundName && !inviteFirstName) {
          console.log("Auto-extracted name from conversation:", foundName);
          setInviteFirstName(foundName);
        }
      } catch (err) {
        console.error("Failed to extract from conversations:", err);
      }
      
      setHasExtractedFromConversations(true);
    };
    
    extractFromConversations();
  }, [leadId, contactId, contactType, contactPhone, hasExtractedFromConversations, inviteEmail, inviteFirstName]);

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

    if (!inviteFirstName.trim()) {
      toast.error("Please enter a first name for the invite");
      return;
    }
    
    if (!inviteEmail?.trim()) {
      toast.error("Please enter an email address for the calendar invite");
      return;
    }

    setIsScheduling(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);
      const endTime = new Date(scheduledAt.getTime() + 30 * 60 * 1000); // 30 min duration

      // Use first name input, falling back to contact name
      const displayName = inviteFirstName.trim() || contactName || "Contact";
      const attendeeEmailToUse = inviteEmail.trim();
      
      // Determine if we have a valid lead ID
      const validLeadId = leadId || (contactType === "lead" ? contactId : null);

      // Fixed Google Meet link
      const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";
      const userName = await getCurrentUserName();
      const formattedDate = format(scheduledAt, "EEEE, MMMM d, yyyy");
      const formattedTime = format(scheduledAt, "h:mm a");

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
          
          // Send branded confirmation email via discovery-call-notifications
          try {
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
            
            // Auto-schedule Recall.ai bot for video meetings to capture transcript
            if (meetingType === "video") {
              try {
                const { data: botResult, error: botError } = await supabase.functions.invoke("recall-auto-schedule-bot", {
                  body: { discoveryCallId: call.id },
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

      // Build meeting type specific content
      const meetingLocation = getMeetingLocation();
      const meetingTypeLabel = meetingType === "video" ? "Video" : meetingType === "phone" ? "Phone" : "On-site";
      
      // Send branded Peachhaus confirmation email
      let emailBody = `Hi ${displayName}!\n\nYour ${meetingTypeLabel.toLowerCase()} meeting has been scheduled.\n\n📅 Date: ${formattedDate}\n🕐 Time: ${formattedTime} EST\n`;
      
      if (meetingType === "video") {
        emailBody += `📹 Google Meet Link: ${GOOGLE_MEET_LINK}`;
      } else if (meetingType === "onsite" && meetingLocation) {
        emailBody += `📍 Location: ${meetingLocation}`;
      } else {
        emailBody += "📞 We will call you at the number you provided.";
      }
      
      emailBody += "\n\n⚠️ IMPORTANT: You will receive a separate Google Calendar invitation. Please click \"Yes\" to confirm your attendance.\n\nLooking forward to meeting with you!\n\n- " + userName + " @ PeachHaus Group";
      
      // Send the official Peachhaus confirmation email
      try {
        await supabase.functions.invoke("send-test-template-email", {
          body: {
            templateId: null,
            testEmail: attendeeEmailToUse,
            customEmail: {
              subject: `${meetingTypeLabel} ${meetingType === "onsite" ? "Meeting" : "Call"} Scheduled - PeachHaus Group`,
              body: emailBody
            }
          },
        });
        console.log("Peachhaus confirmation email sent");
      } catch (emailErr) {
        console.error("Failed to send Peachhaus email:", emailErr);
      }

      // Create Google Calendar event with invite
      let calDescription = `${meetingTypeLabel} meeting with ${displayName}\nPhone: ${contactPhone || "N/A"}\nEmail: ${attendeeEmailToUse}`;
      
      if (meetingType === "video") {
        calDescription += `\n\n📹 Google Meet: ${GOOGLE_MEET_LINK}`;
      } else if (meetingType === "onsite" && meetingLocation) {
        calDescription += `\n\n📍 Location: ${meetingLocation}`;
      }
      
      calDescription += "\n\n⚠️ Please confirm this calendar event by clicking \"Yes\" in the invitation.\n\nScheduled via PeachHaus CRM";

      try {
        const { data: calResult, error: calError } = await supabase.functions.invoke("google-calendar-sync", {
          body: {
            action: "create-event-direct",
            userId: currentUserId,
            summary: `${meetingTypeLabel} ${meetingType === "onsite" ? "Meeting" : "Call"} with ${displayName}`,
            description: calDescription,
            startTime: scheduledAt.toISOString(),
            endTime: endTime.toISOString(),
            attendeeEmail: attendeeEmailToUse,
            addConferenceData: false,
            meetLink: meetingType === "video" ? GOOGLE_MEET_LINK : undefined,
            location: meetingType === "onsite" ? meetingLocation : undefined,
          },
        });
        
        if (calError) {
          console.error("Calendar event creation failed:", calError);
          toast.error("Meeting scheduled but Google Calendar invite failed - please send manually");
        } else {
          console.log("Calendar event with invite created:", calResult);
          
          // Update discovery call with calendar event ID if we have one
          if (callId && calResult?.eventId) {
            await supabase
              .from("discovery_calls")
              .update({ google_calendar_event_id: calResult.eventId })
              .eq("id", callId);
          }
        }
      } catch (calErr) {
        console.error("Calendar creation error:", calErr);
        toast.error("Meeting scheduled but calendar invite failed");
      }

      // Send SMS confirmation if we have phone
      if (contactPhone) {
        try {
          const smsFormattedDate = format(scheduledAt, "EEEE, MMM d");
          const smsFormattedTime = format(scheduledAt, "h:mm a");
          
          let message = `Hi ${displayName}! I've scheduled our ${meetingTypeLabel.toLowerCase()} meeting for ${smsFormattedDate} at ${smsFormattedTime} EST.`;
          
          if (meetingType === "video") {
            message += ` Join here: ${GOOGLE_MEET_LINK}`;
          } else if (meetingType === "onsite" && meetingLocation) {
            message += ` We'll meet at: ${meetingLocation}`;
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

      toast.success("Meeting scheduled! Calendar invite & confirmation email sent.");
      onScheduled?.();
      onDismiss();
    } catch (error: any) {
      console.error("Error scheduling call:", error);
      toast.error(`Failed to schedule: ${error.message}`);
    } finally {
      setIsScheduling(false);
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
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 mb-3 sm:mb-4 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1.5 sm:gap-2 p-0 h-auto hover:bg-transparent min-w-0">
                <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                <CardTitle className="text-xs sm:text-sm font-medium truncate">
                  Schedule a Meeting
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                )}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-[10px] sm:text-xs gap-1 px-2 hidden sm:flex" 
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
          <Badge variant="secondary" className="w-fit text-[10px] sm:text-xs mt-1.5">
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
            
            {/* Email Input for Calendar Invite */}
            <div>
              <Label htmlFor="inviteEmail" className="text-xs text-muted-foreground">
                Email for calendar invite: <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address..."
                className="h-8 text-sm mt-1"
              />
              {!inviteEmail && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Email required to send calendar invite
                </p>
              )}
            </div>
            
            {/* Meeting Type Selection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Meeting type:</p>
              <RadioGroup 
                value={meetingType} 
                onValueChange={(v) => {
                  setMeetingType(v as MeetingType);
                  // Reset property selection when switching away from on-site
                  if (v !== "onsite") {
                    setSelectedPropertyId("");
                    setCustomAddress("");
                  }
                }}
                className="flex flex-wrap gap-3"
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
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="onsite" id="onsite" />
                  <Label htmlFor="onsite" className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <MapPin className="h-3.5 w-3.5" />
                    On-site
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* On-site Meeting Location */}
            {meetingType === "onsite" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Meeting location:</p>
                
                {/* Property Selection */}
                <Select value={selectedPropertyId} onValueChange={(v) => {
                  setSelectedPropertyId(v);
                  setCustomAddress("");
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a managed property..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="custom">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        Enter custom address
                      </span>
                    </SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        <span className="flex items-center gap-2">
                          <Home className="h-3.5 w-3.5" />
                          {prop.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Show address for selected property */}
                {selectedPropertyId && selectedPropertyId !== "custom" && (
                  <p className="text-xs text-muted-foreground pl-2">
                    📍 {properties.find(p => p.id === selectedPropertyId)?.address}
                  </p>
                )}
                
                {/* Custom Address with Google Autocomplete */}
                {selectedPropertyId === "custom" && (
                  <div className="relative">
                    <Input
                      value={customAddress}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      placeholder="Enter street address..."
                      className="h-8 text-sm"
                    />
                    {showAddressSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.place_id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => handleSelectAddress(suggestion)}
                          >
                            {suggestion.description}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Date Selection - Calendar Picker + Quick Buttons */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Select a date:</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {/* Quick date buttons */}
                {availableDates.slice(0, 3).map((date) => (
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
                
                {/* Calendar Picker */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={selectedDate && !availableDates.slice(0, 3).some(d => d.toDateString() === selectedDate.toDateString()) ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7 px-2 gap-1"
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {selectedDate && !availableDates.slice(0, 3).some(d => d.toDateString() === selectedDate.toDateString()) 
                        ? format(selectedDate, "MMM d")
                        : "Pick date"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate || undefined}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setSelectedTime(null);
                          setCalendarOpen(false);
                        }
                      }}
                      disabled={(date) => 
                        isBefore(date, startOfDay(new Date())) || 
                        isWeekend(date) ||
                        isAfter(date, addMonths(new Date(), 2))
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Time Selection */}
            {selectedDate && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select a time:</p>
                <div className="flex flex-wrap gap-1">
                  {timeSlots.filter(s => s.available).slice(0, 10).map((slot) => (
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
                <Button
                  size="sm"
                  onClick={handleScheduleCall}
                  disabled={isScheduling || !inviteFirstName.trim() || !inviteEmail?.trim()}
                  className="gap-1.5"
                >
                  {isScheduling ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Schedule & Send Invite
                </Button>
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
