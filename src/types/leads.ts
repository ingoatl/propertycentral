export type LeadStage =
  | 'new_lead'
  | 'unreached'
  | 'call_scheduled'
  | 'call_attended'
  | 'send_contract'
  | 'contract_out'
  | 'contract_signed'
  | 'ach_form_signed'
  | 'onboarding_form_requested'
  | 'insurance_requested'
  | 'ops_handoff';

export type LeadSource =
  | 'calendar_booking'
  | 'referral'
  | 'website'
  | 'phone_call'
  | 'email'
  | 'other';

export interface Lead {
  id: string;
  lead_number: number;
  name: string;
  email: string | null;
  phone: string | null;
  opportunity_source: string | null;
  opportunity_value: number;
  property_address: string | null;
  property_type: string | null;
  stage: LeadStage;
  stage_changed_at: string;
  assigned_to: string | null;
  notes: string | null;
  tags: string[] | null;
  ai_summary: string | null;
  ai_next_action: string | null;
  ai_qualification_score: number | null;
  calendar_event_id: string | null;
  property_id: string | null;
  owner_id: string | null;
  project_id: string | null;
  signwell_document_id: string | null;
  created_at: string;
  updated_at: string;
  // New fields for follow-up tracking
  last_contacted_at?: string | null;
  last_response_at?: string | null;
  follow_up_paused?: boolean;
  active_sequence_id?: string | null;
}

export interface LeadTimeline {
  id: string;
  lead_id: string;
  action: string;
  performed_by_user_id: string | null;
  performed_by_name: string | null;
  previous_stage: LeadStage | null;
  new_stage: LeadStage | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LeadAutomation {
  id: string;
  name: string;
  trigger_stage: LeadStage;
  action_type: string;
  delay_minutes: number;
  template_content: string | null;
  template_subject: string | null;
  ai_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadCommunication {
  id: string;
  lead_id: string;
  communication_type: 'email' | 'sms';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  external_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  // New fields for enhanced tracking
  sequence_id?: string | null;
  step_number?: number | null;
  delivery_status?: string;
  opened_at?: string | null;
  clicked_at?: string | null;
  replied_at?: string | null;
}

export interface LeadFollowUpSequence {
  id: string;
  name: string;
  trigger_stage: string;
  description: string | null;
  is_active: boolean;
  stop_on_response: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadFollowUpStep {
  id: string;
  sequence_id: string;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  action_type: 'email' | 'sms' | 'both';
  template_subject: string | null;
  template_content: string;
  send_time: string;
  send_days: string[];
  ai_personalize: boolean;
  created_at: string;
}

export interface LeadFollowUpSchedule {
  id: string;
  lead_id: string;
  sequence_id: string | null;
  step_id: string | null;
  step_number: number;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed' | 'skipped';
  sent_at: string | null;
  created_at: string;
}

export const LEAD_STAGES: { stage: LeadStage; title: string; description: string }[] = [
  { stage: 'new_lead', title: 'New Lead', description: 'Fresh calendar booking or inquiry' },
  { stage: 'unreached', title: 'Unreached', description: 'No response after initial contact' },
  { stage: 'call_scheduled', title: 'Call Scheduled', description: 'Discovery call booked' },
  { stage: 'call_attended', title: 'Call Attended', description: 'Call completed, ready for review' },
  { stage: 'send_contract', title: 'Send Contract', description: 'Ready to send management agreement' },
  { stage: 'contract_out', title: 'Contract Out', description: 'Contract sent, awaiting signature' },
  { stage: 'contract_signed', title: 'Contract Signed', description: 'Agreement signed, need ACH form' },
  { stage: 'ach_form_signed', title: 'ACH Form Signed', description: 'Payment method confirmed' },
  { stage: 'onboarding_form_requested', title: 'Onboarding Requested', description: 'Waiting for property details' },
  { stage: 'insurance_requested', title: 'Insurance Requested', description: 'Waiting for STR insurance' },
  { stage: 'ops_handoff', title: 'Ops Handoff', description: 'Handed off to operations team' },
];

export const STAGE_CONFIG: Record<LeadStage, { label: string; color: string; bgColor: string }> = {
  new_lead: { label: 'New Lead', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  unreached: { label: 'Unreached', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  call_scheduled: { label: 'Call Scheduled', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  call_attended: { label: 'Call Attended', color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
  send_contract: { label: 'Send Contract', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  contract_out: { label: 'Contract Out', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  contract_signed: { label: 'Contract Signed', color: 'text-teal-700', bgColor: 'bg-teal-50' },
  ach_form_signed: { label: 'ACH Signed', color: 'text-cyan-700', bgColor: 'bg-cyan-50' },
  onboarding_form_requested: { label: 'Onboarding', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  insurance_requested: { label: 'Insurance', color: 'text-lime-700', bgColor: 'bg-lime-50' },
  ops_handoff: { label: 'Ops Handoff', color: 'text-green-700', bgColor: 'bg-green-50' },
};
