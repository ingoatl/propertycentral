import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lead, LeadStage, LEAD_STAGES, STAGE_CONFIG } from "@/types/leads";
import LeadCard from "./LeadCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LeadKanbanProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
}

const LeadKanban = ({ leads, onSelectLead, onRefresh }: LeadKanbanProps) => {
  // Fetch follow-up sequences for each stage
  const { data: sequences } = useQuery({
    queryKey: ['follow-up-sequences'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_follow_up_sequences')
        .select(`
          *,
          lead_follow_up_steps(*)
        `)
        .eq('is_active', true);
      return data || [];
    }
  });

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

  const getSequenceForStage = (stage: LeadStage) => {
    return sequences?.find(seq => seq.trigger_stage === stage);
  };

  const getSequenceTooltip = (stage: LeadStage) => {
    const sequence = getSequenceForStage(stage);
    if (!sequence) return null;
    
    const steps = sequence.lead_follow_up_steps || [];
    const sortedSteps = [...steps].sort((a: any, b: any) => a.step_number - b.step_number);
    
    return {
      name: sequence.name,
      description: sequence.description,
      steps: sortedSteps.map((step: any) => ({
        stepNumber: step.step_number,
        delayDays: step.delay_days,
        delayHours: step.delay_hours,
        actionType: step.action_type,
        sendTime: step.send_time,
      }))
    };
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    // Calculate current visible stage
    const columnWidth = 264; // w-64 + gap
    const visibleStageIndex = Math.floor(scrollLeft / columnWidth);
    setCurrentStageIndex(Math.min(visibleStageIndex, LEAD_STAGES.length - 1));
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollState();
    container.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  const scrollBy = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 528; // 2 columns worth
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowLeft' && canScrollLeft) {
        scrollBy('left');
      } else if (e.key === 'ArrowRight' && canScrollRight) {
        scrollBy('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canScrollLeft, canScrollRight]);

  return (
    <TooltipProvider>
      <div className="relative">
        {/* Stage Progress Indicator */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Stage {currentStageIndex + 1} of {LEAD_STAGES.length}
            </span>
            <div className="flex gap-1">
              {LEAD_STAGES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const container = scrollContainerRef.current;
                    if (!container) return;
                    container.scrollTo({
                      left: idx * 264,
                      behavior: 'smooth'
                    });
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentStageIndex 
                      ? 'bg-primary w-4' 
                      : idx < currentStageIndex 
                        ? 'bg-primary/40' 
                        : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            Use ← → keys to navigate
          </span>
        </div>

        {/* Left Scroll Button */}
        <Button
          variant="secondary"
          size="icon"
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full shadow-lg border bg-background/95 backdrop-blur-sm transition-all duration-200 ${
            canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => scrollBy('left')}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Right Scroll Button */}
        <Button
          variant="secondary"
          size="icon"
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full shadow-lg border bg-background/95 backdrop-blur-sm transition-all duration-200 ${
            canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => scrollBy('right')}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>

        {/* Left Fade Gradient */}
        <div 
          className={`absolute left-12 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[5] pointer-events-none transition-opacity ${
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Right Fade Gradient */}
        <div 
          className={`absolute right-12 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-[5] pointer-events-none transition-opacity ${
            canScrollRight ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden px-14 pb-4 scroll-smooth scrollbar-custom"
          style={{
            scrollbarWidth: 'auto',
            scrollbarColor: 'hsl(var(--primary)) hsl(var(--muted))'
          }}
        >
          <div className="flex gap-4 min-w-max">
            {LEAD_STAGES.map((column) => {
              const columnLeads = getColumnLeads(column.stage);
              const columnTotal = getColumnTotal(column.stage);
              const config = STAGE_CONFIG[column.stage];
              const sequenceInfo = getSequenceTooltip(column.stage);
              
              return (
                <div
                  key={column.stage}
                  className="w-64 shrink-0"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.stage)}
                >
                  {/* Column Header with Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`p-3 rounded-t-lg ${config.bgColor} cursor-help transition-all hover:opacity-90`}>
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold text-sm ${config.color}`}>
                            {column.title}
                          </h3>
                          <span className={`text-sm font-medium ${config.color} bg-white/50 px-2 py-0.5 rounded-full`}>
                            {columnLeads.length}
                          </span>
                        </div>
                        <p className={`text-xs ${config.color} opacity-75`}>
                          {formatCurrency(columnTotal)}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs p-3">
                      <div className="space-y-2">
                        <div>
                          <p className="font-semibold text-sm">{column.title}</p>
                          <p className="text-xs text-muted-foreground">{column.description}</p>
                        </div>
                        <div className="border-t pt-2">
                          <p className="text-xs font-medium">
                            {columnLeads.length} lead{columnLeads.length !== 1 ? 's' : ''} • {formatCurrency(columnTotal)} total value
                          </p>
                        </div>
                        {sequenceInfo && (
                          <div className="border-t pt-2">
                            <p className="text-xs font-semibold text-primary mb-1">📧 {sequenceInfo.name}</p>
                            {sequenceInfo.description && (
                              <p className="text-xs text-muted-foreground mb-1">{sequenceInfo.description}</p>
                            )}
                            <div className="space-y-0.5">
                              {sequenceInfo.steps.slice(0, 5).map((step, idx) => (
                                <p key={idx} className="text-xs">
                                  <span className="text-muted-foreground">Step {step.stepNumber}:</span>{' '}
                                  {step.actionType === 'sms' ? '📱' : step.actionType === 'email' ? '📧' : '📱📧'}{' '}
                                  {step.delayDays > 0 ? `Day ${step.delayDays}` : `${step.delayHours}h`} @ {step.sendTime?.slice(0, 5) || '11:00'}
                                </p>
                              ))}
                              {sequenceInfo.steps.length > 5 && (
                                <p className="text-xs text-muted-foreground">+{sequenceInfo.steps.length - 5} more steps</p>
                              )}
                            </div>
                          </div>
                        )}
                        {!sequenceInfo && (
                          <div className="border-t pt-2">
                            <p className="text-xs text-muted-foreground italic">No automated follow-up sequence</p>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

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
        </div>
      </div>
    </TooltipProvider>
  );
};

export default LeadKanban;
