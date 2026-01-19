import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Mail, Phone, Building, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Participant {
  name: string;
  email?: string;
}

interface MeetingRecording {
  id: string;
  meeting_title: string | null;
  transcript: string | null;
  participants: Participant[];
  communication_id: string | null;
}

interface CreateLeadFromMeetingDialogProps {
  meeting: MeetingRecording;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLeadFromMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: CreateLeadFromMeetingDialogProps) {
  const participants = meeting.participants || [];
  const [selectedParticipant, setSelectedParticipant] = useState<string>(
    participants[0]?.email || participants[0]?.name || ""
  );
  const [name, setName] = useState(participants[0]?.name || "");
  const [email, setEmail] = useState(participants[0]?.email || "");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState(
    `Source: Video Meeting - ${meeting.meeting_title || "Untitled Meeting"}`
  );

  const queryClient = useQueryClient();

  const createLeadMutation = useMutation({
    mutationFn: async () => {
      // Create the lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name,
          email: email || null,
          phone: phone || null,
          notes,
          source: "Video Meeting",
          status: "new",
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Link the communication to the lead if we have one
      if (meeting.communication_id && lead) {
        await supabase
          .from("lead_communications")
          .update({ lead_id: lead.id })
          .eq("id", meeting.communication_id);

        // Also update the meeting recording
        await supabase
          .from("meeting_recordings")
          .update({ matched_lead_id: lead.id })
          .eq("id", meeting.id);
      }

      return lead;
    },
    onSuccess: (lead) => {
      toast.success(`Lead "${name}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["meeting-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create lead: ${error.message}`);
    },
  });

  const handleParticipantChange = (value: string) => {
    setSelectedParticipant(value);
    const participant = participants.find(
      (p) => p.email === value || p.name === value
    );
    if (participant) {
      setName(participant.name);
      setEmail(participant.email || "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Lead from Meeting Participant
          </DialogTitle>
          <DialogDescription>
            Create a new lead from a video meeting participant. The meeting transcript
            will be linked to this lead.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Participant Selector */}
          {participants.length > 1 && (
            <div className="grid gap-2">
              <Label>Select Participant</Label>
              <Select
                value={selectedParticipant}
                onValueChange={handleParticipantChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a participant" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p, idx) => (
                    <SelectItem key={idx} value={p.email || p.name}>
                      {p.name} {p.email && `(${p.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
            />
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="pl-9"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="pl-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this lead..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createLeadMutation.mutate()}
            disabled={!name || createLeadMutation.isPending}
          >
            {createLeadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Create Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
