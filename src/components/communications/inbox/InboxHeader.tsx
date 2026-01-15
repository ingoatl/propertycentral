import { Search, Keyboard, Plus, Mail, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { TeamNotificationBell } from "../TeamNotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InboxHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  showKeyboardHelp: boolean;
  onToggleKeyboardHelp: () => void;
  onNewSms: () => void;
  onNewEmail: () => void;
}

const keyboardShortcuts = [
  { key: "⌘K", description: "Focus search" },
  { key: "J", description: "Next conversation" },
  { key: "K", description: "Previous conversation" },
  { key: "E", description: "Mark as done" },
  { key: "S", description: "Snooze conversation" },
  { key: "R", description: "Reply" },
  { key: "?", description: "Show shortcuts" },
];

export function InboxHeader({
  search,
  onSearchChange,
  searchInputRef,
  showKeyboardHelp,
  onToggleKeyboardHelp,
  onNewSms,
  onNewEmail,
}: InboxHeaderProps) {
  return (
    <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Search conversations... (⌘K)"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <SyncStatusIndicator />
        
        <TeamNotificationBell />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleKeyboardHelp}
          className="text-muted-foreground hover:text-foreground"
          title="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNewSms}>
              <MessageSquare className="h-4 w-4 mr-2" />
              New SMS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewEmail}>
              <Mail className="h-4 w-4 mr-2" />
              New Email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Keyboard shortcuts modal */}
      <Dialog open={showKeyboardHelp} onOpenChange={onToggleKeyboardHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-2">
            {keyboardShortcuts.map((shortcut, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
              >
                <span className="text-sm">{shortcut.description}</span>
                <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-muted border border-border rounded text-xs font-mono font-medium">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
