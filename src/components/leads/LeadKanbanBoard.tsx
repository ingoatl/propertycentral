import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lead, LeadStage, LEAD_STAGES } from "@/types/leads";
import LeadKanbanColumn from "./LeadKanbanColumn";
import LeadKanbanCard from "./LeadKanbanCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface LeadKanbanBoardProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
}

const LeadKanbanBoard = ({ leads, onSelectLead, onRefresh }: LeadKanbanBoardProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStage }: { leadId: string; newStage: LeadStage }) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) throw new Error("Lead not found");

      const { error } = await supabase
        .from("leads")
        .update({ stage: newStage, stage_changed_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;

      // Log timeline entry
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: "stage_changed",
        performed_by_user_id: userData?.user?.id,
        performed_by_name: userData?.user?.email,
        previous_stage: lead.stage,
        new_stage: newStage,
        metadata: { source: "kanban_drag" },
      });

      // Trigger automation
      await supabase.functions.invoke("process-lead-stage-change", {
        body: { leadId, newStage },
      });
    },
    onSuccess: () => {
      toast.success("Lead moved successfully");
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to move lead");
      console.error(error);
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const leadId = active.id as string;
      const newStage = over.id as LeadStage;

      // Check if it's a valid stage
      const isValidStage = LEAD_STAGES.some((s) => s.stage === newStage);
      if (!isValidStage) return;

      const lead = leads.find((l) => l.id === leadId);
      if (!lead || lead.stage === newStage) return;

      updateStageMutation.mutate({ leadId, newStage });
    },
    [leads, updateStageMutation]
  );

  const getLeadsByStage = (stage: LeadStage) => {
    return leads.filter((lead) => lead.stage === stage);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {LEAD_STAGES.map(({ stage }) => (
            <LeadKanbanColumn
              key={stage}
              stage={stage}
              leads={getLeadsByStage(stage)}
              onSelectLead={onSelectLead}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay>
        {activeLead && (
          <div className="opacity-90 rotate-3">
            <LeadKanbanCard lead={activeLead} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default LeadKanbanBoard;
