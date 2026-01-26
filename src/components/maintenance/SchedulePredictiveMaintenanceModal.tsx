import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Calendar, Wrench, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SchedulePredictiveMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPropertyId?: string;
}

interface AISuggestion {
  template_id: string;
  template_name: string;
  category: string;
  recommended_date: string;
  priority: "high" | "medium" | "low";
  reasoning: string;
  frequency_months: number;
}

interface AIResponse {
  suggestions: AISuggestion[];
  cluster_opportunity?: string;
  property_insights?: string;
}

export function SchedulePredictiveMaintenanceModal({
  open,
  onOpenChange,
  preselectedPropertyId
}: SchedulePredictiveMaintenanceModalProps) {
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(preselectedPropertyId || "");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [autoAssignVendors, setAutoAssignVendors] = useState(true);
  const [autoDispatch, setAutoDispatch] = useState(false);
  const [notifyOwner, setNotifyOwner] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIResponse | null>(null);

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ["properties-for-maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, created_at")
        .is("offboarded_at", null)
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  // Fetch maintenance templates
  const { data: templates } = useQuery({
    queryKey: ["preventive-maintenance-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preventive_maintenance_templates")
        .select("*")
        .eq("is_active", true)
        .order("category, name");
      if (error) throw error;
      return data;
    }
  });

  // Fetch vendors by specialty
  const { data: vendors } = useQuery({
    queryKey: ["vendors-by-specialty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, specialty, status, average_rating")
        .in("status", ["active", "preferred"])
        .order("average_rating", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch existing schedules for selected property
  const { data: existingSchedules } = useQuery({
    queryKey: ["property-maintenance-schedules", selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return [];
      const { data, error } = await supabase
        .from("property_maintenance_schedules")
        .select("template_id, is_enabled")
        .eq("property_id", selectedPropertyId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPropertyId
  });

  // Get AI suggestions when property is selected
  useEffect(() => {
    if (selectedPropertyId && templates?.length) {
      fetchAISuggestions();
    }
  }, [selectedPropertyId, templates]);

  const fetchAISuggestions = async () => {
    if (!selectedPropertyId) return;
    
    setIsLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-maintenance-schedule", {
        body: { propertyId: selectedPropertyId }
      });
      
      if (error) throw error;
      
      setAiSuggestions(data);
      
      // Auto-select high priority tasks
      if (data?.suggestions) {
        const highPriorityIds = new Set<string>(
          data.suggestions
            .filter((s: AISuggestion) => s.priority === "high")
            .map((s: AISuggestion) => s.template_id)
        );
        setSelectedTasks(highPriorityIds);
      }
    } catch (err) {
      console.error("Failed to get AI suggestions:", err);
      // Fall back to showing all templates without suggestions
      setAiSuggestions(null);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Create schedules mutation
  const createSchedulesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPropertyId || selectedTasks.size === 0) {
        throw new Error("Please select a property and at least one task");
      }

      const schedulesToCreate = Array.from(selectedTasks).map(templateId => {
        const suggestion = aiSuggestions?.suggestions?.find(s => s.template_id === templateId);
        const template = templates?.find(t => t.id === templateId);
        
        return {
          property_id: selectedPropertyId,
          template_id: templateId,
          is_enabled: true,
          next_due_at: suggestion?.recommended_date || getDefaultNextDate(template?.frequency_months || 12),
          preferred_vendor_id: null // Will be auto-assigned if enabled
        };
      });

      // Upsert schedules
      const { error } = await supabase
        .from("property_maintenance_schedules")
        .upsert(schedulesToCreate, { 
          onConflict: "property_id,template_id",
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Update automation settings
      const { error: settingsError } = await supabase
        .from("property_maintenance_settings")
        .upsert({
          property_id: selectedPropertyId,
          auto_dispatch_enabled: autoDispatch,
          auto_dispatch_days_before: 7,
          notify_owner_before_maintenance: notifyOwner,
          updated_at: new Date().toISOString()
        }, { onConflict: "property_id" });

      if (settingsError) throw settingsError;

      // Auto-assign vendors if enabled
      if (autoAssignVendors) {
        for (const templateId of selectedTasks) {
          const template = templates?.find(t => t.id === templateId);
          if (template) {
            await supabase.functions.invoke("auto-assign-preventive-vendor", {
              body: {
                propertyId: selectedPropertyId,
                category: template.category,
                preferredVendorId: null
              }
            });
          }
        }
      }

      return schedulesToCreate.length;
    },
    onSuccess: (count) => {
      toast.success(`Scheduled ${count} maintenance tasks`);
      queryClient.invalidateQueries({ queryKey: ["property-maintenance-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-maintenance-tasks"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to schedule: ${error.message}`);
    }
  });

  const getDefaultNextDate = (frequencyMonths: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() + frequencyMonths);
    return date.toISOString().split("T")[0];
  };

  const toggleTask = (templateId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  const selectAllTasks = () => {
    if (templates) {
      setSelectedTasks(new Set(templates.map(t => t.id)));
    }
  };

  const deselectAllTasks = () => {
    setSelectedTasks(new Set());
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">High Priority</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-xs">Medium</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Low</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      hvac: "❄️",
      plumbing: "🔧",
      electrical: "⚡",
      appliances: "🔌",
      general: "🛠️",
      exterior: "🌳",
      cleaning: "🧹",
      pest_control: "🐛",
      safety: "🔒",
      pool_spa: "🏊"
    };
    return icons[category] || "🔧";
  };

  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
  const alreadyScheduledIds = new Set(existingSchedules?.filter(s => s.is_enabled).map(s => s.template_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Schedule Predictive Maintenance
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Step 1: Property Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Step 1: Select Property</Label>
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a property..." />
              </SelectTrigger>
              <SelectContent>
                {properties?.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPropertyId && (
            <>
              {/* AI Insights */}
              {isLoadingAI ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">AI analyzing property for optimal schedule...</span>
                  </CardContent>
                </Card>
              ) : aiSuggestions?.property_insights ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-primary mb-1">AI Insights</p>
                        <p className="text-muted-foreground">{aiSuggestions.property_insights}</p>
                        {aiSuggestions.cluster_opportunity && (
                          <p className="text-muted-foreground mt-2 italic">
                            💡 {aiSuggestions.cluster_opportunity}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Step 2: Task Selection */}
              <div className="space-y-2 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Step 2: Select Maintenance Tasks</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllTasks}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAllTasks}>
                      Clear
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[280px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {templates?.map(template => {
                      const suggestion = aiSuggestions?.suggestions?.find(s => s.template_id === template.id);
                      const isScheduled = alreadyScheduledIds.has(template.id);
                      const isSelected = selectedTasks.has(template.id);

                      return (
                        <div
                          key={template.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                          } ${isScheduled ? "opacity-60" : ""}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleTask(template.id)}
                            disabled={isScheduled}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg">{getCategoryIcon(template.category)}</span>
                              <span className="font-medium text-sm">{template.name}</span>
                              {suggestion && getPriorityBadge(suggestion.priority)}
                              {isScheduled && (
                                <Badge variant="outline" className="text-xs text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Already Scheduled
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Every {template.frequency_months} month{template.frequency_months > 1 ? "s" : ""}
                              </span>
                              {suggestion && (
                                <span className="flex items-center gap-1 text-primary">
                                  <Sparkles className="h-3 w-3" />
                                  Suggested: {new Date(suggestion.recommended_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {suggestion?.reasoning && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {suggestion.reasoning}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Step 3: Automation Settings */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">Step 3: Automation Settings</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="auto-assign" className="text-sm">Auto-assign vendors</Label>
                    </div>
                    <Switch
                      id="auto-assign"
                      checked={autoAssignVendors}
                      onCheckedChange={setAutoAssignVendors}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="auto-dispatch" className="text-sm">Auto-dispatch (7 days prior)</Label>
                    </div>
                    <Switch
                      id="auto-dispatch"
                      checked={autoDispatch}
                      onCheckedChange={setAutoDispatch}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="notify-owner" className="text-sm">Notify owner</Label>
                    </div>
                    <Switch
                      id="notify-owner"
                      checked={notifyOwner}
                      onCheckedChange={setNotifyOwner}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t pt-4 mt-4">
          <div className="text-sm text-muted-foreground">
            {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createSchedulesMutation.mutate()}
              disabled={!selectedPropertyId || selectedTasks.size === 0 || createSchedulesMutation.isPending}
            >
              {createSchedulesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Schedule {selectedTasks.size} Task{selectedTasks.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
