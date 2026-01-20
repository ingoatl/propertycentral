import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, AtSign, X, FileIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/communications/EmojiPicker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';

interface Attachment {
  file: File;
  preview?: string;
  uploading?: boolean;
  url?: string;
}

interface EnhancedMessageComposerProps {
  onSend: (content: string, attachments?: { url: string; name: string; type: string }[], mentions?: string[]) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  channelName?: string;
}

export const EnhancedMessageComposer = memo(function EnhancedMessageComposer({
  onSend,
  isLoading,
  placeholder = 'Type a message...',
  channelName,
}: EnhancedMessageComposerProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch team members for @mentions
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-mentions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, email, avatar_url')
        .not('email', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  const filteredMembers = teamMembers.filter(member => {
    const name = member.first_name || member.email?.split('@')[0] || '';
    return name.toLowerCase().includes(mentionQuery.toLowerCase());
  });

  const handleSubmit = useCallback(async () => {
    if ((!message.trim() && attachments.length === 0) || isLoading || isUploading) return;
    
    const content = message.trim();
    const attachmentData = attachments
      .filter(a => a.url)
      .map(a => ({
        url: a.url!,
        name: a.file.name,
        type: a.file.type,
      }));
    
    setMessage('');
    setAttachments([]);
    setMentions([]);
    
    try {
      await onSend(content, attachmentData.length > 0 ? attachmentData : undefined, mentions.length > 0 ? mentions : undefined);
    } catch (error) {
      // Restore message on error
      setMessage(content);
    }
  }, [message, attachments, mentions, isLoading, isUploading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, showMentions]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Detect @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(textAfterAt)) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery('');
  };

  const insertMention = (member: { id: string; first_name: string | null; email: string | null }) => {
    const name = member.first_name || member.email?.split('@')[0] || 'Unknown';
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(mentionStartIndex + mentionQuery.length + 1);
    
    setMessage(`${beforeMention}@${name} ${afterMention}`);
    setMentions(prev => [...prev, member.id]);
    setShowMentions(false);
    setMentionQuery('');
    textareaRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user?.id) return;

    // Validate file sizes (max 10MB each)
    const invalidFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error('Files must be less than 10MB each');
      return;
    }

    setIsUploading(true);
    
    const newAttachments: Attachment[] = files.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      uploading: true,
    }));
    
    setAttachments(prev => [...prev, ...newAttachments]);

    // Upload files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('team-files')
          .upload(fileName, file, {
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('team-files')
          .getPublicUrl(fileName);

        // Update attachment with URL
        setAttachments(prev => 
          prev.map((a, index) => 
            index === prev.length - files.length + i 
              ? { ...a, uploading: false, url: urlData.publicUrl }
              : a
          )
        );
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
        setAttachments(prev => prev.filter((_, index) => index !== prev.length - files.length + i));
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const attachment = prev[index];
      if (attachment.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  return (
    <div className="border-t bg-background p-4">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative group rounded-lg border bg-muted/50 p-2 flex items-center gap-2"
            >
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="h-12 w-12 object-cover rounded"
                />
              ) : (
                <div className="h-12 w-12 flex items-center justify-center bg-muted rounded">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate max-w-[100px]">
                  {attachment.file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(attachment.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              {attachment.uploading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <button
                onClick={() => removeAttachment(index)}
                className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mentions Popup */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full mb-2 left-4 bg-popover border rounded-lg shadow-lg p-1 min-w-[200px] z-50">
          {filteredMembers.slice(0, 5).map((member) => (
            <button
              key={member.id}
              onClick={() => insertMention(member)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
            >
              <span className="font-medium">
                {member.first_name || member.email?.split('@')[0]}
              </span>
              <span className="text-muted-foreground text-xs">
                {member.email}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder={channelName ? `Message #${channelName}` : placeholder}
            className={cn(
              'resize-none min-h-[44px] max-h-[150px] pr-28',
              'focus-visible:ring-1'
            )}
            rows={1}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {/* @Mention Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              type="button"
              onClick={() => {
                setMessage(prev => prev + '@');
                textareaRef.current?.focus();
              }}
            >
              <AtSign className="h-4 w-4" />
            </Button>

            {/* Emoji Picker */}
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />

            {/* File Attachment */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={(!message.trim() && attachments.length === 0) || isLoading || isUploading}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">@</kbd> to mention
        </p>
        {mentions.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Mentioning:</span>
            {mentions.slice(0, 3).map((id, i) => {
              const member = teamMembers.find(m => m.id === id);
              return (
                <Badge key={id} variant="secondary" className="text-xs">
                  @{member?.first_name || 'User'}
                </Badge>
              );
            })}
            {mentions.length > 3 && (
              <span className="text-xs text-muted-foreground">+{mentions.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
