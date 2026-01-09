import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckSquare, Loader2, Send, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, parse, isValid } from "date-fns";

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
  suggestedDate: Date | null;
  suggestedTime: string | null;
  contactName: string;
  contactEmail: string;
  meetingTitle: string;
}

export function EmailActionModal({ open, onClose, email }: EmailActionModalProps) {
  const [context, setContext] = useState<DetectedContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"calendar" | "task" | null>(null);
  
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
    }
  }, [open, email]);

  const analyzeEmail = async (email: { subject: string; from: string; fromName: string; body: string; date?: string }) => {
    setIsAnalyzing(true);
    
    // Extract email from "from" field
    const emailMatch = email.from.match(/<(.+?)>/) || [null, email.from];
    const contactEmail = emailMatch[1] || email.from;
    
    // Detect meeting-related keywords
    const meetingKeywords = [
      "meeting", "call", "schedule", "discuss", "chat", "talk", 
      "available", "availability", "tomorrow", "next week", "calendar",
      "hop on a call", "set up a time", "book", "slot", "appointment"
    ];
    
    const bodyLower = (email.body + " " + email.subject).toLowerCase();
    const hasMeetingIntent = meetingKeywords.some(kw => bodyLower.includes(kw));
    
    // Try to detect suggested date/time from email
    let suggestedDate: Date | null = null;
    let suggestedTime: string | null = null;
    
    if (bodyLower.includes("tomorrow")) {
      suggestedDate = addDays(new Date(), 1);
    } else if (bodyLower.includes("next week")) {
      suggestedDate = addDays(new Date(), 7);
    }
    
    // Detect time patterns like "10am", "2:00 PM", etc.
    const timeMatch = bodyLower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] || "00";
      const period = timeMatch[3].toLowerCase();
      if (period === "pm" && hour < 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      suggestedTime = `${hour.toString().padStart(2, "0")}:${minutes}`;
    }
    
    const detectedContext: DetectedContext = {
      hasMeetingIntent,
      suggestedDate,
      suggestedTime,
      contactName: email.fromName,
      contactEmail,
      meetingTitle: `Meeting with ${email.fromName}`,
    };
    
    setContext(detectedContext);
    
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
      title: `Follow up with ${email.fromName}`,
      description: `Re: ${email.subject}\n\nOriginal email received on ${format(new Date(email.date || new Date()), "MMM d, yyyy")}`,
      dueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
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

      // Create a task in onboarding_tasks or a general tasks table
      // For now, we'll create it as a conversation note that can be tracked
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

  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Actions for {email.fromName}
          </DialogTitle>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Analyzing email...</p>
          </div>
        ) : !selectedAction ? (
          <div className="space-y-4">
            {/* Context summary */}
            {context?.hasMeetingIntent && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary">📅 Meeting intent detected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This email seems to be about scheduling a meeting or call.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 justify-start"
                onClick={() => setSelectedAction("calendar")}
              >
                <Calendar className="h-5 w-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Send Calendar Invite</p>
                  <p className="text-xs text-muted-foreground">
                    {context?.suggestedDate 
                      ? `Suggested: ${format(context.suggestedDate, "MMM d")} at ${context.suggestedTime || "10:00 AM"}`
                      : `Schedule a meeting with ${context?.contactName}`}
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto py-4 justify-start"
                onClick={() => setSelectedAction("task")}
              >
                <CheckSquare className="h-5 w-5 mr-3 text-orange-500" />
                <div className="text-left">
                  <p className="font-medium">Create Task</p>
                  <p className="text-xs text-muted-foreground">
                    Add a follow-up reminder for this email
                  </p>
                </div>
              </Button>
            </div>
          </div>
        ) : selectedAction === "calendar" ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAction(null)}
              className="mb-2"
            >
              ← Back to actions
            </Button>

            <div className="space-y-3">
              <div>
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  value={calendarForm.title}
                  onChange={(e) => setCalendarForm({ ...calendarForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={calendarForm.date}
                    onChange={(e) => setCalendarForm({ ...calendarForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={calendarForm.time}
                    onChange={(e) => setCalendarForm({ ...calendarForm, time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={calendarForm.duration}
                  onChange={(e) => setCalendarForm({ ...calendarForm, duration: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="attendee">Attendee Email</Label>
                <Input
                  id="attendee"
                  type="email"
                  value={calendarForm.attendeeEmail}
                  onChange={(e) => setCalendarForm({ ...calendarForm, attendeeEmail: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={calendarForm.description}
                  onChange={(e) => setCalendarForm({ ...calendarForm, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleSendCalendarInvite}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Calendar Invite
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAction(null)}
              className="mb-2"
            >
              ← Back to actions
            </Button>

            <div className="space-y-3">
              <div>
                <Label htmlFor="taskTitle">Task Title</Label>
                <Input
                  id="taskTitle"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="taskDue">Due Date</Label>
                <Input
                  id="taskDue"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="taskDesc">Description</Label>
                <Textarea
                  id="taskDesc"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleCreateTask}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckSquare className="h-4 w-4 mr-2" />
                )}
                Create Task
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
