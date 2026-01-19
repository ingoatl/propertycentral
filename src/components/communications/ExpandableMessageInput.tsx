import { useState, useRef, useEffect, useCallback } from "react";
import { Maximize2, Send, X, Check, Type, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { VoiceDictationButton } from "./VoiceDictationButton";
import { AIWritingAssistant } from "./AIWritingAssistant";

interface ExpandableMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend?: () => void;
  placeholder?: string;
  messageType?: "sms" | "email";
  contactName?: string;
  contactId?: string;
  contactType?: "lead" | "owner" | "vendor";
  minRows?: number;
  maxRows?: number;
  showCharacterCount?: boolean;
  showSegmentCount?: boolean;
  disabled?: boolean;
  className?: string;
  showVoiceDictation?: boolean;
  showAIAssistant?: boolean;
}

export function ExpandableMessageInput({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  messageType = "sms",
  contactName,
  contactId,
  contactType = "lead",
  minRows = 3,
  maxRows = 8,
  showCharacterCount = true,
  showSegmentCount = true,
  disabled = false,
  className,
  showVoiceDictation = true,
  showAIAssistant = true,
}: ExpandableMessageInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // Sync local value with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Character and segment counting for SMS
  const characterCount = localValue.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 26;
      const minHeight = Math.max(minRows * lineHeight, 80);
      const maxHeight = maxRows * lineHeight;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [minRows, maxRows]);

  useEffect(() => {
    adjustHeight();
  }, [localValue, adjustHeight]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

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
      setIsExpanded(false);
    }
  };

  // Action buttons component
  const ActionButtons = ({ expanded = false, compact = false }: { expanded?: boolean; compact?: boolean }) => (
    <div className={cn("flex items-center", compact ? "gap-1" : "gap-2")}>
      {showVoiceDictation && (
        <VoiceDictationButton
          onResult={(text) => {
            const newValue = localValue ? `${localValue}\n${text}` : text;
            setLocalValue(newValue);
            onChange(newValue);
          }}
          messageType={messageType}
          contactName={contactName}
          className={cn(
            "transition-all duration-200 active:scale-95",
            compact ? "h-9 w-9" : expanded ? "h-12 w-12 md:h-11 md:w-11" : "h-10 w-10"
          )}
        />
      )}
      {showAIAssistant && contactId && (
        <AIWritingAssistant
          currentMessage={localValue}
          onMessageGenerated={(msg) => {
            setLocalValue(msg);
            onChange(msg);
          }}
          contactName={contactName}
          messageType={messageType}
          contactId={contactId}
          contactType={contactType}
        />
      )}
    </div>
  );

  // Expanded content with EDITABLE textarea
  const ExpandedContent = (
    <div className="flex flex-col h-full">
      {/* Action bar at TOP */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <ActionButtons expanded />
        {(showCharacterCount || showSegmentCount) && messageType === "sms" && (
          <div className="flex items-center gap-2">
            {showCharacterCount && (
              <span className="text-sm text-muted-foreground">
                {characterCount} chars
              </span>
            )}
            {showSegmentCount && (
              <span className={cn(
                "text-sm font-medium px-2.5 py-1 rounded-full",
                segmentCount > 1 
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                  : "bg-muted text-muted-foreground"
              )}>
                {segmentCount} SMS
              </span>
            )}
          </div>
        )}
      </div>

      <Textarea
        ref={expandedTextareaRef}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
        }}
        placeholder={placeholder}
        className={cn(
          "flex-1 min-h-[280px] md:min-h-[320px] resize-none border-0 focus-visible:ring-0",
          "text-[18px] md:text-[17px] leading-relaxed p-5 md:p-6"
        )}
        autoFocus
      />
    </div>
  );

  // Mobile: Full screen Drawer
  const MobileExpandedView = (
    <Drawer open={isExpanded} onOpenChange={setIsExpanded}>
      <DrawerContent className="h-[100dvh] flex flex-col">
        <DrawerHeader className="border-b px-5 py-4 bg-gradient-to-b from-background to-background/95">
          <DrawerTitle className="text-lg font-semibold">
            {contactName ? `Message to ${contactName}` : "Edit Message"}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="flex-1 overflow-hidden bg-background">
          {ExpandedContent}
        </div>
        
        <DrawerFooter className="border-t pt-4 pb-6 safe-area-bottom bg-gradient-to-t from-muted/50 to-background">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleCancel} 
              className="flex-1 h-12 text-base rounded-xl"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {onSend ? (
              <Button 
                onClick={handleSend} 
                disabled={!localValue.trim()} 
                className="flex-1 h-12 text-base rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            ) : (
              <Button 
                onClick={handleSaveAndClose} 
                className="flex-1 h-12 text-base rounded-xl"
              >
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );

  // Desktop: Dialog
  const DesktopExpandedView = (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            Edit Message
            {contactName && (
              <span className="text-muted-foreground font-normal ml-2">
                to {contactName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {ExpandedContent}
        </div>
        
        <DialogFooter className="px-6 py-4 border-t gap-3 sm:gap-3">
          <Button variant="outline" onClick={handleCancel} className="h-11 px-5 rounded-lg">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {onSend ? (
            <Button 
              onClick={handleSend} 
              disabled={!localValue.trim()}
              className="h-11 px-6 rounded-lg"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          ) : (
            <Button onClick={handleSaveAndClose} className="h-11 px-5 rounded-lg">
              <Check className="h-4 w-4 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {/* COMPACT VIEW - Now with actual editable textarea */}
      <div className={cn("relative", className)}>
        <div className={cn(
          "relative rounded-xl border transition-all duration-200",
          isFocused ? "ring-2 ring-primary/20 border-primary/50" : "border-input",
          "bg-background"
        )}>
          {/* Actual editable textarea */}
          <Textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "resize-none border-0 focus-visible:ring-0 bg-transparent",
              "text-base leading-relaxed py-3 px-4 pr-12",
              "min-h-[80px]"
            )}
            rows={minRows}
          />
          
          {/* Expand button - overlaid */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleExpand}
            className="absolute right-2 top-2 h-8 w-8 rounded-full hover:bg-muted/80 transition-all"
            title="Expand to full screen"
          >
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        
        {/* Action bar and counts below */}
        <div className="flex items-center justify-between mt-2.5 px-1">
          <ActionButtons compact />
          
          {/* Character/segment count */}
          {(showCharacterCount || showSegmentCount) && messageType === "sms" && characterCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              {showCharacterCount && (
                <span className="text-muted-foreground text-xs">{characterCount}</span>
              )}
              {showSegmentCount && (
                <span className={cn(
                  "font-medium px-2 py-0.5 rounded-full text-xs",
                  segmentCount > 1 
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {segmentCount} SMS
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded view */}
      {isMobile ? MobileExpandedView : DesktopExpandedView}
    </>
  );
}
