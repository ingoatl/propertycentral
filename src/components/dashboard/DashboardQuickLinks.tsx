import { Link2, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface LinkItem {
  label: string;
  url: string;
}

interface SeparatorItem {
  type: "separator";
}

type QuickLinkItem = LinkItem | SeparatorItem;

const QUICK_LINKS: QuickLinkItem[] = [
  { label: "Owner Pitch", url: "https://propertycentral.lovable.app/p/onboarding" },
  { label: "Designer Pitch", url: "https://propertycentral.lovable.app/p/designer" },
  { label: "Owner Portal", url: "https://propertycentral.lovable.app/p/owner-portal" },
  { type: "separator" },
  { label: "Discovery Call", url: "https://propertycentral.lovable.app/book-discovery-call" },
  { label: "Owner Call", url: "https://propertycentral.lovable.app/book-owner-call" },
];

function isSeparator(item: QuickLinkItem): item is SeparatorItem {
  return "type" in item && item.type === "separator";
}

export function DashboardQuickLinks() {
  const handleCopyLink = (label: string, url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} copied`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2">
          <Link2 className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background">
        {QUICK_LINKS.map((item, idx) => 
          isSeparator(item) ? (
            <DropdownMenuSeparator key={idx} />
          ) : (
            <DropdownMenuItem
              key={item.label}
              onClick={() => handleCopyLink(item.label, item.url)}
              className="flex items-center justify-between py-1.5 cursor-pointer text-sm"
            >
              <span>{item.label}</span>
              <Copy className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
