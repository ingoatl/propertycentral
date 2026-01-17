import { useState } from "react";
import { Bell, Clock, CheckCircle, X, RotateCcw, Mail, MessageSquare, Calendar, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFollowUpReminders, FollowUpReminder } from "@/hooks/useFollowUpReminders";
import { formatDistanceToNow, format, addDays, addHours } from "date-fns";
import { cn } from "@/lib/utils";

interface ReminderItemProps {
  reminder: FollowUpReminder;
  onComplete: () => void;
  onDismiss: () => void;
  onSnooze: (hours: number) => void;
}

function ReminderItem({ reminder, onComplete, onDismiss, onSnooze }: ReminderItemProps) {
  const isDue = new Date(reminder.remind_at) <= new Date();
  
  return (
    <div className={cn(
      "p-3 border rounded-lg transition-colors",
      isDue ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900" : "hover:bg-muted/50"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {reminder.reminder_type === "email" ? (
              <Mail className="h-4 w-4 text-blue-500" />
            ) : (
              <MessageSquare className="h-4 w-4 text-green-500" />
            )}
            <span className="font-medium text-sm truncate">
              {reminder.contact_name || "Unknown Contact"}
            </span>
            {isDue && (
              <Badge variant="destructive" className="text-xs">
                Due now
              </Badge>
            )}
          </div>
          
          {reminder.suggested_draft && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              Draft: {reminder.suggested_draft}
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {isDue 
                ? `Due ${formatDistanceToNow(new Date(reminder.remind_at), { addSuffix: true })}`
                : format(new Date(reminder.remind_at), "MMM d 'at' h:mm a")
              }
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-green-600"
            onClick={onComplete}
            title="Mark complete"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Snooze"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSnooze(1)}>
                <Clock className="h-4 w-4 mr-2" />
                1 hour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(4)}>
                <Clock className="h-4 w-4 mr-2" />
                4 hours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(24)}>
                <Calendar className="h-4 w-4 mr-2" />
                Tomorrow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSnooze(72)}>
                <Calendar className="h-4 w-4 mr-2" />
                3 days
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={onDismiss}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CreateReminderFormProps {
  onSave: (data: Partial<FollowUpReminder>) => void;
  onCancel: () => void;
}

function CreateReminderForm({ onSave, onCancel }: CreateReminderFormProps) {
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [remindIn, setRemindIn] = useState("24");
  const [suggestedDraft, setSuggestedDraft] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const remindAt = addHours(new Date(), parseInt(remindIn)).toISOString();
    onSave({
      contact_name: contactName,
      contact_email: contactEmail,
      remind_at: remindAt,
      suggested_draft: suggestedDraft || undefined,
      reminder_type: contactEmail ? "email" : "sms",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Contact Name</label>
        <Input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="John Doe"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Email (optional)</label>
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="john@example.com"
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Remind me in</label>
        <select
          value={remindIn}
          onChange={(e) => setRemindIn(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="1">1 hour</option>
          <option value="4">4 hours</option>
          <option value="24">1 day</option>
          <option value="48">2 days</option>
          <option value="72">3 days</option>
          <option value="168">1 week</option>
        </select>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Follow-up draft (optional)</label>
        <Input
          value={suggestedDraft}
          onChange={(e) => setSuggestedDraft(e.target.value)}
          placeholder="Hey, just following up..."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Reminder</Button>
      </div>
    </form>
  );
}

export function FollowUpRemindersPanel() {
  const {
    dueReminders,
    upcomingReminders,
    isLoading,
    createReminder,
    completeReminder,
    dismissReminder,
    snoozeReminder,
  } = useFollowUpReminders();
  const [showCreate, setShowCreate] = useState(false);

  const totalCount = dueReminders.length + upcomingReminders.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Follow-up Reminders</CardTitle>
            {dueReminders.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {dueReminders.length} due
              </Badge>
            )}
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Follow-up Reminder</DialogTitle>
              </DialogHeader>
              <CreateReminderForm
                onSave={(data) => {
                  createReminder(data);
                  setShowCreate(false);
                }}
                onCancel={() => setShowCreate(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : totalCount === 0 ? (
          <div className="text-center py-6">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No follow-up reminders. You're all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {/* Due Reminders */}
            {dueReminders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Due Now
                </h4>
                {dueReminders.map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onComplete={() => completeReminder(reminder.id)}
                    onDismiss={() => dismissReminder(reminder.id)}
                    onSnooze={(hours) => snoozeReminder({ id: reminder.id, hours })}
                  />
                ))}
              </div>
            )}

            {/* Upcoming Reminders */}
            {upcomingReminders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Upcoming
                </h4>
                {upcomingReminders.slice(0, 5).map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onComplete={() => completeReminder(reminder.id)}
                    onDismiss={() => dismissReminder(reminder.id)}
                    onSnooze={(hours) => snoozeReminder({ id: reminder.id, hours })}
                  />
                ))}
                {upcomingReminders.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{upcomingReminders.length - 5} more upcoming
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
