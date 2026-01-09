import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Video, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CallSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");

  const handleSyncCalls = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ghl-calls");

      if (error) throw error;

      toast.success(data.message || "Calls synced successfully!");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync calls");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (!meetingUrl) {
      toast.error("Please enter a meeting URL");
      return;
    }

    setIsJoiningMeeting(true);
    try {
      const { data, error } = await supabase.functions.invoke("recall-send-bot", {
        body: {
          meetingUrl,
          meetingTitle: meetingTitle || "Meeting Recording",
        },
      });

      if (error) throw error;

      toast.success(data.message || "Bot is joining the meeting!");
      setShowMeetingDialog(false);
      setMeetingUrl("");
      setMeetingTitle("");
    } catch (error) {
      console.error("Join meeting error:", error);
      toast.error("Failed to join meeting. Make sure RECALL_API_KEY is configured.");
    } finally {
      setIsJoiningMeeting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Sync Calls
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Call Sources</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSyncCalls} disabled={isSyncing}>
            <Phone className="h-4 w-4 mr-2" />
            Sync Phone Calls (GHL)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMeetingDialog(true)}>
            <Video className="h-4 w-4 mr-2" />
            Record Zoom/Meet Call
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Record Video Meeting
            </DialogTitle>
            <DialogDescription>
              Enter the meeting URL to have our AI assistant join and take notes.
              Supports Zoom, Google Meet, Microsoft Teams, and WebEx.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meeting-url">Meeting URL *</Label>
              <Input
                id="meeting-url"
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-title">Meeting Title (optional)</Label>
              <Input
                id="meeting-title"
                placeholder="Weekly check-in with owner"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoinMeeting} disabled={isJoiningMeeting || !meetingUrl}>
              {isJoiningMeeting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Send Bot to Meeting
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
