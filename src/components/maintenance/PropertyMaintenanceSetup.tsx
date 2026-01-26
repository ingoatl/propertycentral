import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Settings, Snowflake, Droplets, Bug, Leaf, Wrench, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface MaintenanceTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  frequency_type: string;
  frequency_months: number;
  estimated_cost_low?: number;
  estimated_cost_high?: number;
}

interface PropertySchedule {
  id: string;
  property_id: string;
  template_id: string;
  is_enabled: boolean;
  preferred_vendor_id?: string;
  last_completed_at?: string;
  next_due_at?: string;
  custom_frequency_months?: number;
}

interface Vendor {
  id: string;
  name: string;
  specialty: string[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  hvac: Snowflake,
  plumbing: Droplets,
  pest_control: Bug,
  exterior: Leaf,
  general: Wrench,
  appliances: Wrench,
  pool_spa: Droplets,
};

interface PropertyMaintenanceSetupProps {
  propertyId: string;
  propertyName?: string;
}

export function PropertyMaintenanceSetup({ propertyId, propertyName }: PropertyMaintenanceSetupProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["maintenance-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preventive_maintenance_templates")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as MaintenanceTemplate[];
    },
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["property-maintenance-schedules", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_maintenance_schedules")
        .select("*")
        .eq("property_id", propertyId);
      if (error) throw error;
      return data as PropertySchedule[];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, specialty")
        .in("status", ["active", "preferred"])
        .order("name");
      if (error) throw error;
      return data as Vendor[];
    },
  });

  const getScheduleForTemplate = (templateId: string) => {
    return schedules.find((s) => s.template_id === templateId);
  };

  const toggleSchedule = async (template: MaintenanceTemplate, enabled: boolean) => {
    setSavingId(template.id);
    try {
      const existingSchedule = getScheduleForTemplate(template.id);

      if (existingSchedule) {
        const { error } = await supabase
          .from("property_maintenance_schedules")
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq("id", existingSchedule.id);
        if (error) throw error;
      } else {
        // Calculate next due date
        const nextDue = new Date();
        nextDue.setMonth(nextDue.getMonth() + template.frequency_months);

        const { error } = await supabase.from("property_maintenance_schedules").insert({
          property_id: propertyId,
          template_id: template.id,
          is_enabled: enabled,
          next_due_at: format(nextDue, "yyyy-MM-dd"),
        });
        if (error) throw error;
      }

      toast.success(enabled ? `${template.name} enabled` : `${template.name} disabled`);
      queryClient.invalidateQueries({ queryKey: ["property-maintenance-schedules", propertyId] });
    } catch (error: any) {
      toast.error("Failed to update: " + error.message);
    } finally {
      setSavingId(null);
    }
  };

  const updatePreferredVendor = async (templateId: string, vendorId: string | null) => {
    setSavingId(templateId);
    try {
      const existingSchedule = getScheduleForTemplate(templateId);
      
      if (existingSchedule) {
        const { error } = await supabase
          .from("property_maintenance_schedules")
          .update({ 
            preferred_vendor_id: vendorId || null, 
            updated_at: new Date().toISOString() 
          })
          .eq("id", existingSchedule.id);
        if (error) throw error;
      }

      toast.success("Preferred vendor updated");
      queryClient.invalidateQueries({ queryKey: ["property-maintenance-schedules", propertyId] });
    } catch (error: any) {
      toast.error("Failed to update vendor: " + error.message);
    } finally {
      setSavingId(null);
    }
  };

  const getVendorsForCategory = (category: string) => {
    return vendors.filter((v) => v.specialty?.includes(category) || v.specialty?.includes("general"));
  };

  const getFrequencyLabel = (type: string, months: number) => {
    if (type === "monthly") return "Monthly";
    if (type === "quarterly") return "Every 3 months";
    if (type === "biannual") return "Every 6 months";
    if (type === "annual") return "Yearly";
    return `Every ${months} months`;
  };

  const isLoading = templatesLoading || schedulesLoading;

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, MaintenanceTemplate[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Preventive Maintenance Setup
        </CardTitle>
        <CardDescription>
          Configure recurring maintenance schedules for {propertyName || "this property"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => {
              const Icon = CATEGORY_ICONS[category] || Wrench;
              return (
                <div key={category}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    <Icon className="h-4 w-4" />
                    {category.replace("_", " ")}
                  </h3>
                  <div className="space-y-3">
                    {categoryTemplates.map((template) => {
                      const schedule = getScheduleForTemplate(template.id);
                      const isEnabled = schedule?.is_enabled ?? false;
                      const categoryVendors = getVendorsForCategory(category);
                      const isSaving = savingId === template.id;

                      return (
                        <div
                          key={template.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isEnabled ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{template.name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {getFrequencyLabel(template.frequency_type, template.frequency_months)}
                                </Badge>
                              </div>
                              {template.description && (
                                <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {template.estimated_cost_low && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    ${template.estimated_cost_low} - ${template.estimated_cost_high}
                                  </span>
                                )}
                                {schedule?.next_due_at && isEnabled && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Next: {format(new Date(schedule.next_due_at + "T12:00:00"), "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => toggleSchedule(template, checked)}
                                disabled={isSaving}
                              />
                            </div>
                          </div>

                          {isEnabled && (
                            <div className="mt-4 pt-4 border-t">
                              <label className="text-sm text-muted-foreground block mb-2">
                                Preferred Vendor
                              </label>
                              <Select
                                value={schedule?.preferred_vendor_id || "auto"}
                                onValueChange={(value) => 
                                  updatePreferredVendor(template.id, value === "auto" ? null : value)
                                }
                                disabled={isSaving}
                              >
                                <SelectTrigger className="w-full max-w-xs">
                                  <SelectValue placeholder="Auto-assign best vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Auto-assign best vendor</SelectItem>
                                  {categoryVendors.map((vendor) => (
                                    <SelectItem key={vendor.id} value={vendor.id}>
                                      {vendor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PropertyMaintenanceSetup;
