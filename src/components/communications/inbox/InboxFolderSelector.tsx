import { useState } from "react";
import { ChevronDown, Inbox, Archive, Trash2, FileText, Mail, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type InboxFolder = "inbox" | "sent" | "archived" | "spam" | "drafts" | "all";

interface InboxFolderSelectorProps {
  selectedFolder: InboxFolder;
  onFolderChange: (folder: InboxFolder) => void;
  archivedCount?: number;
  sentCount?: number;
}

const FOLDER_CONFIG: Record<InboxFolder, { label: string; icon: React.ElementType }> = {
  inbox: { label: "Inbox", icon: Inbox },
  sent: { label: "Sent", icon: Send },
  archived: { label: "Archived", icon: Archive },
  spam: { label: "Spam", icon: Trash2 },
  drafts: { label: "Drafts", icon: FileText },
  all: { label: "All Mail", icon: Mail },
};

export function InboxFolderSelector({ 
  selectedFolder, 
  onFolderChange,
  archivedCount,
  sentCount,
}: InboxFolderSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (folder: InboxFolder) => {
    onFolderChange(folder);
    setOpen(false);
  };

  const currentConfig = FOLDER_CONFIG[selectedFolder];
  const CurrentIcon = currentConfig.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8">
          <CurrentIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{currentConfig.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => handleSelect("inbox")}
          className={`gap-2 ${selectedFolder === "inbox" ? "bg-accent" : ""}`}
        >
          <Inbox className="h-4 w-4" />
          <span className="flex-1">Inbox</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("sent")}
          className={`gap-2 ${selectedFolder === "sent" ? "bg-accent" : ""}`}
        >
          <Send className="h-4 w-4" />
          <span className="flex-1">Sent</span>
          {sentCount !== undefined && sentCount > 0 && (
            <span className="text-xs text-muted-foreground">{sentCount}</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSelect("archived")}
          className={`gap-2 ${selectedFolder === "archived" ? "bg-accent" : ""}`}
        >
          <Archive className="h-4 w-4" />
          <span className="flex-1">Archived</span>
          {archivedCount !== undefined && archivedCount > 0 && (
            <span className="text-xs text-muted-foreground">{archivedCount}</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("spam")}
          className={`gap-2 ${selectedFolder === "spam" ? "bg-accent" : ""}`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="flex-1">Spam</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("drafts")}
          className={`gap-2 ${selectedFolder === "drafts" ? "bg-accent" : ""}`}
        >
          <FileText className="h-4 w-4" />
          <span className="flex-1">Drafts</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSelect("all")}
          className={`gap-2 ${selectedFolder === "all" ? "bg-accent" : ""}`}
        >
          <Mail className="h-4 w-4" />
          <span className="flex-1">All Mail</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}