import { Link2, Calendar, Presentation, Palette, Briefcase, Home, Users, UserCircle, ChevronDown } from "lucide-react";
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

// All available links with contextual messages
const LINKS_CONFIG = {
  presentations: {
    designer: {
      label: "Designer Presentation",
      url: "https://propertycentral.lovable.app/p/designer",
      icon: Palette,
      contextMessage: (firstName: string) => 
        `Hi ${firstName}, we work with an amazing designer named Ilana who helps transform properties that aren't fully furnished yet or need a refresh. She has a great eye for maximizing rental appeal. I'd love for you to see some of her work:\n\n${LINKS_CONFIG.presentations.designer.url}`,
    },
    onboarding: {
      label: "Onboarding Presentation",
      url: "https://propertycentral.lovable.app/p/onboarding",
      icon: Briefcase,
      contextMessage: (firstName: string) => 
        `Hi ${firstName}, I wanted to share our onboarding presentation with you. It explains how we work and what you can expect when partnering with PeachHaus. I think you'll find it really helpful to understand our process:\n\n${LINKS_CONFIG.presentations.onboarding.url}`,
    },
    ownerPortal: {
      label: "Owner Portal Presentation",
      url: "https://propertycentral.lovable.app/p/owner-portal",
      icon: Home,
      contextMessage: (firstName: string) => 
        `Hi ${firstName}, we have a top-notch owner portal that gives you complete transparency into your property's performance. I'd love for you to see how everything looks and works:\n\n${LINKS_CONFIG.presentations.ownerPortal.url}`,
    },
  },
  calendar: {
    discovery: {
      label: "Discovery Call",
      url: "https://propertycentral.lovable.app/book-discovery-call",
      icon: Users,
      contextMessage: (firstName: string) => 
        `Hi ${firstName}, I'd love to chat more about your property and how we can help. Feel free to book a discovery call at your convenience:\n\n${LINKS_CONFIG.calendar.discovery.url}`,
    },
    owner: {
      label: "Owner Call",
      url: "https://propertycentral.lovable.app/book-owner-call",
      icon: UserCircle,
      contextMessage: (firstName: string) => 
        `Hi ${firstName}, let's schedule a call to discuss your property. You can book a time that works for you here:\n\n${LINKS_CONFIG.calendar.owner.url}`,
    },
  },
};

interface InsertLinksDropdownProps {
  onInsert: (text: string) => void;
  recipientName?: string;
  contactType?: "lead" | "owner";
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  disabled?: boolean;
}

export function InsertLinksDropdown({
  onInsert,
  recipientName = "",
  contactType,
  variant = "outline",
  size = "sm",
  disabled = false,
}: InsertLinksDropdownProps) {
  const firstName = recipientName?.split(" ")[0] || "there";

  const handleInsertPresentation = (key: keyof typeof LINKS_CONFIG.presentations) => {
    const config = LINKS_CONFIG.presentations[key];
    const message = config.contextMessage(firstName);
    onInsert(message);
    toast.success(`${config.label} added to message!`);
  };

  const handleInsertCalendar = (key: keyof typeof LINKS_CONFIG.calendar) => {
    const config = LINKS_CONFIG.calendar[key];
    const message = config.contextMessage(firstName);
    onInsert(message);
    toast.success(`${config.label} added to message!`);
  };

  const handleCopyPresentationLink = (key: keyof typeof LINKS_CONFIG.presentations) => {
    const config = LINKS_CONFIG.presentations[key];
    navigator.clipboard.writeText(config.url);
    toast.success(`${config.label} link copied!`);
  };

  const handleCopyCalendarLink = (key: keyof typeof LINKS_CONFIG.calendar) => {
    const config = LINKS_CONFIG.calendar[key];
    navigator.clipboard.writeText(config.url);
    toast.success(`${config.label} link copied!`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className="gap-1.5"
          disabled={disabled}
        >
          <Link2 className="h-4 w-4" />
          <span className="hidden sm:inline">Insert Link</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* Presentations Section */}
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Presentation className="h-3.5 w-3.5" />
          Presentations
        </DropdownMenuLabel>
        {(Object.keys(LINKS_CONFIG.presentations) as Array<keyof typeof LINKS_CONFIG.presentations>).map((key) => {
          const config = LINKS_CONFIG.presentations[key];
          const Icon = config.icon;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handleInsertPresentation(key)}
              className="flex items-start gap-2 py-2.5 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block">{config.label}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {key === "designer" && "For properties needing design help"}
                  {key === "onboarding" && "For owners not yet onboarded"}
                  {key === "ownerPortal" && "Show our owner portal features"}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Calendar Section */}
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Calendar Links
        </DropdownMenuLabel>
        {(Object.keys(LINKS_CONFIG.calendar) as Array<keyof typeof LINKS_CONFIG.calendar>).map((key) => {
          const config = LINKS_CONFIG.calendar[key];
          const Icon = config.icon;
          // Show appropriate calendar based on contact type
          if (contactType === "owner" && key === "discovery") return null;
          if (contactType === "lead" && key === "owner") return null;
          
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => handleInsertCalendar(key)}
              className="flex items-start gap-2 py-2.5 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {key === "discovery" && "For new leads and prospects"}
                  {key === "owner" && "For existing property owners"}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Copy Links Only */}
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Copy Link Only
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          {(Object.keys(LINKS_CONFIG.presentations) as Array<keyof typeof LINKS_CONFIG.presentations>).map((key) => {
            const config = LINKS_CONFIG.presentations[key];
            return (
              <Button
                key={`copy-${key}`}
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start"
                onClick={() => handleCopyPresentationLink(key)}
              >
                {config.label.replace(" Presentation", "")}
              </Button>
            );
          })}
          {(Object.keys(LINKS_CONFIG.calendar) as Array<keyof typeof LINKS_CONFIG.calendar>).map((key) => {
            const config = LINKS_CONFIG.calendar[key];
            return (
              <Button
                key={`copy-cal-${key}`}
                variant="ghost"
                size="sm"
                className="h-7 text-xs justify-start"
                onClick={() => handleCopyCalendarLink(key)}
              >
                {config.label}
              </Button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
