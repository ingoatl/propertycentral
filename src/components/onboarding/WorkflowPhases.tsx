import { useState } from "react";
import { OnboardingTask } from "@/types/onboarding";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";
import { PhaseCard } from "./PhaseCard";

interface WorkflowPhasesProps {
  projectId: string;
  tasks: OnboardingTask[];
  onTaskUpdate: () => void;
}

export const WorkflowPhases = ({ projectId, tasks, onTaskUpdate }: WorkflowPhasesProps) => {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));

  const getPhaseCompletion = (phaseNumber: number) => {
    const phaseTasks = tasks.filter(t => t.phase_number === phaseNumber);
    if (phaseTasks.length === 0) return 0;
    const completed = phaseTasks.filter(t => t.status === "completed").length;
    return (completed / phaseTasks.length) * 100;
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

  return (
    <div className="space-y-4">
      {ONBOARDING_PHASES.map((phase) => {
        const phaseTasks = tasks.filter(t => t.phase_number === phase.id);
        const completion = getPhaseCompletion(phase.id);

        return (
          <PhaseCard
            key={phase.id}
            phase={phase}
            tasks={phaseTasks}
            completion={completion}
            unlocked={true}
            expanded={expandedPhases.has(phase.id)}
            onToggle={() => togglePhase(phase.id)}
            onTaskUpdate={onTaskUpdate}
          />
        );
      })}
    </div>
  );
};
