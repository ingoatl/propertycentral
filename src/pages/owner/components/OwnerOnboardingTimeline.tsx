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
// The step index represents the CURRENT step we're working on (not completed)
function getTimelineStep(stage: string | null): number {
  switch(stage) {
    case 'new_lead':
    case 'contacted':
    case 'discovery_call_scheduled':
    case 'discovery_call_completed':
    case 'proposal_sent':
    case 'contract_out':
    case 'contract_signed': 
      return 0; // Current step: Payment Setup
    case 'ach_form_signed': 
    case 'onboarding_form_requested': 
      return 1; // Current step: Onboarding Form (requested = waiting for it)
    case 'insurance_requested': 
      return 2; // Current step: Insurance (requested = waiting for it)
    case 'inspection_scheduled': 
      return 3; // Current step: Inspection
    case 'ops_handoff': 
      return 5; // All done
    default: 
      return 0; // Default to first step
  }
}

function getStepDescription(step: number): string {
  switch(step) {
    case 0: return "We're setting up your payment processing";
    case 1: return "Please complete your onboarding form";
    case 2: return "Please submit your insurance documentation";
    case 3: return "Scheduling your property inspection";
    case 4: return "Final preparations before going live!";
    default: return "Getting started";
  }
}

interface OwnerOnboardingTimelineProps {
  onboardingStage: string | null;
}

export function OwnerOnboardingTimeline({ onboardingStage }: OwnerOnboardingTimelineProps) {
  // Don't show if no onboarding stage
  if (!onboardingStage) {
    return null;
  }

  const currentStep = getTimelineStep(onboardingStage);

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
