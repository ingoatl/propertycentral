import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Sparkles, Calendar as CalendarIcon, Wrench, AlertCircle, CheckCircle2, User, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(preselectedPropertyId || "");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [lastMaintenanceDates, setLastMaintenanceDates] = useState<Record<string, Date | undefined>>({});
  const [autoAssignVendors, setAutoAssignVendors] = useState(true);
  const [manualVendorId, setManualVendorId] = useState<string>("");
  const [autoDispatch, setAutoDispatch] = useState(false);
  const [notifyOwner, setNotifyOwner] = useState(true);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIResponse | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setSelectedTasks(new Set());
      setLastMaintenanceDates({});
      setAiSuggestions(null);
    }
  }, [open]);

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

  // Get AI suggestions when step 3 is reached
  const fetchAISuggestions = async () => {
    if (!selectedPropertyId) return;
    
    setIsLoadingAI(true);
    try {
      // Build last maintenance data for AI
      const lastMaintenanceData = Object.entries(lastMaintenanceDates).reduce((acc, [templateId, date]) => {
        if (date) {
          const template = templates?.find(t => t.id === templateId);
          acc[template?.name || templateId] = format(date, "yyyy-MM-dd");
        }
        return acc;
      }, {} as Record<string, string>);

      const { data, error } = await supabase.functions.invoke("ai-suggest-maintenance-schedule", {
        body: { 
          propertyId: selectedPropertyId,
          lastMaintenanceDates: lastMaintenanceData
        }
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
          preferred_vendor_id: !autoAssignVendors && manualVendorId ? manualVendorId : null
        };
      });

      // Upsert schedules
      const { data: insertedSchedules, error } = await supabase
        .from("property_maintenance_schedules")
        .upsert(schedulesToCreate, { 
          onConflict: "property_id,template_id",
          ignoreDuplicates: false 
        })
        .select("id");

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

      // Auto-assign vendors if enabled (or use manual selection)
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
      } else if (manualVendorId) {
        // Update schedules with the manually selected vendor
        for (const templateId of selectedTasks) {
          await supabase
            .from("property_maintenance_schedules")
            .update({ preferred_vendor_id: manualVendorId })
            .eq("property_id", selectedPropertyId)
            .eq("template_id", templateId);
        }
      }

      // Send notifications to vendor and owner
      const scheduleIds = insertedSchedules?.map(s => s.id) || [];
      if (scheduleIds.length > 0) {
        try {
          const { data: notifyResult, error: notifyError } = await supabase.functions.invoke("notify-preventive-schedule", {
            body: {
              scheduleIds,
              propertyId: selectedPropertyId,
              notifyVendor: true,
              notifyOwner: notifyOwner
            }
          });
          
          if (notifyError) {
            console.error("Notification error:", notifyError);
          } else {
            console.log("Notifications sent:", notifyResult);
          }
        } catch (notifyErr) {
          console.error("Failed to send notifications:", notifyErr);
        }
      }

      return schedulesToCreate.length;
    },
    onSuccess: (count) => {
      toast.success(`Scheduled ${count} maintenance tasks. Notifications sent to vendor and owner.`);
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

  const handleNextStep = () => {
    if (currentStep === 2) {
      // Moving to step 3, fetch AI suggestions
      fetchAISuggestions();
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
  const alreadyScheduledIds = new Set(existingSchedules?.filter(s => s.is_enabled).map(s => s.template_id));

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!selectedPropertyId;
      case 2: return true; // Last maintenance dates are optional
      case 3: return selectedTasks.size > 0;
      case 4: return autoAssignVendors || !!manualVendorId;
      case 5: return true;
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Schedule Predictive Maintenance
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 5: {
              currentStep === 1 ? "Select Property" :
              currentStep === 2 ? "Last Maintenance Dates" :
              currentStep === 3 ? "Select Tasks" :
              currentStep === 4 ? "Vendor Assignment" :
              "Automation Settings"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={cn(
                "flex-1 h-2 rounded-full transition-colors",
                step <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Step 1: Property Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">Select Property</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a property..." />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.address || property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProperty && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">{selectedProperty.address || selectedProperty.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Property since {format(new Date(selectedProperty.created_at), "MMM yyyy")}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Last Maintenance Dates */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">When was the last maintenance performed?</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Enter dates for any maintenance that has been done. This helps AI schedule tasks appropriately.
              </p>
              <ScrollArea className="h-[350px] border rounded-lg p-3">
                <div className="space-y-3">
                  {templates?.map(template => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getCategoryIcon(template.category)}</span>
                        <div>
                          <p className="text-sm font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Recommended every {template.frequency_months} month{template.frequency_months > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-[140px] justify-start text-left font-normal",
                              !lastMaintenanceDates[template.id] && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {lastMaintenanceDates[template.id]
                              ? format(lastMaintenanceDates[template.id]!, "MMM d, yyyy")
                              : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={lastMaintenanceDates[template.id]}
                            onSelect={(date) => setLastMaintenanceDates(prev => ({
                              ...prev,
                              [template.id]: date
                            }))}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Task Selection */}
          {currentStep === 3 && (
            <>
              {/* AI Insights */}
              {isLoadingAI ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">AI analyzing property and maintenance history...</span>
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

              <div className="space-y-2 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Select Maintenance Tasks</Label>
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
                                <Badge variant="outline" className="text-xs text-primary">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Already Scheduled
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
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
            </>
          )}

          {/* Step 4: Vendor Assignment */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">Vendor Assignment</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="auto-assign" className="text-sm">Auto-assign by specialty</Label>
                  </div>
                  <Switch
                    id="auto-assign"
                    checked={autoAssignVendors}
                    onCheckedChange={(checked) => {
                      setAutoAssignVendors(checked);
                      if (checked) setManualVendorId("");
                    }}
                  />
                </div>
                {!autoAssignVendors && (
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <Label className="text-sm mb-2 block flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Select Vendor
                    </Label>
                    <Select value={manualVendorId} onValueChange={setManualVendorId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose vendor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors?.map(vendor => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name} {vendor.specialty?.length > 0 && `(${vendor.specialty.join(", ")})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {autoAssignVendors 
                      ? "The system will automatically assign the best-rated vendor for each task category."
                      : manualVendorId 
                        ? `All selected tasks will be assigned to ${vendors?.find(v => v.id === manualVendorId)?.name}.`
                        : "Please select a vendor to assign all tasks to."}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Automation Settings */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <Label className="text-sm font-medium">Automation Settings</Label>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="auto-dispatch" className="text-sm font-medium">Auto-dispatch</Label>
                      <p className="text-xs text-muted-foreground">Automatically notify vendor 7 days before due date</p>
                    </div>
                  </div>
                  <Switch
                    id="auto-dispatch"
                    checked={autoDispatch}
                    onCheckedChange={setAutoDispatch}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="notify-owner" className="text-sm font-medium">Owner notifications</Label>
                      <p className="text-xs text-muted-foreground">Send email to property owner about scheduled maintenance</p>
                    </div>
                  </div>
                  <Switch
                    id="notify-owner"
                    checked={notifyOwner}
                    onCheckedChange={setNotifyOwner}
                  />
                </div>
              </div>

              {/* Summary */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <h4 className="font-medium text-sm mb-2">Summary</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>📍 Property: {selectedProperty?.address || selectedProperty?.name}</p>
                    <p>📋 Tasks: {selectedTasks.size} maintenance task{selectedTasks.size !== 1 ? "s" : ""}</p>
                    <p>👷 Vendor: {autoAssignVendors ? "Auto-assigned by specialty" : vendors?.find(v => v.id === manualVendorId)?.name}</p>
                    <p>📧 Owner notification: {notifyOwner ? "Enabled" : "Disabled"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t pt-4 mt-4">
          <div className="text-sm text-muted-foreground">
            {currentStep === 3 && `${selectedTasks.size} task${selectedTasks.size !== 1 ? "s" : ""} selected`}
          </div>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrevStep}>
                Back
              </Button>
            )}
            {currentStep < 5 ? (
              <Button onClick={handleNextStep} disabled={!canProceed()}>
                Continue
              </Button>
            ) : (
              <Button
                onClick={() => createSchedulesMutation.mutate()}
                disabled={!canProceed() || createSchedulesMutation.isPending}
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
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
