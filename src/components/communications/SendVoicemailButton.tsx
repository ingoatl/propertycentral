import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { SendVoicemailDialog } from "./SendVoicemailDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SendVoicemailButtonProps {
  recipientPhone: string;
  recipientName: string;
  leadId?: string;
  ownerId?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Allow editing recipient name for manual dial scenarios */
  allowNameEdit?: boolean;
}

export function SendVoicemailButton({
  recipientPhone,
  recipientName,
  leadId,
  ownerId,
  variant = "outline",
  size = "sm",
  className,
  allowNameEdit = false,
}: SendVoicemailButtonProps) {
  const [open, setOpen] = useState(false);

  if (!recipientPhone) return null;

  const isIconOnly = size === "icon";

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={() => setOpen(true)}
      className={className}
    >
      <Mic className={isIconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
      {!isIconOnly && "Voice Message"}
    </Button>
  );

  return (
    <>
      {isIconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>Send Voice Message</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      <SendVoicemailDialog
        open={open}
        onOpenChange={setOpen}
        recipientPhone={recipientPhone}
        recipientName={recipientName}
        leadId={leadId}
        ownerId={ownerId}
        allowNameEdit={allowNameEdit}
      />
    </>
  );
}
