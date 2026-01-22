import { Calendar, ChevronDown, Users, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const CALENDAR_LINKS = {
  discovery: {
    label: "Lead Discovery Call",
    url: "https://propertycentral.lovable.app/book-discovery-call",
    description: "For new leads and prospects",
    icon: Users,
  },
  owner: {
    label: "Owner Call",
    url: "https://propertycentral.lovable.app/book-owner-call",
    description: "For existing property owners",
    icon: UserCircle,
  },
};

interface InsertCalendarLinkButtonProps {
  onInsert: (link: string, label: string) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  contactType?: "lead" | "owner";
}

export function InsertCalendarLinkButton({
  onInsert,
  variant = "outline",
  size = "sm",
  contactType,
}: InsertCalendarLinkButtonProps) {
  const handleInsert = (type: "discovery" | "owner") => {
    const link = CALENDAR_LINKS[type];
    const formattedLink = `\n\nSchedule a call: ${link.url}\n`;
    onInsert(formattedLink, link.label);
    toast.success(`${link.label} link inserted`);
  };

  // If contact type is known, show a simple button
  if (contactType === "owner") {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => handleInsert("owner")}
        className="gap-1.5"
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">Add Calendar Link</span>
      </Button>
    );
  }

  if (contactType === "lead") {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => handleInsert("discovery")}
        className="gap-1.5"
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">Add Calendar Link</span>
      </Button>
    );
  }

  // Show dropdown for unknown contact type
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size={size} className="gap-1.5">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Calendar Link</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {Object.entries(CALENDAR_LINKS).map(([key, link]) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handleInsert(key as "discovery" | "owner")}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
