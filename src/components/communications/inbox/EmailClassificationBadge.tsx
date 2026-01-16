import { Sparkles, Megaphone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  type EmailClassification, 
  getClassificationColor, 
  getClassificationLabel 
} from "@/hooks/useEmailClassification";

interface EmailClassificationBadgeProps {
  classification: EmailClassification;
  compact?: boolean;
}

export function EmailClassificationBadge({ 
  classification, 
  compact = false 
}: EmailClassificationBadgeProps) {
  const colors = getClassificationColor(classification);
  const label = getClassificationLabel(classification);
  
  if (!label) return null;
  
  const Icon = classification === "important" ? Sparkles : 
               classification === "promotional" ? Megaphone : Mail;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1 rounded-full text-[10px] font-medium",
        compact ? "px-1.5 py-0.5" : "px-2 py-1",
        colors.badgeClass
      )}
    >
      <Icon className={cn("flex-shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
      {!compact && <span>{label}</span>}
    </span>
  );
}
