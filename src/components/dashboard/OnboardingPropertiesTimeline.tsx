import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Owner-facing onboarding timeline steps (5 steps including payment)
const ONBOARDING_STEPS = [
  { key: 'payment', label: 'Payment Setup', shortLabel: 'Payment', icon: '💳' },
  { key: 'onboarding_form', label: 'Onboarding Form', shortLabel: 'Form', icon: '📋' },
  { key: 'insurance', label: 'Insurance', shortLabel: 'Insurance', icon: '🛡️' },
  { key: 'inspection', label: 'Inspection', shortLabel: 'Inspect', icon: '🏠' },
  { key: 'onboarded', label: 'Go Live', shortLabel: 'Live', icon: '🎉' },
];

// Map lead stages to timeline step index
function getTimelineStep(stage: string | null): number {
  switch(stage) {
    case 'contract_signed': 
      return 0; // Current step: Setup Payment
    case 'ach_form_signed': 
      return 1; // Current step: Complete Onboarding Form
    case 'onboarding_form_requested': 
      return 2; // Current step: Submit Insurance
    case 'insurance_requested': 
      return 3; // Current step: Schedule Inspection
    case 'inspection_scheduled': 
      return 4; // Current step: Onboarded (final step)
    case 'ops_handoff': 
      return 5; // All done (beyond timeline - all checkmarks)
    default: 
      return -1; // Pre-onboarding stages (don't show timeline)
  }
}

function getStageLabel(stage: string | null): string {
  switch(stage) {
    case 'contract_signed': return 'Payment Setup';
    case 'ach_form_signed': return 'Onboarding Form';
    case 'onboarding_form_requested': return 'Insurance';
    case 'insurance_requested': return 'Inspection';
    case 'inspection_scheduled': return 'Go Live';
    case 'ops_handoff': return 'Onboarded';
    default: return 'Pre-Contract';
  }
}

interface OnboardingProperty {
  id: string;
  name: string;
  address: string;
  leadId: string | null;
  leadName: string | null;
  stage: string | null;
  currentStep: number;
}

export function OnboardingPropertiesTimeline() {
  const { data: properties, isLoading } = useQuery({
    queryKey: ["onboarding-properties-timeline"],
    queryFn: async () => {
      // Get properties that are not yet listed (no first_listing_live_at)
      // and have a linked lead in onboarding stages
      const { data, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          address,
          first_listing_live_at,
          leads!leads_property_id_fkey (
            id,
            name,
            stage
          )
        `)
        .is("first_listing_live_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter to only properties with leads in onboarding stages
      const onboardingStages = ['contract_signed', 'ach_form_signed', 'onboarding_form_requested', 'insurance_requested', 'inspection_scheduled'];
      
      const onboardingProperties: OnboardingProperty[] = (data || [])
        .filter(p => {
          const leads = p.leads as any[];
          if (!leads || leads.length === 0) return false;
          return leads.some(l => onboardingStages.includes(l.stage));
        })
        .map(p => {
          const leads = p.leads as any[];
          const lead = leads.find(l => onboardingStages.includes(l.stage)) || leads[0];
          return {
            id: p.id,
            name: p.name,
            address: p.address,
            leadId: lead?.id || null,
            leadName: lead?.name || null,
            stage: lead?.stage || null,
            currentStep: getTimelineStep(lead?.stage),
          };
        })
        .filter(p => p.currentStep >= 0); // Only show those with valid timeline position

      return onboardingProperties;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!properties || properties.length === 0) {
    return null; // Don't show the card if no properties are onboarding
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="text-2xl">🏗️</span>
              Properties Onboarding
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Track onboarding progress for new properties
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {properties.length} in progress
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {properties.map((property) => (
          <div 
            key={property.id}
            className="bg-background rounded-lg border p-4 space-y-3"
          >
            {/* Property Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-base">{property.name}</h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {property.address}
                </p>
                {property.leadName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Owner: {property.leadName}
                  </p>
                )}
              </div>
              <Badge 
                variant="outline" 
                className="bg-primary/10 text-primary border-primary/30"
              >
                {getStageLabel(property.stage)}
              </Badge>
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-1 pt-2">
              {ONBOARDING_STEPS.map((step, index) => {
                const isCompleted = index < property.currentStep;
                const isCurrent = index === property.currentStep;
                
                return (
                  <div key={step.key} className="flex items-center flex-1 last:flex-none">
                    {/* Step Circle */}
                    <div 
                      className={cn(
                        "relative flex items-center justify-center rounded-full transition-all",
                        "w-8 h-8 text-xs font-bold",
                        isCompleted && "bg-green-500 text-white",
                        isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2",
                        !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                      )}
                      title={step.label}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    
                    {/* Connector Line */}
                    {index < ONBOARDING_STEPS.length - 1 && (
                      <div 
                        className={cn(
                          "flex-1 h-0.5 mx-1",
                          index < property.currentStep ? "bg-green-500" : "bg-muted"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step Labels */}
            <div className="flex items-start pt-1">
              {ONBOARDING_STEPS.map((step, index) => {
                const isCompleted = index < property.currentStep;
                const isCurrent = index === property.currentStep;
                
                return (
                  <div 
                    key={step.key} 
                    className={cn(
                      "flex-1 text-center last:flex-none",
                      index === ONBOARDING_STEPS.length - 1 && "w-8"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] leading-tight",
                      isCompleted && "text-green-600 font-medium",
                      isCurrent && "text-primary font-semibold",
                      !isCompleted && !isCurrent && "text-muted-foreground"
                    )}>
                      {step.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}