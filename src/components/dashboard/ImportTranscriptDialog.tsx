import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ImportTranscriptDialogProps {
  trigger?: React.ReactNode;
}

export function ImportTranscriptDialog({ trigger }: ImportTranscriptDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [participantType, setParticipantType] = useState<"owner" | "lead" | "other">("owner");
  const [participantId, setParticipantId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [autoExtract, setAutoExtract] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch owners for dropdown
  const { data: owners } = useQuery({
    queryKey: ["property-owners-dropdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("property_owners")
        .select("id, name, email")
        .order("name");
      return data || [];
    },
  });

  // Fetch leads for dropdown
  const { data: leads } = useQuery({
    queryKey: ["leads-dropdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, email")
        .order("name")
        .limit(50);
      return data || [];
    },
  });

  // Fetch properties for dropdown
  const { data: properties } = useQuery({
    queryKey: ["properties-dropdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("offboarded_at", null)
        .order("name");
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !transcript.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-meeting-transcript", {
        body: {
          title: title.trim(),
          transcript: transcript.trim(),
          participantType,
          participantId: participantId || null,
          propertyId: propertyId || null,
          autoExtractTasks: autoExtract,
        },
      });

      if (error) throw error;

      toast({
        title: "Transcript imported",
        description: autoExtract && data?.tasksCreated 
          ? `Created ${data.tasksCreated} tasks from the conversation`
          : "Meeting transcript saved successfully",
      });

      // Refresh tasks
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      
      // Reset form
      setTitle("");
      setTranscript("");
      setParticipantId("");
      setPropertyId("");
      setOpen(false);
    } catch (error: any) {
      console.error("Failed to import transcript:", error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import transcript",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" />
            Import Transcript
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Meeting Transcript
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              placeholder="e.g., Eric Ha - Property Setup Discussion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Participant Type</Label>
              <Select value={participantType} onValueChange={(v) => setParticipantType(v as typeof participantType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Property Owner</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {participantType === "owner" ? "Select Owner" : participantType === "lead" ? "Select Lead" : "Participant Name"}
              </Label>
              {participantType === "owner" ? (
                <Select value={participantId} onValueChange={setParticipantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {owners?.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name} ({owner.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : participantType === "lead" ? (
                <Select value={participantId} onValueChange={setParticipantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {leads?.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name} ({lead.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Enter participant name"
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Related Property (optional)</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select property..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No property</SelectItem>
                {properties?.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name || property.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript / Meeting Notes</Label>
            <Textarea
              id="transcript"
              placeholder="Paste your meeting transcript or notes here...

Example:
- Discussed direct booking setup and payment flow
- Need to update Airbnb photos
- Schedule AC maintenance for spring
- Owner will add portal to home screen"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              required
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Checkbox
              id="autoExtract"
              checked={autoExtract}
              onCheckedChange={(checked) => setAutoExtract(checked as boolean)}
            />
            <Label htmlFor="autoExtract" className="flex items-center gap-2 cursor-pointer">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Auto-extract action items using AI
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim() || !transcript.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import & Analyze
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
