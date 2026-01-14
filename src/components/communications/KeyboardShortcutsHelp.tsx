import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";
import { KeyboardShortcut, formatShortcutKey } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ 
  shortcuts, 
  open, 
  onOpenChange 
}: KeyboardShortcutsHelpProps) {
  // Group shortcuts by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || "Other";
    if (!acc[category]) acc[category] = [];
    // Skip duplicate descriptions
    if (!acc[category].find(s => s.description === shortcut.description)) {
      acc[category].push(shortcut);
    }
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-muted-foreground"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {items.map((shortcut, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-muted border border-border rounded text-xs font-mono font-medium">
                      {formatShortcutKey(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs font-mono">?</kbd> to show/hide this menu
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
