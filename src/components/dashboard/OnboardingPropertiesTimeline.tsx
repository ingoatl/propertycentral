import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Owner-facing onboarding timeline steps (5 steps including payment)
const ONBOARDING_STEPS = [
  { key: 'payment', label: 'Payment Setup', shortLabel: 'Payment' },
  { key: 'onboarding_form', label: 'Onboarding Form', shortLabel: 'Form' },
  { key: 'insurance', label: 'Insurance', shortLabel: 'Insurance' },
  { key: 'inspection', label: 'Inspection', shortLabel: 'Inspect' },
  { key: 'onboarded', label: 'Go Live', shortLabel: 'Live' },
];

// Map lead stages to timeline step index
function getTimelineStep(stage: string | null): number {
  switch(stage) {
    case 'new_lead':
    case 'contacted':
    case 'discovery_call_scheduled':
    case 'discovery_call_completed':
    case 'proposal_sent':
    case 'contract_out':
      return 0; // Pre-payment stages - at step 0
    case 'contract_signed': 
      return 0; // Current step: Setup Payment
    case 'ach_form_signed': 
      return 1; // Current step: Complete Onboarding Form
    case 'onboarding_form_requested': 
      return 2; // Current step: Submit Insurance
    case 'insurance_requested': 
      return 3; // Current step: Schedule Inspection
    case 'inspection_scheduled': 
      return 4; // Current step: Go Live
    case 'ops_handoff': 
      return 5; // All done
    default: 
      return 0; // Default to first step for properties without a lead stage
  }
}

function getStageLabel(stage: string | null): string {
  switch(stage) {
    case 'new_lead': return 'New Lead';
    case 'contacted': return 'Contacted';
    case 'discovery_call_scheduled': return 'Call Scheduled';
    case 'discovery_call_completed': return 'Call Completed';
    case 'proposal_sent': return 'Proposal Sent';
    case 'contract_out': return 'Contract Out';
    case 'contract_signed': return 'Payment Setup';
    case 'ach_form_signed': return 'Onboarding Form';
    case 'onboarding_form_requested': return 'Insurance';
    case 'insurance_requested': return 'Inspection';
    case 'inspection_scheduled': return 'Go Live';
    case 'ops_handoff': return 'Onboarded';
    default: return 'Not Started';
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
      // Active onboarding stages - properties we want to show
      const onboardingStages = ['contract_signed', 'ach_form_signed', 'onboarding_form_requested', 'insurance_requested', 'inspection_scheduled'] as const;
      
      // Get leads that are in active onboarding stages and have linked properties
      const { data: leads, error } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          stage,
          property_id,
          properties!leads_property_id_fkey (
            id,
            name,
            address,
            first_listing_live_at
          )
        `)
        .in("stage", onboardingStages)
        .not("property_id", "is", null);

      if (error) throw error;

      // Map leads with properties to our format
      const onboardingProperties: OnboardingProperty[] = (leads || [])
        .filter(l => l.properties && !(l.properties as any).first_listing_live_at)
        .map(l => {
          const property = l.properties as any;
          return {
            id: property.id,
            name: property.name,
            address: property.address || 'Address pending',
            leadId: l.id,
            leadName: l.name,
            stage: l.stage,
            currentStep: getTimelineStep(l.stage),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return onboardingProperties;
    },
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader className="pb-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!properties || properties.length === 0) {
    return null;
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
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((property) => (
            <div 
              key={property.id}
              className="bg-background rounded-xl border shadow-sm p-4 space-y-4 hover:shadow-md transition-shadow"
            >
              {/* Property Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-base truncate">{property.name}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{property.address}</span>
                  </p>
                  {property.leadName && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Owner: {property.leadName}
                    </p>
                  )}
                </div>
                <Badge 
                  variant="outline" 
                  className="bg-primary/10 text-primary border-primary/30 flex-shrink-0 text-xs"
                >
                  {getStageLabel(property.stage)}
                </Badge>
              </div>

              {/* Beautiful Timeline */}
              <div className="relative">
                {/* Timeline Track */}
                <div className="flex items-center justify-between">
                  {ONBOARDING_STEPS.map((step, index) => {
                    const isCompleted = index < property.currentStep;
                    const isCurrent = index === property.currentStep;
                    
                    return (
                      <div key={step.key} className="flex flex-col items-center relative z-10">
                        {/* Step Circle with Number */}
                        <div 
                          className={cn(
                            "flex items-center justify-center rounded-full transition-all duration-300 shadow-sm",
                            "w-9 h-9 text-sm font-bold",
                            isCompleted && "bg-green-500 text-white shadow-green-500/30",
                            isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-primary/30",
                            !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>
                        
                        {/* Step Label */}
                        <span className={cn(
                          "text-[10px] mt-1.5 text-center leading-tight font-medium",
                          isCompleted && "text-green-600",
                          isCurrent && "text-primary",
                          !isCompleted && !isCurrent && "text-muted-foreground"
                        )}>
                          {step.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Connector Lines - positioned behind circles */}
                <div className="absolute top-[18px] left-[18px] right-[18px] flex -z-0">
                  {ONBOARDING_STEPS.slice(0, -1).map((_, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "flex-1 h-0.5 transition-colors duration-300",
                        index < property.currentStep ? "bg-green-500" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}