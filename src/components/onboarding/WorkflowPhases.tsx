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
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1);

  const getPhaseCompletion = (phaseNumber: number) => {
    const phaseTasks = tasks.filter(t => t.phase_number === phaseNumber);
    if (phaseTasks.length === 0) return 0;
    const completed = phaseTasks.filter(t => t.status === "completed").length;
    return (completed / phaseTasks.length) * 100;
  };

  const isPhaseUnlocked = (phaseNumber: number) => {
    return true; // All phases are always unlocked
  };

  return (
    <div className="space-y-4">
      {ONBOARDING_PHASES.map((phase) => {
        const phaseTasks = tasks.filter(t => t.phase_number === phase.id);
        const completion = getPhaseCompletion(phase.id);
        const unlocked = isPhaseUnlocked(phase.id);

        return (
          <PhaseCard
            key={phase.id}
            phase={phase}
            tasks={phaseTasks}
            completion={completion}
            unlocked={unlocked}
            expanded={expandedPhase === phase.id}
            onToggle={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
            onTaskUpdate={onTaskUpdate}
          />
        );
      })}
    </div>
  );
};
