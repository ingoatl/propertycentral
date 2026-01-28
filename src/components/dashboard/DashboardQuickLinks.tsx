import { Link2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const QUICK_LINKS = [
  { label: "Owner Pitch", url: "https://propertycentral.lovable.app/p/onboarding" },
  { label: "Designer Pitch", url: "https://propertycentral.lovable.app/p/designer" },
  { label: "Owner Portal", url: "https://propertycentral.lovable.app/p/owner-portal" },
  { label: "Discovery Call", url: "https://propertycentral.lovable.app/book-discovery-call" },
  { label: "Owner Call", url: "https://propertycentral.lovable.app/book-owner-call" },
];

export function DashboardQuickLinks() {
  const handleCopyLink = (label: string, url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} copied`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
          <Link2 className="h-3 w-3" />
          Links
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-background">
        {QUICK_LINKS.map((link) => (
          <DropdownMenuItem
            key={link.label}
            onClick={() => handleCopyLink(link.label, link.url)}
            className="flex items-center justify-between py-1 cursor-pointer text-xs"
          >
            <span>{link.label}</span>
            <Copy className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
