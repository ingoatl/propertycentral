import { useState, useEffect } from "react";
import { OnboardingTask } from "@/types/onboarding";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";
import { MobilePhaseCard } from "./MobilePhaseCard";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface MobileWorkflowPhasesProps {
  projectId: string;
  tasks: OnboardingTask[];
  onTaskUpdate: () => void;
  taskId?: string;
  isPartnerProperty?: boolean;
}

export const MobileWorkflowPhases = ({ 
  projectId, 
  tasks, 
  onTaskUpdate, 
  taskId,
  isPartnerProperty = false 
}: MobileWorkflowPhasesProps) => {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(() => new Set());
  const { isAdmin } = useAdminCheck();

  // Auto-expand phase containing target task
  useEffect(() => {
    if (taskId && tasks.length > 0) {
      const targetTask = tasks.find(t => t.id === taskId);
      if (targetTask) {
        setExpandedPhases(prev => new Set([...prev, targetTask.phase_number]));
      }
    }
  }, [taskId, tasks]);

  const getPhaseCompletion = (phaseNumber: number) => {
    const phaseTasks = tasks.filter(t => 
      t.phase_number === phaseNumber && t.field_type !== 'section_header'
    );
    if (phaseTasks.length === 0) return 0;
    
    const tasksWithProgress = phaseTasks.filter(
      t => t.status === "completed" || (t.field_value && t.field_value.trim() !== "")
    ).length;
    
    return (tasksWithProgress / phaseTasks.length) * 100;
  };

  const togglePhase = (phaseNumber: number) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseNumber)) {
        newSet.delete(phaseNumber);
      } else {
        newSet.add(phaseNumber);
      }
      return newSet;
    });
  };

  // For partner properties, only show Phase 7 (Listings)
  const phasesToShow = isPartnerProperty 
    ? ONBOARDING_PHASES.filter(phase => phase.id === 7)
    : ONBOARDING_PHASES;

  return (
    <div className="space-y-3">
      {phasesToShow.map((phase) => {
        const phaseTasks = tasks.filter(t => t.phase_number === phase.id);
        const completion = getPhaseCompletion(phase.id);
        const shouldExpand = expandedPhases.has(phase.id);

        // Skip empty phases for partner properties
        if (isPartnerProperty && phaseTasks.length === 0) {
          return null;
        }

        return (
          <MobilePhaseCard
            key={phase.id}
            phase={phase}
            tasks={phaseTasks}
            completion={completion}
            expanded={shouldExpand}
            onToggle={() => togglePhase(phase.id)}
            onTaskUpdate={onTaskUpdate}
            projectId={projectId}
            isAdmin={isAdmin}
          />
        );
      })}
    </div>
  );
};
