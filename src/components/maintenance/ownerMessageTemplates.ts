import { CheckSquare, PlayCircle, CheckCircle, AlertTriangle, Calendar, AlertOctagon } from "lucide-react";

export interface OwnerMessageTemplate {
  id: string;
  label: string;
  icon: typeof CheckSquare;
  sms: string;
  voice: string;
  description: string;
}

export const OWNER_MAINTENANCE_TEMPLATES: OwnerMessageTemplate[] = [
  {
    id: "approval_request",
    label: "Request Approval",
    icon: CheckSquare,
    description: "Ask owner to approve a vendor quote over $500",
    sms: "Hi {{owner_name}}, we need your approval for a repair at {{property_address}}. The vendor quoted ${{quote_amount}} for {{work_description}}. Reply APPROVE to proceed or call us with questions.",
    voice: "Hi {{owner_name}}, this is {{sender_name}} from PeachHaus. I'm calling about your property at {{property_address}}. Our vendor has provided a quote of ${{quote_amount}} for {{work_description}}. We need your approval before proceeding. Please give me a call back or reply APPROVE to this number. Thanks!"
  },
  {
    id: "work_started",
    label: "Work Started",
    icon: PlayCircle,
    description: "Notify owner that vendor has begun work",
    sms: "Hi {{owner_name}}, just letting you know the vendor has started work on {{work_description}} at {{property_address}}. We'll update you when complete.",
    voice: "Hi {{owner_name}}, this is {{sender_name}} from PeachHaus with a quick update. The vendor has started work on {{work_description}} at your property on {{property_address}}. Everything is going smoothly and we'll let you know as soon as it's complete."
  },
  {
    id: "work_complete",
    label: "Work Complete",
    icon: CheckCircle,
    description: "Inform owner that repair is finished",
    sms: "Hi {{owner_name}}, great news! The repair at {{property_address}} is complete. {{work_description}} has been finished. Total cost: ${{total_cost}}. Photos available in your owner portal.",
    voice: "Hi {{owner_name}}, this is {{sender_name}} from PeachHaus with great news! The work at {{property_address}} is all done. {{work_description}} has been completed by our vendor. The total cost came to ${{total_cost}} which will be reflected on your next statement. If you'd like to see before and after photos, they're available in your owner portal. Let me know if you have any questions!"
  },
  {
    id: "additional_repairs",
    label: "Additional Issues Found",
    icon: AlertTriangle,
    description: "Notify owner of additional problems discovered",
    sms: "Hi {{owner_name}}, while working on {{work_description}} at {{property_address}}, the vendor found an additional issue: {{additional_issue}}. Please call us to discuss options.",
    voice: "Hi {{owner_name}}, this is {{sender_name}} from PeachHaus. I wanted to give you a quick heads up - while our vendor was working on {{work_description}} at your property, they discovered an additional issue that needs attention. {{additional_issue}}. I wanted to discuss the options with you before proceeding. Please give me a call back when you get a chance."
  },
  {
    id: "schedule_access",
    label: "Schedule Access",
    icon: Calendar,
    description: "Coordinate vendor access to property",
    sms: "Hi {{owner_name}}, we need to schedule vendor access at {{property_address}} for {{work_description}}. The vendor is available {{available_times}}. Please confirm which time works.",
    voice: "Hi {{owner_name}}, this is {{sender_name}} from PeachHaus. I'm calling to schedule access for our vendor to complete {{work_description}} at your property on {{property_address}}. They're available {{available_times}}. Could you please let me know which time works best for you, or if there are any special access instructions we should know about? Thanks!"
  },
  {
    id: "emergency_notification",
    label: "Urgent/Emergency",
    icon: AlertOctagon,
    description: "Alert owner to emergency situation",
    sms: "URGENT: Hi {{owner_name}}, there's an emergency at {{property_address}}: {{emergency_details}}. We've dispatched a vendor. Please call us ASAP.",
    voice: "Hi {{owner_name}}, this is {{sender_name}} from PeachHaus calling with an urgent matter. We've been notified of an emergency situation at your property on {{property_address}}. {{emergency_details}}. We've already dispatched a vendor to address this immediately. Please call us back as soon as you get this message so we can discuss the situation and next steps. My number is 404-341-5202. Thank you."
  }
];

export function fillTemplate(template: string, variables: Record<string, string | number | undefined>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value?.toString() || `[${key}]`);
  });
  return result;
}
