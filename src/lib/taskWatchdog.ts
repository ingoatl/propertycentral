import { ONBOARDING_PHASES } from "@/context/onboardingPhases";

/**
 * Task Watchdog - Internal validation to ensure task consistency
 * This ensures that all tasks created match the canonical template from onboardingPhases.ts
 */

// Get the canonical list of valid task titles from the template
export const getValidTaskTitles = (): Set<string> => {
  const validTitles = new Set<string>();
  ONBOARDING_PHASES.forEach(phase => {
    phase.tasks.forEach(task => {
      validTitles.add(task.title);
    });
  });
  return validTitles;
};

// Get the canonical task template
export const getCanonicalTaskTemplate = () => {
  return ONBOARDING_PHASES.flatMap(phase => 
    phase.tasks.map(task => ({
      phase_number: phase.id,
      phase_title: phase.title,
      title: task.title,
      field_type: task.field_type,
      description: task.description,
    }))
  );
};

// Validate that a set of task titles only contains valid tasks
export const validateTaskTitles = (taskTitles: string[]): { 
  valid: boolean; 
  invalidTasks: string[]; 
  missingTasks: string[];
} => {
  const validTitles = getValidTaskTitles();
  const invalidTasks: string[] = [];
  const providedTitles = new Set(taskTitles);
  
  // Check for invalid tasks (not in template)
  taskTitles.forEach(title => {
    if (!validTitles.has(title)) {
      invalidTasks.push(title);
    }
  });
  
  // Check for missing required tasks
  const missingTasks: string[] = [];
  validTitles.forEach(title => {
    if (!providedTitles.has(title)) {
      missingTasks.push(title);
    }
  });
  
  return {
    valid: invalidTasks.length === 0,
    invalidTasks,
    missingTasks,
  };
};

// Tasks that should NEVER be created (known invalid patterns)
const BLACKLISTED_TASK_PATTERNS = [
  /zestimate/i,
  /confirm insurer/i,
  /snow plow/i,
  /attorney information/i,
  /title company/i,
  /appliance warranty/i,
];

// Check if a task title is blacklisted
export const isBlacklistedTask = (title: string): boolean => {
  return BLACKLISTED_TASK_PATTERNS.some(pattern => pattern.test(title));
};

// Sanitize and validate tasks before insertion
export const sanitizeTasks = (tasks: Array<{ title: string; [key: string]: any }>): {
  sanitized: Array<{ title: string; [key: string]: any }>;
  removed: string[];
  warnings: string[];
} => {
  const validTitles = getValidTaskTitles();
  const removed: string[] = [];
  const warnings: string[] = [];
  const seenTitles = new Set<string>();
  
  const sanitized = tasks.filter(task => {
    // Check for blacklisted tasks
    if (isBlacklistedTask(task.title)) {
      removed.push(task.title);
      warnings.push(`Blocked blacklisted task: ${task.title}`);
      return false;
    }
    
    // Check for invalid tasks
    if (!validTitles.has(task.title)) {
      removed.push(task.title);
      warnings.push(`Removed invalid task not in template: ${task.title}`);
      return false;
    }
    
    // Check for duplicates
    if (seenTitles.has(task.title)) {
      removed.push(task.title);
      warnings.push(`Removed duplicate task: ${task.title}`);
      return false;
    }
    
    seenTitles.add(task.title);
    return true;
  });
  
  return { sanitized, removed, warnings };
};

// Log watchdog warnings
export const logWatchdogWarnings = (warnings: string[]) => {
  if (warnings.length > 0) {
    console.warn('[Task Watchdog] Validation issues detected:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
};
