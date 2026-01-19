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

  const buttonClasses = cn(
    "flex flex-col items-center justify-center gap-1 transition-all",
    variant === 'default' && "h-16 w-16 rounded-2xl",
    variant === 'compact' && "h-12 w-12 rounded-xl",
    variant === 'card' && "h-14 flex-1 min-w-[60px] rounded-xl"
  );

  const iconSize = variant === 'compact' ? "h-4 w-4" : "h-5 w-5";
  const textSize = variant === 'compact' ? "text-[10px]" : "text-xs";

  const buttons = [
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      onClick: () => setShowCallDialog(true),
      disabled: !hasPhone,
      activeColor: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25',
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
      disabled: false, // Video/meetings is always available
      activeColor: 'bg-background hover:bg-muted border border-border text-foreground',
      disabledColor: 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
    },
  ];

  return (
    <>
      <div className={cn(
        "flex gap-2",
        variant === 'card' && "w-full",
        className
      )}>
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
