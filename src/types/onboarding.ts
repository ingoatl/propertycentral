export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'overdue';
export type ProjectStatus = 'pending' | 'in-progress' | 'completed';
export type FieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'file' | 'currency' | 'phone' | 'radio' | 'multiselect' | 'section_header';

export interface OnboardingTask {
  id: string;
  project_id: string;
  phase_number: number;
  phase_title: string;
  title: string;
  description?: string;
  field_type: FieldType;
  assigned_to?: string;
  status: TaskStatus;
  due_date?: string;
  completed_date?: string;
  notes?: string;
  field_value?: string;
  file_path?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingComment {
  id: string;
  task_id: string;
  user_id?: string;
  user_name: string;
  comment: string;
  created_at: string;
}

export interface OnboardingProject {
  id: string;
  property_id?: string;
  owner_name: string;
  property_address: string;
  status: ProjectStatus;
  progress: number;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface PhaseDefinition {
  id: number;
  title: string;
  description: string;
  tasks: TaskDefinition[];
}

export interface TaskDefinition {
  title: string;
  description?: string;
  field_type: FieldType;
  options?: string[];
}

export interface OnboardingSOP {
  id: string;
  project_id: string;
  phase_number?: number;
  task_id?: string;
  title: string;
  description?: string;
  loom_video_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FAQ {
  id: string;
  property_id: string;
  project_id: string;
  question: string;
  answer: string;
  asked_by?: string;
  answered_by?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}
