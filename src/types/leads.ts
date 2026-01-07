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
  | 'inspection_scheduled'
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
  communication_type: 'email' | 'sms' | 'voice_call';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'completed';
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
  { stage: 'contract_signed', title: 'Send Payment Link', description: '→ Sends ACH/Stripe payment setup email' },
  { stage: 'ach_form_signed', title: 'Send Onboarding Form', description: '→ Sends property details form email' },
  { stage: 'onboarding_form_requested', title: 'Awaiting Onboarding', description: 'Waiting for owner to submit form (no email)' },
  { stage: 'insurance_requested', title: 'Send Insurance Request', description: '→ Sends insurance verification email' },
  { stage: 'inspection_scheduled', title: 'Schedule Inspection', description: '→ Sends inspection scheduling email' },
  { stage: 'ops_handoff', title: 'Ops Handoff', description: 'Handed off to operations team' },
];

// Monday.com inspired color scheme with HSL values
export const STAGE_CONFIG: Record<LeadStage, { 
  label: string; 
  color: string; 
  bgColor: string;
  accentColor: string;
  borderColor: string;
}> = {
  new_lead: { 
    label: 'New Lead', 
    color: 'text-[hsl(210,100%,46%)]', 
    bgColor: 'bg-[hsl(210,100%,96%)]',
    accentColor: 'hsl(210, 100%, 46%)',
    borderColor: 'border-[hsl(210,100%,46%)]'
  },
  unreached: { 
    label: 'Unreached', 
    color: 'text-[hsl(240,4%,46%)]', 
    bgColor: 'bg-[hsl(240,4%,95%)]',
    accentColor: 'hsl(240, 4%, 46%)',
    borderColor: 'border-[hsl(240,4%,46%)]'
  },
  call_scheduled: { 
    label: 'Call Scheduled', 
    color: 'text-[hsl(274,58%,59%)]', 
    bgColor: 'bg-[hsl(274,58%,95%)]',
    accentColor: 'hsl(274, 58%, 59%)',
    borderColor: 'border-[hsl(274,58%,59%)]'
  },
  call_attended: { 
    label: 'Call Attended', 
    color: 'text-[hsl(50,63%,52%)]', 
    bgColor: 'bg-[hsl(50,63%,94%)]',
    accentColor: 'hsl(50, 63%, 52%)',
    borderColor: 'border-[hsl(50,63%,52%)]'
  },
  send_contract: { 
    label: 'Send Contract', 
    color: 'text-[hsl(18,100%,59%)]', 
    bgColor: 'bg-[hsl(18,100%,95%)]',
    accentColor: 'hsl(18, 100%, 59%)',
    borderColor: 'border-[hsl(18,100%,59%)]'
  },
  contract_out: { 
    label: 'Contract Out', 
    color: 'text-[hsl(45,100%,50%)]', 
    bgColor: 'bg-[hsl(45,100%,93%)]',
    accentColor: 'hsl(45, 100%, 50%)',
    borderColor: 'border-[hsl(45,100%,50%)]'
  },
  contract_signed: { 
    label: 'Payment Link', 
    color: 'text-[hsl(152,100%,39%)]', 
    bgColor: 'bg-[hsl(152,100%,94%)]',
    accentColor: 'hsl(152, 100%, 39%)',
    borderColor: 'border-[hsl(152,100%,39%)]'
  },
  ach_form_signed: { 
    label: 'Onboarding Form', 
    color: 'text-[hsl(187,100%,45%)]', 
    bgColor: 'bg-[hsl(187,100%,94%)]',
    accentColor: 'hsl(187, 100%, 45%)',
    borderColor: 'border-[hsl(187,100%,45%)]'
  },
  onboarding_form_requested: { 
    label: 'Awaiting', 
    color: 'text-[hsl(79,67%,49%)]', 
    bgColor: 'bg-[hsl(79,67%,94%)]',
    accentColor: 'hsl(79, 67%, 49%)',
    borderColor: 'border-[hsl(79,67%,49%)]'
  },
  insurance_requested: { 
    label: 'Insurance Req', 
    color: 'text-[hsl(322,100%,67%)]', 
    bgColor: 'bg-[hsl(322,100%,95%)]',
    accentColor: 'hsl(322, 100%, 67%)',
    borderColor: 'border-[hsl(322,100%,67%)]'
  },
  inspection_scheduled: { 
    label: 'Inspection', 
    color: 'text-[hsl(280,70%,55%)]', 
    bgColor: 'bg-[hsl(280,70%,95%)]',
    accentColor: 'hsl(280, 70%, 55%)',
    borderColor: 'border-[hsl(280,70%,55%)]'
  },
  ops_handoff: { 
    label: 'Ops Handoff', 
    color: 'text-[hsl(160,97%,25%)]', 
    bgColor: 'bg-[hsl(160,97%,94%)]',
    accentColor: 'hsl(160, 97%, 25%)',
    borderColor: 'border-[hsl(160,97%,25%)]'
  },
};
