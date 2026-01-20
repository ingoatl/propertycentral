import { useState, useRef, useEffect, useCallback } from "react";
import { Maximize2, Send, X, Check, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { VoiceDictationButton } from "./VoiceDictationButton";
import { AIWritingAssistant } from "./AIWritingAssistant";
import { EmojiPicker } from "./EmojiPicker";

interface EnhancedMessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
  placeholder?: string;
  messageType?: "sms" | "email";
  contactName?: string;
  contactId?: string;
  contactType?: "lead" | "owner";
  disabled?: boolean;
  className?: string;
  showVoiceDictation?: boolean;
  showAIAssistant?: boolean;
  autoFocus?: boolean;
}

export function EnhancedMessageComposer({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  messageType = "sms",
  contactName,
  contactId,
  contactType = "lead",
  disabled = false,
  className,
  showVoiceDictation = true,
  showAIAssistant = true,
  autoFocus = false,
}: EnhancedMessageComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const characterCount = localValue.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;
  const isLongMessage = characterCount > 200 || localValue.split('\n').length > 3;

  // Auto-expand when there's content to make it easier to read
  const shouldAutoExpand = characterCount > 100 || localValue.split('\n').length > 2;

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const minHeight = shouldAutoExpand ? 120 : 56; // Larger when there's content
      const maxHeight = 400; // Increased max height
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [shouldAutoExpand]);

  useEffect(() => {
    adjustHeight();
  }, [localValue, adjustHeight]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleExpand = () => setIsExpanded(true);
  const handleSaveAndClose = () => {
    onChange(localValue);
    setIsExpanded(false);
  };
  const handleCancel = () => {
    setLocalValue(value);
    setIsExpanded(false);
  };
  const handleSend = () => {
    if (onSend && localValue.trim()) {
      onChange(localValue);
      onSend();
      setLocalValue("");
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile && onSend) {
      e.preventDefault();
      handleSend();
    }
  };

  const ActionBar = ({ expanded = false }: { expanded?: boolean }) => (
    <div className={cn("flex items-center gap-1 md:gap-2", expanded ? "justify-center py-2" : "")}>
      {showVoiceDictation && (
        <VoiceDictationButton
          onResult={(text) => handleChange(localValue ? `${localValue}\n${text}` : text)}
          messageType={messageType}
          contactName={contactName}
          className={cn(
            "transition-all duration-200 active:scale-95",
            expanded ? "h-12 w-12 md:h-11 md:w-11" : "h-11 w-11 md:h-10 md:w-10"
          )}
        />
      )}
      {showAIAssistant && contactId && (
        <AIWritingAssistant
          currentMessage={localValue}
          onMessageGenerated={handleChange}
          contactName={contactName}
          messageType={messageType}
          contactId={contactId}
          contactType={contactType}
        />
      )}
      <EmojiPicker onEmojiSelect={(emoji) => handleChange(localValue + emoji)} />
      {!expanded && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleExpand}
          className="h-11 w-11 md:h-10 md:w-10 rounded-full transition-all duration-200 active:scale-95 hover:bg-muted"
          title="Expand to review"
        >
          <Maximize2 className="h-5 w-5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );

  const ExpandedContent = (
    <div className="flex flex-col h-full">
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[200px] md:min-h-[280px] resize-none border-0 focus-visible:ring-0 text-[17px] md:text-base leading-relaxed p-4 md:p-5 bg-transparent"
        autoFocus
      />
      <div className="border-t bg-muted/30 px-4 py-3">
        <ActionBar expanded />
      </div>
      {messageType === "sms" && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <span className="text-base md:text-sm text-muted-foreground">{characterCount} characters</span>
          <span className={cn(
            "text-base md:text-sm font-medium px-2 py-0.5 rounded-full",
            segmentCount > 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"
          )}>
            {segmentCount} segment{segmentCount > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );

  const MobileExpandedView = (
    <Drawer open={isExpanded} onOpenChange={setIsExpanded}>
      <DrawerContent className="max-h-[92vh] flex flex-col">
        <DrawerHeader className="border-b px-4 py-3">
          <DrawerTitle className="text-lg font-semibold">Review Message</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden">{ExpandedContent}</div>
        <DrawerFooter className="border-t pt-4 pb-6 safe-area-bottom">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel} className="flex-1 h-14 text-base rounded-xl active:scale-[0.98] transition-transform">
              <X className="h-5 w-5 mr-2" />Cancel
            </Button>
            {onSend ? (
              <Button onClick={handleSend} disabled={!localValue.trim()} className="flex-1 h-14 text-base rounded-xl bg-gradient-to-br from-primary to-primary/80 active:scale-[0.98] transition-transform">
                <Send className="h-5 w-5 mr-2" />Send
              </Button>
            ) : (
              <Button onClick={handleSaveAndClose} className="flex-1 h-14 text-base rounded-xl active:scale-[0.98] transition-transform">
                <Check className="h-5 w-5 mr-2" />Done
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );

  const DesktopExpandedView = (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            Review Message{contactName && <span className="text-muted-foreground font-normal ml-2">to {contactName}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">{ExpandedContent}</div>
        <DialogFooter className="px-6 py-4 border-t gap-3 sm:gap-3">
          <Button variant="outline" onClick={handleCancel} className="h-11"><X className="h-4 w-4 mr-2" />Cancel</Button>
          {onSend ? (
            <Button onClick={handleSend} disabled={!localValue.trim()} className="h-11 bg-gradient-to-br from-primary to-primary/80">
              <Send className="h-4 w-4 mr-2" />Send Message
            </Button>
          ) : (
            <Button onClick={handleSaveAndClose} className="h-11"><Check className="h-4 w-4 mr-2" />Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <div className={cn("relative", className)}>
        <div className={cn(
          "relative rounded-2xl border-2 transition-all duration-200",
          isFocused ? "ring-2 ring-primary/20 border-primary/50" : "border-input",
          "bg-background"
        )}>
          <Textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            className={cn(
              "resize-none border-0 focus-visible:ring-0 rounded-2xl text-[17px] leading-relaxed py-4 px-4 pr-14 placeholder:text-muted-foreground/60 transition-all duration-200",
              shouldAutoExpand ? "min-h-[120px] max-h-[400px]" : "min-h-[56px] max-h-[400px]"
            )}
            rows={shouldAutoExpand ? 4 : 1}
          />
          {onSend && localValue.trim() && (
            <div className="absolute right-2 bottom-2">
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={disabled || !localValue.trim()}
                className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 active:scale-95 shadow-lg"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <ActionBar />
          {messageType === "sms" && characterCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{characterCount}</span>
              <span className={cn(
                "font-medium px-2 py-0.5 rounded-full text-xs",
                segmentCount > 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"
              )}>
                {segmentCount} SMS
              </span>
              {isLongMessage && (
                <Button variant="ghost" size="sm" onClick={handleExpand} className="h-7 px-2 text-xs text-primary">
                  <Type className="h-3 w-3 mr-1" />Review
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {isMobile ? MobileExpandedView : DesktopExpandedView}
    </>
  );
}
