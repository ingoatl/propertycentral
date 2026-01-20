import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, Mic, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallDialog } from "./CallDialog";
import { SendSMSDialog } from "./SendSMSDialog";
import { SendVoicemailDialog } from "./SendVoicemailDialog";
import { MeetingsDialog } from "./MeetingsDialog";

interface CommunicationActionButtonsProps {
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactType?: 'lead' | 'owner' | 'vendor';
  contactId?: string;
  contactAddress?: string | null;
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

export function CommunicationActionButtons({
  contactName,
  contactPhone,
  contactEmail,
  contactType = 'lead',
  contactId,
  contactAddress,
  className,
  variant = 'default',
}: CommunicationActionButtonsProps) {
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showVoicemailDialog, setShowVoicemailDialog] = useState(false);
  const [showMeetingsDialog, setShowMeetingsDialog] = useState(false);

  const hasPhone = !!contactPhone;

  // Compact design for card variant - icon only buttons in a row
  if (variant === 'card') {
    return (
      <>
        <div className={cn("flex gap-2", className)}>
          <Button
            size="sm"
            className={cn(
              "h-9 w-9 p-0 rounded-lg",
              hasPhone 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (hasPhone) setShowCallDialog(true);
            }}
            disabled={!hasPhone}
            title="Call"
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-9 w-9 p-0 rounded-lg",
              !hasPhone && "cursor-not-allowed opacity-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (hasPhone) setShowSmsDialog(true);
            }}
            disabled={!hasPhone}
            title="Text"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-9 w-9 p-0 rounded-lg",
              !hasPhone && "cursor-not-allowed opacity-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (hasPhone) setShowVoicemailDialog(true);
            }}
            disabled={!hasPhone}
            title="Voice"
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              setShowMeetingsDialog(true);
            }}
            title="Video"
          >
            <Video className="h-4 w-4" />
          </Button>
        </div>

        {/* Dialogs */}
        {contactPhone && (
          <>
            <CallDialog
              open={showCallDialog}
              onOpenChange={setShowCallDialog}
              contactName={contactName}
              contactPhone={contactPhone}
              contactType={contactType === 'owner' ? 'owner' : 'lead'}
              contactAddress={contactAddress}
            />
            <SendSMSDialog
              open={showSmsDialog}
              onOpenChange={setShowSmsDialog}
              contactPhone={contactPhone}
              contactName={contactName}
              contactType={contactType}
              contactId={contactId}
            />
            <SendVoicemailDialog
              open={showVoicemailDialog}
              onOpenChange={setShowVoicemailDialog}
              recipientPhone={contactPhone}
              recipientName={contactName}
            />
          </>
        )}
        <MeetingsDialog
          open={showMeetingsDialog}
          onOpenChange={setShowMeetingsDialog}
          contactName={contactName}
          contactEmail={contactEmail}
        />
      </>
    );
  }

  // Default layout with labels
  const buttonClasses = cn(
    "flex flex-col items-center justify-center gap-1 transition-all",
    variant === 'default' && "h-14 w-14 rounded-xl",
    variant === 'compact' && "h-10 w-10 rounded-lg"
  );

  const iconSize = variant === 'compact' ? "h-4 w-4" : "h-4 w-4";
  const textSize = "text-[10px]";

  const buttons = [
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      onClick: () => setShowCallDialog(true),
      disabled: !hasPhone,
      activeColor: 'bg-primary hover:bg-primary/90 text-primary-foreground',
      disabledColor: 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
    },
    {
      id: 'text',
      label: 'Text',
      icon: MessageSquare,
      onClick: () => setShowSmsDialog(true),
      disabled: !hasPhone,
      activeColor: 'bg-background hover:bg-muted border border-border text-foreground',
      disabledColor: 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
    },
    {
      id: 'voice',
      label: 'Voice',
      icon: Mic,
      onClick: () => setShowVoicemailDialog(true),
      disabled: !hasPhone,
      activeColor: 'bg-background hover:bg-muted border border-border text-foreground',
      disabledColor: 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
    },
    {
      id: 'video',
      label: 'Video',
      icon: Video,
      onClick: () => setShowMeetingsDialog(true),
      disabled: false,
      activeColor: 'bg-background hover:bg-muted border border-border text-foreground',
      disabledColor: 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
    },
  ];

  return (
    <>
      <div className={cn("flex gap-2", className)}>
        {buttons.map((btn) => (
          <Button
            key={btn.id}
            variant="ghost"
            className={cn(
              buttonClasses,
              btn.disabled ? btn.disabledColor : btn.activeColor
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!btn.disabled) btn.onClick();
            }}
            disabled={btn.disabled}
          >
            <btn.icon className={iconSize} />
            <span className={cn(textSize, "font-medium")}>{btn.label}</span>
          </Button>
        ))}
      </div>

      {/* Dialogs */}
      {contactPhone && (
        <>
          <CallDialog
            open={showCallDialog}
            onOpenChange={setShowCallDialog}
            contactName={contactName}
            contactPhone={contactPhone}
            contactType={contactType === 'owner' ? 'owner' : 'lead'}
            contactAddress={contactAddress}
          />

          <SendSMSDialog
            open={showSmsDialog}
            onOpenChange={setShowSmsDialog}
            contactPhone={contactPhone}
            contactName={contactName}
            contactType={contactType}
            contactId={contactId}
          />

          <SendVoicemailDialog
            open={showVoicemailDialog}
            onOpenChange={setShowVoicemailDialog}
            recipientPhone={contactPhone}
            recipientName={contactName}
          />
        </>
      )}

      <MeetingsDialog
        open={showMeetingsDialog}
        onOpenChange={setShowMeetingsDialog}
        contactName={contactName}
        contactEmail={contactEmail}
      />
    </>
  );
}
