import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Lead, LeadStage, LEAD_STAGES, STAGE_CONFIG } from "@/types/leads";
import LeadCard from "./LeadCard";

interface LeadKanbanProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
}

const LeadKanban = ({ leads, onSelectLead, onRefresh }: LeadKanbanProps) => {
  const updateStage = useMutation({
    mutationFn: async ({ leadId, newStage, previousStage }: { leadId: string; newStage: LeadStage; previousStage: LeadStage }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update lead stage
      const { error } = await supabase
        .from("leads")
        .update({ 
          stage: newStage,
          stage_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", leadId);

      if (error) throw error;

      // Add timeline entry
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: `Stage changed from ${STAGE_CONFIG[previousStage].label} to ${STAGE_CONFIG[newStage].label}`,
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        previous_stage: previousStage,
        new_stage: newStage,
      });

      // Trigger automation processing
      try {
        await supabase.functions.invoke('process-lead-stage-change', {
          body: { leadId, newStage, previousStage }
        });
      } catch (e) {
        console.log('Automation processing queued');
      }
    },
    onSuccess: () => {
      toast.success("Lead stage updated");
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to update stage: " + error.message);
    },
  });

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStage: LeadStage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const lead = leads.find(l => l.id === leadId);
    
    if (lead && lead.stage !== newStage) {
      updateStage.mutate({ leadId, newStage, previousStage: lead.stage });
    }
  };

  const getColumnLeads = (stage: LeadStage) => {
    return leads.filter(lead => lead.stage === stage);
  };

  const getColumnTotal = (stage: LeadStage) => {
    return getColumnLeads(stage).reduce((sum, lead) => sum + (lead.opportunity_value || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    if (amount === 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {LEAD_STAGES.map((column) => {
          const columnLeads = getColumnLeads(column.stage);
          const columnTotal = getColumnTotal(column.stage);
          const config = STAGE_CONFIG[column.stage];
          
          return (
            <div
              key={column.stage}
              className="w-72 shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.stage)}
            >
              {/* Column Header */}
              <div className={`p-3 rounded-t-lg ${config.bgColor}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold text-sm ${config.color}`}>
                    {column.title}
                  </h3>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {columnLeads.length}
                  </span>
                </div>
                <p className={`text-xs ${config.color} opacity-75`}>
                  {formatCurrency(columnTotal)}
                </p>
              </div>

              {/* Column Content */}
              <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
                {columnLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No leads
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <LeadCard
                        lead={lead}
                        onClick={() => onSelectLead(lead)}
                        compact
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default LeadKanban;
