import { useState, useEffect } from "react";
import { OnboardingTask } from "@/types/onboarding";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";
import { PhaseCard } from "./PhaseCard";

interface WorkflowPhasesProps {
  projectId: string;
  tasks: OnboardingTask[];
  onTaskUpdate: () => void;
  searchQuery?: string;
  taskId?: string;
}

export const WorkflowPhases = ({ projectId, tasks, onTaskUpdate, searchQuery = "", taskId }: WorkflowPhasesProps) => {
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  // Auto-expand phase containing the target task
  useEffect(() => {
    if (taskId && tasks.length > 0) {
      const targetTask = tasks.find(t => t.id === taskId);
      if (targetTask) {
        setExpandedPhases(prev => new Set([...prev, targetTask.phase_number]));
      }
    }
  }, [taskId, tasks]);

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

  // Auto-expand phases with matching tasks when searching
  const getHighlightedPhases = () => {
    if (!searchQuery) return new Set<number>();
    const phases = new Set<number>();
    tasks.forEach(task => {
      phases.add(task.phase_number);
    });
    return phases;
  };

  const highlightedPhases = getHighlightedPhases();

  return (
    <div className="space-y-4">
      {ONBOARDING_PHASES.map((phase) => {
        const phaseTasks = tasks.filter(t => t.phase_number === phase.id);
        const completion = getPhaseCompletion(phase.id);
        const isHighlighted = highlightedPhases.has(phase.id);
        const shouldExpand = isHighlighted || expandedPhases.has(phase.id);

        // Skip phases with no tasks when searching
        if (searchQuery && phaseTasks.length === 0) {
          return null;
        }

        return (
          <PhaseCard
            key={phase.id}
            phase={phase}
            tasks={phaseTasks}
            completion={completion}
            unlocked={true}
            expanded={shouldExpand}
            onToggle={() => togglePhase(phase.id)}
            onTaskUpdate={onTaskUpdate}
            highlighted={isHighlighted}
            projectId={projectId}
          />
        );
      })}
    </div>
  );
};
