import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Loader2, Trash2, StickyNote } from "lucide-react";

interface Note {
  id: string;
  note: string;
  created_at: string;
}

interface ConversationNotesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactPhone?: string;
  contactEmail?: string;
  contactName: string;
}

export function ConversationNotes({
  open,
  onOpenChange,
  contactPhone,
  contactEmail,
  contactName,
}: ConversationNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchNotes();
    }
  }, [open, contactPhone, contactEmail]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("conversation_notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (contactPhone) {
        query = query.eq("contact_phone", contactPhone);
      } else if (contactEmail) {
        query = query.eq("contact_email", contactEmail);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("conversation_notes")
        .insert({
          user_id: user.id,
          contact_phone: contactPhone || null,
          contact_email: contactEmail || null,
          contact_name: contactName,
          note: newNote.trim(),
        });

      if (error) throw error;

      toast.success("Note added");
      setNewNote("");
      fetchNotes();
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(`Failed to add note: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("conversation_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;

      toast.success("Note deleted");
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error(`Failed to delete note: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes for {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new note */}
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note about this conversation..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button
              onClick={handleAddNote}
              disabled={!newNote.trim() || isSaving}
              size="sm"
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Note
            </Button>
          </div>

          {/* Notes list */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-muted/50 rounded-lg group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
