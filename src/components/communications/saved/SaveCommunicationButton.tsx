import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveCommunicationModal } from "./SaveCommunicationModal";

interface SaveCommunicationButtonProps {
  messageId: string;
  messageType: "email" | "sms" | "call" | "personal_sms" | "personal_call";
  threadId?: string;
  messageContent: string;
  messageSubject?: string;
  messageSnippet?: string;
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  messageDate: string;
  propertyId?: string;
  leadId?: string;
  ownerId?: string;
  compact?: boolean;
}

export function SaveCommunicationButton({
  messageId,
  messageType,
  threadId,
  messageContent,
  messageSubject,
  messageSnippet,
  senderName,
  senderEmail,
  senderPhone,
  messageDate,
  propertyId,
  leadId,
  ownerId,
  compact = false,
}: SaveCommunicationButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className={compact ? "h-7 px-2 gap-1" : "gap-2"}
        title="Save this message"
      >
        <Bookmark className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {!compact && <span>Save</span>}
      </Button>

      <SaveCommunicationModal
        open={showModal}
        onOpenChange={setShowModal}
        messageId={messageId}
        messageType={messageType}
        threadId={threadId}
        messageContent={messageContent}
        messageSubject={messageSubject}
        messageSnippet={messageSnippet}
        senderName={senderName}
        senderEmail={senderEmail}
        senderPhone={senderPhone}
        messageDate={messageDate}
        propertyId={propertyId}
        leadId={leadId}
        ownerId={ownerId}
      />
    </>
  );
}
