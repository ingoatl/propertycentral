import { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2, Send, X, Check } from "lucide-react";
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
  maxRows = 6,
  showCharacterCount = true,
  showSegmentCount = true,
  disabled = false,
  className,
  showVoiceDictation = true,
  showAIAssistant = true,
}: ExpandableMessageInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // Sync local value with external value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Character and segment counting for SMS
  const characterCount = localValue.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  // Auto-resize textarea based on content
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 24; // Approximate line height
      const minHeight = minRows * lineHeight;
      const maxHeight = maxRows * lineHeight;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [localValue, minRows, maxRows]);

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

  // Expanded content - shared between Dialog and Drawer
  const ExpandedContent = (
    <div className="flex flex-col h-full">
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[200px] md:min-h-[250px] text-base leading-relaxed resize-none border-0 focus-visible:ring-0 p-4"
        autoFocus
      />
      
      {/* Footer info */}
      {(showCharacterCount || showSegmentCount) && messageType === "sms" && (
        <div className="flex justify-between text-xs text-muted-foreground px-4 py-2 border-t bg-muted/30">
          {showCharacterCount && <span>{characterCount} characters</span>}
          {showSegmentCount && (
            <span>
              {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );

  // Mobile: Use Drawer (bottom sheet) for expanded view
  const MobileExpandedView = (
    <Drawer open={isExpanded} onOpenChange={setIsExpanded}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center justify-between">
            <span>Review Message</span>
            <div className="flex gap-2">
              {showVoiceDictation && (
                <VoiceDictationButton
                  onResult={(text) => setLocalValue(prev => prev ? `${prev}\n${text}` : text)}
                  messageType={messageType}
                  contactName={contactName}
                />
              )}
              {showAIAssistant && contactId && (
                <AIWritingAssistant
                  currentMessage={localValue}
                  onMessageGenerated={setLocalValue}
                  contactName={contactName}
                  messageType={messageType}
                  contactId={contactId}
                  contactType={contactType}
                />
              )}
            </div>
          </DrawerTitle>
        </DrawerHeader>
        
        <div className="flex-1 overflow-hidden">
          {ExpandedContent}
        </div>
        
        <DrawerFooter className="border-t pt-4 safe-area-bottom">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleCancel} 
              className="flex-1 h-12"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            {onSend ? (
              <Button 
                onClick={handleSend} 
                disabled={!localValue.trim()} 
                className="flex-1 h-12 bg-gradient-to-br from-violet-500 to-violet-600"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            ) : (
              <Button 
                onClick={handleSaveAndClose} 
                className="flex-1 h-12"
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

  // Desktop: Use Dialog for expanded view
  const DesktopExpandedView = (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Review Message</span>
            <div className="flex gap-2">
              {showVoiceDictation && (
                <VoiceDictationButton
                  onResult={(text) => setLocalValue(prev => prev ? `${prev}\n${text}` : text)}
                  messageType={messageType}
                  contactName={contactName}
                />
              )}
              {showAIAssistant && contactId && (
                <AIWritingAssistant
                  currentMessage={localValue}
                  onMessageGenerated={setLocalValue}
                  contactName={contactName}
                  messageType={messageType}
                  contactId={contactId}
                  contactType={contactType}
                />
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden border rounded-lg">
          {ExpandedContent}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          {onSend ? (
            <Button 
              onClick={handleSend} 
              disabled={!localValue.trim()}
              className="bg-gradient-to-br from-violet-500 to-violet-600"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          ) : (
            <Button onClick={handleSaveAndClose}>
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
      {/* Compact input view */}
      <div className={cn("relative", className)}>
        <Textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={isMobile ? handleExpand : undefined}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "pr-20 resize-none transition-all text-base md:text-sm",
            isMobile && "cursor-pointer"
          )}
          rows={minRows}
        />
        
        {/* Action buttons overlay */}
        <div className="absolute right-2 top-2 flex gap-1">
          {showVoiceDictation && !isMobile && (
            <VoiceDictationButton
              onResult={(text) => handleChange(localValue ? `${localValue}\n${text}` : text)}
              messageType={messageType}
              contactName={contactName}
            />
          )}
          {showAIAssistant && contactId && !isMobile && (
            <AIWritingAssistant
              currentMessage={localValue}
              onMessageGenerated={handleChange}
              contactName={contactName}
              messageType={messageType}
              contactId={contactId}
              contactType={contactType}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleExpand}
            className="h-8 w-8 rounded-full hover:bg-muted"
            title="Expand to review"
          >
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        
        {/* Character/segment count */}
        {(showCharacterCount || showSegmentCount) && messageType === "sms" && (
          <div className="flex justify-between text-xs text-muted-foreground px-1 mt-1">
            {showCharacterCount && <span>{characterCount} characters</span>}
            {showSegmentCount && (
              <span>
                {segmentCount} SMS segment{segmentCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded view - platform specific */}
      {isMobile ? MobileExpandedView : DesktopExpandedView}
    </>
  );
}
