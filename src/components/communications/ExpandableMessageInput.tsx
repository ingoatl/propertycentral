import { useState, useRef, useEffect, useCallback } from "react";
import { Maximize2, Send, X, Check, Type } from "lucide-react";
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
  contactType?: "lead" | "owner";
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
  minRows = 2,
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
  const isMobile = useIsMobile();

  // Sync local value with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Character and segment counting for SMS
  const characterCount = localValue.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;
  const isLongMessage = characterCount > 200 || localValue.split('\n').length > 3;

  // Auto-resize textarea with smooth animation
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 26; // Larger line height for readability
      const minHeight = Math.max(minRows * lineHeight, 56); // Minimum 56px (touch-friendly)
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
    setLocalValue(value); // Reset to original value
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
  const ActionButtons = ({ expanded = false }: { expanded?: boolean }) => (
    <div className="flex items-center gap-2">
      {showVoiceDictation && (
        <VoiceDictationButton
          onResult={(text) => {
            const newValue = localValue ? `${localValue}\n${text}` : text;
            setLocalValue(newValue);
            if (!expanded) onChange(newValue);
          }}
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
          onMessageGenerated={(msg) => {
            setLocalValue(msg);
            if (!expanded) onChange(msg);
          }}
          contactName={contactName}
          messageType={messageType}
          contactId={contactId}
          contactType={contactType}
        />
      )}
    </div>
  );

  // Expanded content - shared between Dialog and Drawer
  const ExpandedContent = (
    <div className="flex flex-col h-full">
      {/* Action bar at TOP of expanded view with better positioning */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <ActionButtons expanded />
        {/* Character/segment count inline */}
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
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "flex-1 min-h-[280px] md:min-h-[320px] resize-none border-0 focus-visible:ring-0",
          "text-[18px] md:text-[17px] leading-relaxed p-5 md:p-6"
        )}
        autoFocus
      />
    </div>
  );

  // Mobile: Use Drawer (bottom sheet) for expanded view - FULL SCREEN with upscale effect
  const MobileExpandedView = (
    <Drawer open={isExpanded} onOpenChange={setIsExpanded}>
      <DrawerContent className="h-[100dvh] flex flex-col data-[state=open]:animate-drawer-scale-in">
        <DrawerHeader className="border-b px-5 py-5 bg-gradient-to-b from-background to-background/95">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {contactName ? `Message to ${contactName}` : "Compose Message"}
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="flex-1 overflow-hidden bg-background">
          {ExpandedContent}
        </div>
        
        <DrawerFooter className="border-t pt-5 pb-8 safe-area-bottom bg-gradient-to-t from-muted/50 to-background">
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={handleCancel} 
              className="flex-1 h-14 text-lg rounded-2xl active:scale-[0.97] transition-all duration-200 shadow-sm"
            >
              <X className="h-5 w-5 mr-2" />
              Cancel
            </Button>
            {onSend ? (
              <Button 
                onClick={handleSend} 
                disabled={!localValue.trim()} 
                className="flex-1 h-14 text-lg rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/25 active:scale-[0.97] transition-all duration-200"
              >
                <Send className="h-5 w-5 mr-2" />
                Send
              </Button>
            ) : (
              <Button 
                onClick={handleSaveAndClose} 
                className="flex-1 h-14 text-lg rounded-2xl shadow-lg active:scale-[0.97] transition-all duration-200"
              >
                <Check className="h-5 w-5 mr-2" />
                Done
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );

  // Desktop: Use Dialog for expanded view - WIDER modal with upscale effect
  const DesktopExpandedView = (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 rounded-3xl shadow-2xl shadow-black/10 data-[state=open]:animate-scale-in-premium">
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-b from-muted/30 to-background">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Review Message
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
        
        <DialogFooter className="px-8 py-5 border-t gap-4 sm:gap-4 bg-gradient-to-t from-muted/30 to-background">
          <Button variant="outline" onClick={handleCancel} className="h-13 px-6 text-base rounded-xl">
            <X className="h-5 w-5 mr-2" />
            Cancel
          </Button>
          {onSend ? (
            <Button 
              onClick={handleSend} 
              disabled={!localValue.trim()}
              className="h-13 px-8 text-base rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/20"
            >
              <Send className="h-5 w-5 mr-2" />
              Send Message
            </Button>
          ) : (
            <Button onClick={handleSaveAndClose} className="h-13 px-6 text-base rounded-xl">
              <Check className="h-5 w-5 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {/* Compact input view with enhanced styling */}
      <div className={cn("relative", className)}>
        <div className={cn(
          "relative rounded-2xl border-2 transition-all duration-200",
          isFocused ? "ring-2 ring-primary/20 border-primary/50" : "border-input",
          "bg-background"
        )}>
          {/* On mobile, use a clickable div overlay to trigger expansion */}
          {isMobile ? (
            <div
              onClick={handleExpand}
              className={cn(
                "min-h-[56px] resize-none border-0 rounded-2xl cursor-pointer",
                "text-[18px] leading-relaxed py-4 px-4 pr-14",
                "flex items-start"
              )}
            >
              <span className={cn(
                "text-[18px] leading-relaxed",
                localValue ? "text-foreground" : "text-muted-foreground/60"
              )}>
                {localValue || placeholder}
              </span>
            </div>
          ) : (
            <Textarea
              ref={textareaRef}
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "min-h-[56px] resize-none border-0 focus-visible:ring-0 rounded-2xl",
                "text-[18px] leading-relaxed py-4 px-4 pr-14",
                "placeholder:text-muted-foreground/60"
              )}
              rows={minRows}
            />
          )}
          
          {/* Expand button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleExpand}
            className="absolute right-2 top-2 h-10 w-10 rounded-full hover:bg-muted transition-all duration-200 active:scale-95"
            title="Expand to review"
          >
            <Maximize2 className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
        
        {/* Action bar and segment count below input */}
        <div className="flex items-center justify-between mt-2 px-1">
          {!isMobile && <ActionButtons />}
          {isMobile && (
            <div className="flex items-center gap-2">
              <ActionButtons />
            </div>
          )}
          
          {/* Character/segment count */}
          {(showCharacterCount || showSegmentCount) && messageType === "sms" && characterCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              {showCharacterCount && (
                <span className="text-muted-foreground">{characterCount}</span>
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
              {isLongMessage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpand}
                  className="h-7 px-2 text-xs text-primary"
                >
                  <Type className="h-3 w-3 mr-1" />
                  Review
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded view - platform specific */}
      {isMobile ? MobileExpandedView : DesktopExpandedView}
    </>
  );
}
