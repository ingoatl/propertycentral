import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Video, RefreshCw, Copy, ExternalLink, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface MeetingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName?: string;
  contactEmail?: string | null;
}

export function MeetingsDialog({
  open,
  onOpenChange,
  contactName,
  contactEmail,
}: MeetingsDialogProps) {
  const DEFAULT_MEETING_URL = "https://meet.google.com/jww-deey-iaa";
  const [meetingUrl, setMeetingUrl] = useState(DEFAULT_MEETING_URL);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const isMobile = useIsMobile();

  const handleRecordMeeting = async () => {
    if (!meetingUrl) {
      toast.error("Please enter a meeting URL");
      return;
    }

    // Validate URL format
    const validDomains = ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'webex.com'];
    const isValidUrl = validDomains.some(domain => meetingUrl.includes(domain));
    
    if (!isValidUrl) {
      toast.error("Please enter a valid Zoom, Google Meet, Teams, or WebEx URL");
      return;
    }

    setIsJoiningMeeting(true);
    try {
      const { data, error } = await supabase.functions.invoke("recall-send-bot", {
        body: {
          meetingUrl,
          meetingTitle: meetingTitle || `Meeting with ${contactName || 'Contact'}`,
          contactEmail,
        },
      });

      if (error) throw error;

      toast.success(data.message || "AI bot is joining the meeting to record!");
      onOpenChange(false);
      setMeetingUrl(DEFAULT_MEETING_URL);
      setMeetingTitle("");
    } catch (error) {
      console.error("Join meeting error:", error);
      toast.error("Failed to join meeting. Please check the URL and try again.");
    } finally {
      setIsJoiningMeeting(false);
    }
  };

  const handleCopyLink = () => {
    if (meetingUrl) {
      navigator.clipboard.writeText(meetingUrl);
      toast.success("Meeting link copied!");
    }
  };

  const handleOpenLink = () => {
    if (meetingUrl) {
      window.open(meetingUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "gap-0",
        isMobile && "fixed inset-0 w-full h-full max-w-none max-h-none rounded-none m-0"
      )}>
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <span>Video Meetings</span>
              {contactName && (
                <p className="text-sm font-normal text-muted-foreground">with {contactName}</p>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Record video meetings with AI transcription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meeting URL Input */}
          <div className="space-y-2">
            <Label htmlFor="meeting-url" className="text-sm font-medium">
              Meeting URL
            </Label>
            <div className="relative">
              <Input
                id="meeting-url"
                placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="pr-20"
              />
              {meetingUrl && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopyLink}
                    title="Copy link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleOpenLink}
                    title="Open link"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {meetingUrl === DEFAULT_MEETING_URL && (
              <p className="text-xs text-primary font-medium">
                ✓ Using PeachHaus permanent meeting room
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Supports Zoom, Google Meet, Microsoft Teams, and WebEx
            </p>
          </div>

          {/* Meeting Title */}
          <div className="space-y-2">
            <Label htmlFor="meeting-title" className="text-sm font-medium">
              Meeting Title (optional)
            </Label>
            <Input
              id="meeting-title"
              placeholder="Discovery call, Follow-up meeting..."
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </div>

          {/* Record Button */}
          <Button
            className="w-full h-12 text-base font-semibold bg-red-500 hover:bg-red-600 text-white"
            onClick={handleRecordMeeting}
            disabled={isJoiningMeeting || !meetingUrl}
          >
            {isJoiningMeeting ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Sending Bot...
              </>
            ) : (
              <>
                <Circle className="h-5 w-5 mr-2 fill-current" />
                Record Meeting
              </>
            )}
          </Button>

          {/* Info Card */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">How it works</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="h-4 w-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <span>Our AI bot will join your meeting as a participant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-4 w-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <span>The meeting will be recorded and transcribed automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="h-4 w-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                <span>View the transcript in your Communications inbox</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
