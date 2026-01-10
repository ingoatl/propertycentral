import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, LayoutGrid, List } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Lead, LeadStage } from "@/types/leads";
import LeadKanbanBoard from "@/components/leads/LeadKanbanBoard";
import LeadTableView from "@/components/leads/LeadTableView";
import LeadMobileView from "@/components/leads/LeadMobileView";
import LeadStatsBar from "@/components/leads/LeadStatsBar";
import LeadQuickFilters from "@/components/leads/LeadQuickFilters";
import LeadDetailModal from "@/components/leads/LeadDetailModal";
import CreateLeadDialog from "@/components/leads/CreateLeadDialog";
import VoiceDialer from "@/components/leads/VoiceDialer";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type FilterType = "stage" | "source";

const Leads = () => {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [activeFilters, setActiveFilters] = useState<{ type: FilterType; value: string }[]>([]);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    staleTime: 30000, // Cache for 30 seconds to reduce unnecessary refetches
    refetchOnWindowFocus: false, // Don't refetch on every window focus
  });

  const availableSources = useMemo(() => {
    const sources = leads
      .map((l) => l.opportunity_source)
      .filter((s): s is string => !!s);
    return [...new Set(sources)];
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        lead.name.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.includes(query) ||
        lead.property_address?.toLowerCase().includes(query) ||
        lead.opportunity_source?.toLowerCase().includes(query);

      // Stage filters
      const stageFilters = activeFilters.filter((f) => f.type === "stage");
      const matchesStage =
        stageFilters.length === 0 ||
        stageFilters.some((f) => f.value === lead.stage);

      // Source filters
      const sourceFilters = activeFilters.filter((f) => f.type === "source");
      const matchesSource =
        sourceFilters.length === 0 ||
        sourceFilters.some((f) => f.value === lead.opportunity_source);

      return matchesSearch && matchesStage && matchesSource;
    });
  }, [leads, searchQuery, activeFilters]);

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, newStage, previousStage }: { leadId: string; newStage: LeadStage; previousStage: LeadStage }) => {
      const { error } = await supabase
        .from("leads")
        .update({ stage: newStage, stage_changed_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
      
      // Background tasks
      const bgTasks = async () => {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "stage_changed",
          performed_by_user_id: userData?.user?.id,
          performed_by_name: userData?.user?.email,
          previous_stage: previousStage,
          new_stage: newStage,
          metadata: { source: "mobile_view" },
        });
        await supabase.functions.invoke("process-lead-stage-change", {
          body: { leadId, newStage, previousStage },
        });
      };
      bgTasks().catch(console.error);
    },
    onSuccess: () => {
      toast.success("Lead moved");
      refetch();
    },
    onError: () => {
      toast.error("Failed to move lead");
    },
  });

  const handleStageChange = (leadId: string, newStage: LeadStage, previousStage: LeadStage) => {
    updateStageMutation.mutate({ leadId, newStage, previousStage });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads Pipeline</h1>
          <p className="text-muted-foreground">
            Manage your sales pipeline from inquiry to ops handoff
          </p>
        </div>
        <div className="flex gap-2">
          <VoiceDialer />
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <LeadStatsBar leads={leads} />

      {/* Search, Filters, and View Toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View Toggle - hide on mobile */}
          {!isMobile && (
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  viewMode === "kanban"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-4 w-4" />
                Table
              </button>
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <LeadQuickFilters
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          availableSources={availableSources}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading leads...</div>
      ) : isMobile ? (
        <LeadMobileView
          leads={filteredLeads}
          onSelectLead={handleSelectLead}
          onStageChange={handleStageChange}
        />
      ) : viewMode === "kanban" ? (
        <LeadKanbanBoard
          leads={filteredLeads}
          onSelectLead={handleSelectLead}
          onRefresh={refetch}
        />
      ) : (
        <LeadTableView leads={filteredLeads} onSelectLead={handleSelectLead} />
      )}

      {/* Modals */}
      <LeadDetailModal
        lead={selectedLead}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRefresh={refetch}
      />

      <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
};

export default Leads;
