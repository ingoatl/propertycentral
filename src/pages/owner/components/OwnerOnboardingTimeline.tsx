import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Owner-facing onboarding timeline steps
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
      return 0;
  }
}

function getStepDescription(step: number): string {
  switch(step) {
    case 0: return "We're setting up your payment processing";
    case 1: return "Please complete your onboarding form";
    case 2: return "Awaiting insurance documentation";
    case 3: return "Scheduling your property inspection";
    case 4: return "Final preparations before going live!";
    default: return "Getting started";
  }
}

interface OwnerOnboardingTimelineProps {
  propertyId: string;
}

export function OwnerOnboardingTimeline({ propertyId }: OwnerOnboardingTimelineProps) {
  const { data: leadInfo, isLoading } = useQuery({
    queryKey: ["owner-onboarding-status", propertyId],
    queryFn: async () => {
      // Active onboarding stages
      const onboardingStages = ['contract_signed', 'ach_form_signed', 'onboarding_form_requested', 'insurance_requested', 'inspection_scheduled'] as const;
      
      // Check if this property has a lead in an onboarding stage
      const { data, error } = await supabase
        .from("leads")
        .select("id, stage")
        .eq("property_id", propertyId)
        .in("stage", onboardingStages)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  // Don't show if loading or no onboarding lead
  if (isLoading || !leadInfo) {
    return null;
  }

  const currentStep = getTimelineStep(leadInfo.stage);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-lg mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-xl">🏗️</span>
          Onboarding Progress
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {getStepDescription(currentStep)}
        </p>
      </CardHeader>
      <CardContent>
        {/* Timeline */}
        <div className="relative">
          {/* Timeline Track */}
          <div className="flex items-center justify-between">
            {ONBOARDING_STEPS.map((step, index) => {
              const isCompleted = index < currentStep;
              const isCurrent = index === currentStep;
              
              return (
                <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
                  {/* Step Circle */}
                  <div 
                    className={cn(
                      "flex items-center justify-center rounded-full transition-all duration-300 shadow-sm",
                      "w-10 h-10 text-sm font-bold",
                      isCompleted && "bg-green-500 text-white shadow-green-500/30",
                      isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-primary/30 animate-pulse",
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
                    "text-xs mt-2 text-center leading-tight font-medium",
                    isCompleted && "text-green-600",
                    isCurrent && "text-primary font-semibold",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}>
                    {step.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Connector Lines */}
          <div className="absolute top-5 left-[10%] right-[10%] flex -z-0">
            {ONBOARDING_STEPS.slice(0, -1).map((_, index) => (
              <div 
                key={index}
                className={cn(
                  "flex-1 h-0.5 transition-colors duration-300",
                  index < currentStep ? "bg-green-500" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
