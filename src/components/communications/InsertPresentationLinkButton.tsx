import { Presentation, ChevronDown, Palette, Home, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const PRESENTATION_LINKS = {
  designer: {
    label: "Designer Presentation",
    url: "https://propertycentral.lovable.app/p/designer",
    description: "Professional design services showcase",
    icon: Palette,
  },
  onboarding: {
    label: "Onboarding Presentation",
    url: "https://propertycentral.lovable.app/p/onboarding",
    description: "Full-service property management overview",
    icon: Briefcase,
  },
  ownerPortal: {
    label: "Owner Portal Presentation",
    url: "https://propertycentral.lovable.app/p/owner-portal",
    description: "Owner portal features & transparency",
    icon: Home,
  },
};

interface InsertPresentationLinkButtonProps {
  onInsert: (link: string, label: string) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

export function InsertPresentationLinkButton({
  onInsert,
  variant = "outline",
  size = "sm",
}: InsertPresentationLinkButtonProps) {
  const handleInsert = (type: keyof typeof PRESENTATION_LINKS) => {
    const link = PRESENTATION_LINKS[type];
    const formattedLink = `\n\nWatch our presentation: ${link.url}\n`;
    onInsert(formattedLink, link.label);
    toast.success(`${link.label} link copied!`);
  };

  const handleCopyOnly = (type: keyof typeof PRESENTATION_LINKS) => {
    const link = PRESENTATION_LINKS[type];
    navigator.clipboard.writeText(link.url);
    toast.success(`${link.label} link copied to clipboard!`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size={size} className="gap-1.5">
          <Presentation className="h-4 w-4" />
          <span className="hidden sm:inline">Presentations</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Insert into message
        </div>
        {Object.entries(PRESENTATION_LINKS).map(([key, link]) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handleInsert(key as keyof typeof PRESENTATION_LINKS)}
              className="flex flex-col items-start gap-1 py-2"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{link.label}</span>
              </div>
              <span className="text-xs text-muted-foreground pl-6">
                {link.description}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Copy link only
        </div>
        {Object.entries(PRESENTATION_LINKS).map(([key, link]) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem
              key={`copy-${key}`}
              onClick={() => handleCopyOnly(key as keyof typeof PRESENTATION_LINKS)}
              className="text-sm py-1.5"
            >
              <Icon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              Copy {link.label} URL
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
