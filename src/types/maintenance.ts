// Vendor types
export type VendorStatus = 'active' | 'inactive' | 'preferred' | 'blocked';

export interface Vendor {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone: string;
  specialty: string[];
  service_area: string[];
  hourly_rate?: number;
  emergency_rate?: number;
  emergency_available: boolean;
  average_rating: number;
  total_jobs_completed: number;
  average_response_time_hours?: number;
  license_number?: string;
  insurance_verified: boolean;
  insurance_expiration?: string;
  w9_on_file: boolean;
  preferred_payment_method?: string;
  notes?: string;
  status: VendorStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Work Order types
export type WorkOrderStatus = 
  | 'new' 
  | 'triaging' 
  | 'awaiting_approval' 
  | 'approved'
  | 'dispatched' 
  | 'scheduled' 
  | 'in_progress' 
  | 'pending_verification'
  | 'completed' 
  | 'cancelled' 
  | 'on_hold';

export type WorkOrderUrgency = 'low' | 'normal' | 'high' | 'emergency';

export type MessageSenderType = 'owner' | 'pm' | 'vendor' | 'guest' | 'ai' | 'system';

export interface WorkOrder {
  id: string;
  property_id: string;
  work_order_number: number;
  title: string;
  description: string;
  category: string;
  urgency: WorkOrderUrgency;
  source: string;
  
  // AI Triage
  ai_triage_summary?: string;
  ai_troubleshooting_steps?: any[];
  ai_suggested_category?: string;
  ai_suggested_vendor_id?: string;
  ai_estimated_cost_low?: number;
  ai_estimated_cost_high?: number;
  ai_confidence_score?: number;
  requires_vendor: boolean;
  troubleshooting_resolved: boolean;
  
  // Assignment
  assigned_vendor_id?: string;
  assigned_by?: string;
  assigned_at?: string;
  vendor_accepted?: boolean;
  vendor_accepted_at?: string;
  vendor_declined_reason?: string;
  
  // Scheduling
  scheduled_date?: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  scheduled_time_window?: string;
  access_instructions?: string;
  guest_notified: boolean;
  owner_notified: boolean;
  
  // Site Access & Safety Info
  tenant_contact_name?: string;
  tenant_contact_phone?: string;
  pets_on_property?: string;
  parking_instructions?: string;
  utility_shutoff_notes?: string;
  safety_notes?: string;
  
  // Financial
  estimated_cost?: number;
  quoted_cost?: number;
  actual_cost?: number;
  owner_approved?: boolean;
  owner_approved_at?: string;
  expense_id?: string;
  invoice_path?: string;
  
  // Status
  status: WorkOrderStatus;
  
  // Verification
  before_photos: string[];
  after_photos: string[];
  vendor_notes?: string;
  completion_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  
  // Reporter
  reported_by?: string;
  reported_by_user_id?: string;
  reported_by_email?: string;
  reported_by_phone?: string;
  
  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  
  // Joined data
  property?: {
    id: string;
    name: string;
    address: string;
  };
  assigned_vendor?: Vendor;
}

export interface WorkOrderTimeline {
  id: string;
  work_order_id: string;
  action: string;
  performed_by_type: MessageSenderType;
  performed_by_name?: string;
  performed_by_user_id?: string;
  previous_status?: WorkOrderStatus;
  new_status?: WorkOrderStatus;
  details?: any;
  is_internal: boolean;
  created_at: string;
}

export interface MaintenanceMessage {
  id: string;
  work_order_id: string;
  sender_type: MessageSenderType;
  sender_name: string;
  sender_user_id?: string;
  sender_email?: string;
  message_text: string;
  attachments: string[];
  is_internal: boolean;
  visible_to_owner: boolean;
  visible_to_vendor: boolean;
  visible_to_guest: boolean;
  is_ai_generated: boolean;
  created_at: string;
}

export interface PropertyMaintenanceBook {
  id: string;
  property_id: string;
  hvac_spend_limit: number;
  plumbing_spend_limit: number;
  electrical_spend_limit: number;
  appliance_spend_limit: number;
  general_spend_limit: number;
  exterior_spend_limit: number;
  cleaning_spend_limit: number;
  emergency_authorization_limit: number;
  require_owner_approval_above: number;
  auto_approve_preferred_vendors: boolean;
  preferred_contact_method: string;
  owner_prefers_lowest_bid: boolean;
  require_multiple_quotes_above: number;
  maintenance_notes?: string;
  special_instructions?: string;
  access_instructions?: string;
  lockbox_code?: string;
  gate_code?: string;
  alarm_code?: string;
  created_at: string;
  updated_at: string;
}

export interface ApplianceWarranty {
  id: string;
  property_id: string;
  appliance_type: string;
  brand?: string;
  model_number?: string;
  serial_number?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_start_date?: string;
  warranty_expiration?: string;
  warranty_type?: string;
  warranty_provider?: string;
  warranty_phone?: string;
  warranty_email?: string;
  policy_number?: string;
  coverage_details?: string;
  deductible?: number;
  max_coverage?: number;
  photo_path?: string;
  receipt_path?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Category options
export const WORK_ORDER_CATEGORIES = [
  { value: 'hvac', label: 'HVAC', icon: '❄️' },
  { value: 'plumbing', label: 'Plumbing', icon: '🔧' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'appliances', label: 'Appliances', icon: '🔌' },
  { value: 'general', label: 'General Repair', icon: '🛠️' },
  { value: 'exterior', label: 'Exterior/Landscaping', icon: '🌳' },
  { value: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { value: 'pest_control', label: 'Pest Control', icon: '🐛' },
  { value: 'locks_security', label: 'Locks/Security', icon: '🔐' },
  { value: 'pool_spa', label: 'Pool/Spa', icon: '🏊' },
];

export const VENDOR_SPECIALTIES = [
  'hvac',
  'plumbing',
  'electrical',
  'appliances',
  'general',
  'exterior',
  'cleaning',
  'pest_control',
  'locks_security',
  'pool_spa',
  'roofing',
  'flooring',
  'painting',
  'windows_doors',
  'valet_trash',
];

export const URGENCY_CONFIG: Record<WorkOrderUrgency, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  normal: { label: 'Normal', color: 'text-green-600', bgColor: 'bg-green-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  emergency: { label: 'Emergency', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; color: string; bgColor: string }> = {
  new: { label: 'New', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  triaging: { label: 'Triaging', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100' },
  dispatched: { label: 'Dispatched', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  scheduled: { label: 'Scheduled', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  in_progress: { label: 'In Progress', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  pending_verification: { label: 'Pending Verification', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  completed: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  on_hold: { label: 'On Hold', color: 'text-amber-600', bgColor: 'bg-amber-100' },
};
