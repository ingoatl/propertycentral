import { useState } from "react";
import { ChevronDown, Inbox, Archive, AlertTriangle, FileEdit, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InboxFolder = "inbox" | "archived" | "spam" | "drafts" | "all";

interface InboxFolderSelectorProps {
  selectedFolder: InboxFolder;
  onFolderChange: (folder: InboxFolder) => void;
  archivedCount?: number;
}

const FOLDER_CONFIG: Record<InboxFolder, { label: string; icon: React.ElementType }> = {
  inbox: { label: "Inbox", icon: Inbox },
  archived: { label: "Archived", icon: Archive },
  spam: { label: "Spam", icon: AlertTriangle },
  drafts: { label: "Drafts", icon: FileEdit },
  all: { label: "All Mail", icon: Mail },
};

export function InboxFolderSelector({
  selectedFolder,
  onFolderChange,
  archivedCount = 0,
}: InboxFolderSelectorProps) {
  const [open, setOpen] = useState(false);
  const config = FOLDER_CONFIG[selectedFolder];
  const Icon = config.icon;

  const handleSelect = (folder: InboxFolder) => {
    onFolderChange(folder);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2 font-medium max-w-[100px]"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline text-xs truncate">{config.label}</span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => handleSelect("inbox")}
          className={cn(selectedFolder === "inbox" && "bg-accent")}
        >
          <Inbox className="h-4 w-4 mr-2" />
          Inbox
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("archived")}
          className={cn(selectedFolder === "archived" && "bg-accent")}
        >
          <Archive className="h-4 w-4 mr-2" />
          Archived
          {archivedCount > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">
              {archivedCount}
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSelect("spam")}
          className={cn(selectedFolder === "spam" && "bg-accent")}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Spam
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect("drafts")}
          className={cn(selectedFolder === "drafts" && "bg-accent")}
        >
          <FileEdit className="h-4 w-4 mr-2" />
          Drafts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleSelect("all")}
          className={cn(selectedFolder === "all" && "bg-accent")}
        >
          <Mail className="h-4 w-4 mr-2" />
          All Mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
