import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  category?: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  ignoreInputs?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  ignoreInputs = true,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input, textarea, or contenteditable
      if (ignoreInputs) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          // Only allow Escape in inputs
          if (event.key !== "Escape") return;
        }
      }

      const matchingShortcut = shortcutsRef.current.find((shortcut) => {
        const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    },
    [enabled, ignoreInputs]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Default inbox shortcuts configuration
export function useInboxKeyboardShortcuts({
  onNavigateUp,
  onNavigateDown,
  onOpen,
  onReply,
  onMarkDone,
  onSnooze,
  onNotes,
  onAssign,
  onClose,
  onSearch,
  selectedIndex,
  itemCount,
  hasSelection,
  enabled = true,
}: {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onOpen: () => void;
  onReply: () => void;
  onMarkDone: () => void;
  onSnooze: () => void;
  onNotes: () => void;
  onAssign: () => void;
  onClose: () => void;
  onSearch: () => void;
  selectedIndex: number;
  itemCount: number;
  hasSelection: boolean;
  enabled?: boolean;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "j",
      action: onNavigateDown,
      description: "Next message",
      category: "Navigation",
    },
    {
      key: "k",
      action: onNavigateUp,
      description: "Previous message",
      category: "Navigation",
    },
    {
      key: "Enter",
      action: onOpen,
      description: "Open message",
      category: "Navigation",
    },
    {
      key: "o",
      action: onOpen,
      description: "Open message",
      category: "Navigation",
    },
    {
      key: "r",
      action: onReply,
      description: "Reply",
      category: "Actions",
    },
    {
      key: "e",
      action: onMarkDone,
      description: "Mark as done",
      category: "Actions",
    },
    {
      key: "d",
      action: onMarkDone,
      description: "Mark as done",
      category: "Actions",
    },
    {
      key: "s",
      action: onSnooze,
      description: "Snooze",
      category: "Actions",
    },
    {
      key: "n",
      action: onNotes,
      description: "Open notes",
      category: "Actions",
    },
    {
      key: "a",
      action: onAssign,
      description: "Assign to team",
      category: "Actions",
    },
    {
      key: "Escape",
      action: onClose,
      description: "Close detail view",
      category: "Navigation",
    },
    {
      key: "/",
      action: onSearch,
      description: "Search",
      category: "Navigation",
    },
  ];

  useKeyboardShortcuts({
    shortcuts,
    enabled,
    ignoreInputs: true,
  });

  return shortcuts;
}

// Format shortcut key for display
export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrlKey) parts.push("⌘");
  if (shortcut.shiftKey) parts.push("⇧");
  if (shortcut.altKey) parts.push("⌥");
  
  const keyDisplay = shortcut.key === "Escape" ? "Esc" 
    : shortcut.key === "Enter" ? "↵" 
    : shortcut.key === "/" ? "/" 
    : shortcut.key.toUpperCase();
  
  parts.push(keyDisplay);
  return parts.join("");
}
