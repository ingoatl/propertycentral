import { useState, useEffect } from "react";
import { ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader, ResponsiveModalTitle } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckSquare, Loader2, Send, User, ChevronLeft, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, parse } from "date-fns";

interface EmailActionModalProps {
  open: boolean;
  onClose: () => void;
  email: {
    id: string;
    subject: string;
    from: string;
    fromName: string;
    body: string;
    date?: string;
  } | null;
}

interface DetectedContext {
  hasMeetingIntent: boolean;
  hasTaskIntent: boolean;
  hasActionableContent: boolean;
  urgencyLevel: "high" | "medium" | "low" | "none";
  suggestedDate: Date | null;
  suggestedTime: string | null;
  contactName: string;
  contactEmail: string;
  meetingTitle: string;
  taskSuggestion: string;
  reason: string;
  communicationHistory: string; // Added for AI context
}

// Keywords that indicate actionable content for a PM business
const MEETING_KEYWORDS = [
  "meeting", "call", "schedule", "discuss", "chat", "talk", 
  "available", "availability", "tomorrow", "next week", "calendar",
  "hop on a call", "set up a time", "book", "slot", "appointment",
  "zoom", "google meet", "teams", "phone call", "video call",
  "let's connect", "catch up", "free time", "when are you"
];

const TASK_KEYWORDS = [
  "please review", "action required", "urgent", "asap", "deadline",
  "need you to", "can you", "would you", "follow up", "reminder",
  "pending", "waiting for", "approval needed", "sign", "complete",
  "submit", "send", "update", "fix", "repair", "maintenance",
  "invoice", "payment", "lease", "renewal", "move-in", "move-out",
  "inspection", "showing", "tour", "application", "deposit"
];

const IGNORE_KEYWORDS = [
  "unsubscribe", "newsletter", "promotional", "marketing",
  "no-reply", "noreply", "donotreply", "automated", "auto-generated",
  "receipt", "confirmation", "thank you for your order",
  "your order has shipped", "tracking number", "delivery notification"
];

