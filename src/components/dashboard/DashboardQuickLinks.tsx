import { Link2, Calendar, Presentation, Palette, Home, Users, UserCircle, ChevronDown, Copy, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const QUICK_LINKS = {
  presentations: [
    {
      label: "Owner Pitch",
      url: "https://propertycentral.lovable.app/p/onboarding",
      icon: Briefcase,
      description: "Onboarding presentation for new owners"
    },
    {
      label: "Designer Pitch", 
      url: "https://propertycentral.lovable.app/p/designer",
      icon: Palette,
      description: "Design services presentation"
    },
    {
      label: "Owner Portal",
      url: "https://propertycentral.lovable.app/p/owner-portal",
      icon: Home,
      description: "Portal features overview"
    }
  ],
  calendar: [
    {
      label: "Discovery Call",
      url: "https://propertycentral.lovable.app/book-discovery-call",
      icon: Users,
      description: "For new leads and prospects"
    },
    {
      label: "Owner Call",
      url: "https://propertycentral.lovable.app/book-owner-call",
      icon: UserCircle,
      description: "For existing property owners"
    }
  ]
};

export function DashboardQuickLinks() {
  const handleCopyLink = (label: string, url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} link copied!`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Link2 className="h-4 w-4" />
          <span className="hidden sm:inline">Links</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background">
        {/* Presentations Section */}
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Presentation className="h-3.5 w-3.5" />
          Presentations
        </DropdownMenuLabel>
        {QUICK_LINKS.presentations.map((link) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem
              key={link.label}
              onClick={() => handleCopyLink(link.label, link.url)}
              className="flex items-start gap-2 py-2 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-sm">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </div>
              <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Calendar Links Section */}
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Calendar Links
        </DropdownMenuLabel>
        {QUICK_LINKS.calendar.map((link) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem
              key={link.label}
              onClick={() => handleCopyLink(link.label, link.url)}
              className="flex items-start gap-2 py-2 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-sm">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </div>
              <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
