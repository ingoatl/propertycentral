import { useAIDraftReplies } from "@/hooks/useAIDraftReplies";
import { AIDraftReplyCard } from "./AIDraftReplyCard";

interface AIDraftReplySectionProps {
  contactPhone?: string;
  contactEmail?: string;
  leadId?: string;
  ownerId?: string;
  onSend: (message: string) => void;
  isSending: boolean;
}

export function AIDraftReplySection({
  contactPhone,
  contactEmail,
  leadId,
  ownerId,
  onSend,
  isSending,
}: AIDraftReplySectionProps) {
  const { 
    pendingDraft, 
    isLoading, 
    dismissDraft, 
    isDismissing,
    regenerateDraft,
    isRegenerating,
  } = useAIDraftReplies(
    contactPhone,
    contactEmail,
    leadId,
    ownerId
  );

  if (isLoading || !pendingDraft) {
    return null;
  }

  const handleRegenerate = (presentationContext?: string) => {
    regenerateDraft({
      draftId: pendingDraft.id,
      presentationContext,
    });
  };

  return (
    <AIDraftReplyCard
      draftId={pendingDraft.id}
      draftContent={pendingDraft.draft_content}
      confidenceScore={pendingDraft.confidence_score}
      onSend={onSend}
      onDismiss={() => dismissDraft(pendingDraft.id)}
      onRegenerate={handleRegenerate}
      isSending={isSending}
      isRegenerating={isRegenerating}
      leadId={leadId}
      ownerId={ownerId}
      contactPhone={contactPhone}
      contactEmail={contactEmail}
    />
  );
}