export function EmailActionModal({ open, onClose, email }: EmailActionModalProps) {
  const [context, setContext] = useState<DetectedContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"calendar" | "task" | null>(null);
  const [shouldShow, setShouldShow] = useState(false);
  
  // Calendar invite form state
  const [calendarForm, setCalendarForm] = useState({
    title: "",
    date: "",
    time: "10:00",
    duration: "30",
    attendeeEmail: "",
    description: "",
  });
  
  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Analyze email content when opened
  useEffect(() => {
    if (open && email) {
      analyzeEmail(email);
    } else {
      setContext(null);
      setSelectedAction(null);
      setShouldShow(false);
    }
  }, [open, email]);

  const analyzeEmail = async (email: { subject: string; from: string; fromName: string; body: string; date?: string }) => {
    setIsAnalyzing(true);
    
    // Extract email from "from" field
    const emailMatch = email.from.match(/<(.+?)>/) || [null, email.from];
    const contactEmail = emailMatch[1] || email.from;
    
    const fullContent = (email.body + " " + email.subject).toLowerCase();
    
    // Fetch related communication history for context
    let communicationHistory = "";
    try {
      // Try to find lead by email
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name")
        .eq("email", contactEmail)
        .limit(1);
      
      if (leads && leads.length > 0) {
        // Fetch recent communications including GHL synced ones
        const { data: comms } = await supabase
          .from("lead_communications")
          .select("communication_type, direction, body, subject, created_at")
          .eq("lead_id", leads[0].id)
          .order("created_at", { ascending: false })
          .limit(10);
        
        if (comms && comms.length > 0) {
          communicationHistory = comms.map(c => 
            `[${c.communication_type}/${c.direction}] ${c.subject || ""} ${c.body?.slice(0, 100) || ""}`
          ).join("\n");
        }
      }
    } catch (err) {
      console.log("Could not fetch communication history:", err);
    }
    
    // Check if this is an automated/marketing email we should ignore
    const isAutomatedEmail = IGNORE_KEYWORDS.some(kw => fullContent.includes(kw)) ||
      contactEmail.includes("noreply") ||
      contactEmail.includes("no-reply") ||
      contactEmail.includes("automated") ||
      contactEmail.includes("newsletter") ||
      contactEmail.includes("marketing");
    
    if (isAutomatedEmail) {
      setContext(null);
      setShouldShow(false);
      setIsAnalyzing(false);
      onClose(); // Close modal for automated emails
      return;
    }
    
    // Detect meeting intent
    const meetingMatches = MEETING_KEYWORDS.filter(kw => fullContent.includes(kw));
    const hasMeetingIntent = meetingMatches.length >= 2 || 
      (meetingMatches.length === 1 && meetingMatches.some(kw => 
        ["meeting", "call", "schedule", "appointment", "zoom", "google meet"].includes(kw)
      ));
    
    // Detect task intent
    const taskMatches = TASK_KEYWORDS.filter(kw => fullContent.includes(kw));
    const hasTaskIntent = taskMatches.length >= 1;
    
    // Determine urgency
    let urgencyLevel: "high" | "medium" | "low" | "none" = "none";
    if (fullContent.includes("urgent") || fullContent.includes("asap") || fullContent.includes("immediately")) {
      urgencyLevel = "high";
    } else if (fullContent.includes("soon") || fullContent.includes("deadline") || fullContent.includes("by tomorrow")) {
      urgencyLevel = "medium";
    } else if (hasMeetingIntent || hasTaskIntent) {
      urgencyLevel = "low";
    }
    
    // Only show modal if there's actionable content
    const hasActionableContent = hasMeetingIntent || hasTaskIntent;
    
    if (!hasActionableContent) {
      setContext(null);
      setShouldShow(false);
      setIsAnalyzing(false);
      onClose(); // Close modal for non-actionable emails
      return;
    }
    
    // Try to detect suggested date/time from email
    let suggestedDate: Date | null = null;
    let suggestedTime: string | null = null;
    
    if (fullContent.includes("tomorrow")) {
      suggestedDate = addDays(new Date(), 1);
    } else if (fullContent.includes("next week")) {
      suggestedDate = addDays(new Date(), 7);
    } else if (fullContent.includes("today")) {
      suggestedDate = new Date();
    }
    
    // Detect time patterns like "10am", "2:00 PM", etc.
    const timeMatch = fullContent.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] || "00";
      const period = timeMatch[3].toLowerCase();
      if (period === "pm" && hour < 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      suggestedTime = `${hour.toString().padStart(2, "0")}:${minutes}`;
    }
    
    // Generate task suggestion based on content
    let taskSuggestion = `Follow up with ${email.fromName}`;
    if (fullContent.includes("review")) taskSuggestion = `Review request from ${email.fromName}`;
    if (fullContent.includes("sign")) taskSuggestion = `Sign document from ${email.fromName}`;
    if (fullContent.includes("approve")) taskSuggestion = `Approval needed: ${email.subject}`;
    if (fullContent.includes("maintenance") || fullContent.includes("repair")) {
      taskSuggestion = `Address maintenance request from ${email.fromName}`;
    }
    if (fullContent.includes("lease") || fullContent.includes("renewal")) {
      taskSuggestion = `Handle lease matter: ${email.subject}`;
    }
    
    // Generate reason for showing
    let reason = "";
    if (hasMeetingIntent && hasTaskIntent) {
      reason = "Meeting request & action item detected";
    } else if (hasMeetingIntent) {
      reason = "Meeting or call request detected";
    } else if (hasTaskIntent) {
      reason = "Action item detected";
    }
    
    const detectedContext: DetectedContext = {
      hasMeetingIntent,
      hasTaskIntent,
      hasActionableContent,
      urgencyLevel,
      suggestedDate,
      suggestedTime,
      contactName: email.fromName,
      contactEmail,
      meetingTitle: `Meeting with ${email.fromName}`,
      taskSuggestion,
      reason,
      communicationHistory, // Include history for context
    };
    
    setContext(detectedContext);
    setShouldShow(true);
    
    // Pre-fill forms based on context
    setCalendarForm({
      title: detectedContext.meetingTitle,
      date: suggestedDate ? format(suggestedDate, "yyyy-MM-dd") : format(addDays(new Date(), 1), "yyyy-MM-dd"),
      time: suggestedTime || "10:00",
      duration: "30",
      attendeeEmail: contactEmail,
      description: `Follow-up from email: ${email.subject}`,
    });
    
    setTaskForm({
      title: taskSuggestion,
      description: `Re: ${email.subject}\n\nOriginal email received on ${format(new Date(email.date || new Date()), "MMM d, yyyy")}`,
      dueDate: format(addDays(new Date(), urgencyLevel === "high" ? 0 : urgencyLevel === "medium" ? 1 : 3), "yyyy-MM-dd"),
    });
    
    setIsAnalyzing(false);
  };

  const handleSendCalendarInvite = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Parse date and time
      const eventDate = parse(calendarForm.date, "yyyy-MM-dd", new Date());
      const [hours, minutes] = calendarForm.time.split(":").map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
      
      const endDate = new Date(eventDate.getTime() + parseInt(calendarForm.duration) * 60000);

      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: {
          action: "create-event-direct",
          summary: calendarForm.title,
          description: calendarForm.description,
          startTime: eventDate.toISOString(),
          endTime: endDate.toISOString(),
          attendeeEmail: calendarForm.attendeeEmail,
        },
      });

      if (error) throw error;

      toast.success(`Calendar invite sent to ${calendarForm.attendeeEmail}`);
      onClose();
    } catch (err) {
      console.error("Failed to send calendar invite:", err);
      toast.error("Failed to send calendar invite. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTask = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("conversation_notes").insert({
        note: `📋 TASK: ${taskForm.title}\n\nDue: ${format(new Date(taskForm.dueDate), "MMM d, yyyy")}\n\n${taskForm.description}`,
        contact_email: context?.contactEmail,
        contact_name: context?.contactName,
        user_id: user.id,
      });

      if (error) throw error;

      toast.success("Task created successfully");
      onClose();
    } catch (err) {
      console.error("Failed to create task:", err);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if no email or shouldn't show
  if (!email || (!shouldShow && !isAnalyzing)) return null;

  return (
    <ResponsiveModal open={open && (shouldShow || isAnalyzing)} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <div className="flex items-center justify-between w-full">
            <ResponsiveModalTitle className="flex items-center gap-2 text-base">
              {selectedAction ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -ml-2"
                  onClick={() => setSelectedAction(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              ) : (
                <AlertCircle className="h-5 w-5 text-primary" />
              )}
              {selectedAction === "calendar" ? "Send Calendar Invite" : 
               selectedAction === "task" ? "Create Task" : 
               "Action Detected"}
            </ResponsiveModalTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </ResponsiveModalHeader>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Analyzing email content...</p>
          </div>
        ) : !selectedAction ? (
          <div className="space-y-4 px-1">
            {/* Context summary */}
            {context && (
              <div className={`p-3 rounded-lg border ${
                context.urgencyLevel === "high" 
                  ? "bg-red-500/10 border-red-500/30" 
                  : context.urgencyLevel === "medium"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-primary/10 border-primary/20"
              }`}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm font-medium">{context.contactName}</p>
                  {context.urgencyLevel !== "none" && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      context.urgencyLevel === "high" ? "bg-red-500 text-white" :
                      context.urgencyLevel === "medium" ? "bg-amber-500 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {context.urgencyLevel === "high" ? "Urgent" : 
                       context.urgencyLevel === "medium" ? "Soon" : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{context.reason}</p>
              </div>
            )}

            {/* Action buttons - mobile optimized */}
            <div className="grid gap-3">
              {context?.hasMeetingIntent && (
                <Button
                  variant="outline"
                  className="h-auto py-4 px-4 justify-start active:scale-[0.98] transition-transform"
                  onClick={() => setSelectedAction("calendar")}
                >
                  <Calendar className="h-6 w-6 mr-4 text-primary flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="font-medium">Send Calendar Invite</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {context?.suggestedDate 
                        ? `${format(context.suggestedDate, "EEE, MMM d")} at ${context.suggestedTime || "10:00 AM"}`
                        : `Schedule with ${context?.contactName}`}
                    </p>
                  </div>
                </Button>
              )}

              {context?.hasTaskIntent && (
                <Button
                  variant="outline"
                  className="h-auto py-4 px-4 justify-start active:scale-[0.98] transition-transform"
                  onClick={() => setSelectedAction("task")}
                >
                  <CheckSquare className="h-6 w-6 mr-4 text-orange-500 flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="font-medium">Create Task</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {context?.taskSuggestion}
                    </p>
                  </div>
                </Button>
              )}
            </div>

            {/* Skip button */}
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
              Skip for now
            </Button>
          </div>
        ) : selectedAction === "calendar" ? (
          <div className="space-y-4 px-1">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-sm">Meeting Title</Label>
                <Input
                  id="title"
                  value={calendarForm.title}
                  onChange={(e) => setCalendarForm({ ...calendarForm, title: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date" className="text-sm">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={calendarForm.date}
                    onChange={(e) => setCalendarForm({ ...calendarForm, date: e.target.value })}
                    className="h-11 mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="time" className="text-sm">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={calendarForm.time}
                    onChange={(e) => setCalendarForm({ ...calendarForm, time: e.target.value })}
                    className="h-11 mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="duration" className="text-sm">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={calendarForm.duration}
                    onChange={(e) => setCalendarForm({ ...calendarForm, duration: e.target.value })}
                    className="h-11 mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="attendee" className="text-sm">Attendee</Label>
                  <Input
                    id="attendee"
                    type="email"
                    value={calendarForm.attendeeEmail}
                    onChange={(e) => setCalendarForm({ ...calendarForm, attendeeEmail: e.target.value })}
                    className="h-11 mt-1.5"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-sm">Description</Label>
                <Textarea
                  id="description"
                  value={calendarForm.description}
                  onChange={(e) => setCalendarForm({ ...calendarForm, description: e.target.value })}
                  rows={3}
                  className="mt-1.5 resize-none"
                />
              </div>
            </div>

            <Button
              onClick={handleSendCalendarInvite}
              disabled={isSubmitting}
              className="w-full h-12 text-base"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Send className="h-5 w-5 mr-2" />
              )}
              Send Invite
            </Button>
          </div>
        ) : (
          <div className="space-y-4 px-1">
            <div className="space-y-4">
              <div>
                <Label htmlFor="taskTitle" className="text-sm">Task Title</Label>
                <Input
                  id="taskTitle"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="taskDue" className="text-sm">Due Date</Label>
                <Input
                  id="taskDue"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="taskDesc" className="text-sm">Description</Label>
                <Textarea
                  id="taskDesc"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={4}
                  className="mt-1.5 resize-none"
                />
              </div>
            </div>

            <Button
              onClick={handleCreateTask}
              disabled={isSubmitting}
              className="w-full h-12 text-base"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <CheckSquare className="h-5 w-5 mr-2" />
              )}
              Create Task
            </Button>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
