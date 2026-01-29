import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const QUICK_LINKS = [
  { label: "Owner Pitch", url: "https://propertycentral.lovable.app/p/onboarding" },
  { label: "Designer", url: "https://propertycentral.lovable.app/p/designer" },
  { label: "Portal", url: "https://propertycentral.lovable.app/p/owner-portal" },
  { label: "Discovery", url: "https://propertycentral.lovable.app/book-discovery-call" },
  { label: "Owner Call", url: "https://propertycentral.lovable.app/book-owner-call" },
];

export function DashboardQuickLinks() {
  const handleCopyLink = (label: string, url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} copied`);
  };

  return (
    <div className="flex items-center gap-1">
      {QUICK_LINKS.map((link) => (
        <Button
          key={link.label}
          variant="ghost"
          size="sm"
          onClick={() => handleCopyLink(link.label, link.url)}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          {link.label}
          <Copy className="h-2.5 w-2.5" />
        </Button>
      ))}
    </div>
  );
}
