import { Link2, Copy, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useState } from "react";

interface OwnerMagicLinkButtonProps {
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
}

export function OwnerMagicLinkButton({
  ownerName,
  ownerEmail,
  ownerPhone,
}: OwnerMagicLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const generateMagicLink = () => {
    const params = new URLSearchParams();
    params.set("name", ownerName);
    params.set("email", ownerEmail);
    if (ownerPhone) params.set("phone", ownerPhone);
    
    return `https://propertycentral.lovable.app/book-owner-call?${params.toString()}`;
  };

  const handleCopyLink = async () => {
    const link = generateMagicLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Magic link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleOpenLink = () => {
    const link = generateMagicLink();
    window.open(link, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Schedule Call</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span>{copied ? "Copied!" : "Copy Magic Link"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenLink} className="gap-2">
          <Link2 className="h-4 w-4" />
          <span>Open Booking Page</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
