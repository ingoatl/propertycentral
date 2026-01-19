export interface VoicemailTemplate {
  id: string;
  label: string;
  category: string;
  message: string;
}

export const VOICEMAIL_TEMPLATES: VoicemailTemplate[] = [
  {
    id: "welcome",
    label: "Welcome Message",
    category: "Onboarding",
    message: `Hi {{first_name}}, this is {{sender_name}} from Peachhaus Property Management. I wanted to personally reach out and welcome you! We truly appreciate your interest, and I'm excited to help you with your property needs. Please don't hesitate to reach out anytime - I'm here to support you every step of the way. Looking forward to connecting soon!`
  },
  {
    id: "follow-up",
    label: "Warm Follow-up",
    category: "Follow-up",
    message: `Hey {{first_name}}, it's {{sender_name}} from Peachhaus. I hope you're having a wonderful day! I was thinking about you and wanted to check in - I noticed you might have some questions about our services, and I'd genuinely love to help. Your success is my priority. No pressure at all - just know that I'm here for you whenever you're ready to chat. Have a beautiful day!`
  },
  {
    id: "contract-thanks",
    label: "Contract Thank You",
    category: "Contracts",
    message: `{{first_name}}, this is {{sender_name}} from Peachhaus calling with some wonderful news! I just saw that your management agreement is all set, and I couldn't be more thrilled. Thank you so much for choosing to partner with us - it truly means the world. The next step is getting your payment details set up. Check your email when you get a chance, and please know I'm always here if you need anything at all. Take care!`
  },
  {
    id: "gentle-nudge",
    label: "Gentle Nudge",
    category: "Follow-up",
    message: `Hi {{first_name}}, {{sender_name}} here from Peachhaus. I hope I'm not catching you at a bad time - I just wanted to gently follow up and see how you're feeling about everything. I understand decisions like this take time, and I want you to know there's absolutely no rush. But I did want you to know that I'm genuinely here to help. Feel free to call me back whenever works best for you. Wishing you all the best!`
  },
  {
    id: "showing-followup",
    label: "After Showing",
    category: "Showings",
    message: `Hi {{first_name}}, it's {{sender_name}} from Peachhaus. I just wanted to follow up on the property showing we had. I hope you got a good feel for the place! If you have any questions about the property or what the next steps look like, I'm happy to walk you through everything. Give me a call back when you get a chance - looking forward to hearing from you!`
  },
  {
    id: "payment-reminder",
    label: "Payment Setup Reminder",
    category: "Payments",
    message: `Hi {{first_name}}, this is {{sender_name}} from Peachhaus. I'm calling with a quick reminder about setting up your payment details. This will ensure you receive your rental income on time each month. I sent over an email with all the details - just takes a few minutes to complete. If you have any questions or need help, don't hesitate to call me back. Thank you!`
  },
  {
    id: "schedule-call",
    label: "Schedule a Call",
    category: "Scheduling",
    message: `Hey {{first_name}}, {{sender_name}} here from Peachhaus. I'd love to find a time to chat with you about your property and answer any questions you might have. Would you be available for a quick 15-minute call this week? Feel free to call me back or respond to this message with some times that work for you. Talk soon!`
  },
  {
    id: "thank-you",
    label: "General Thank You",
    category: "General",
    message: `Hi {{first_name}}, it's {{sender_name}} from Peachhaus. I just wanted to take a moment to say thank you - I really appreciate your time and trust. Working with you has been a pleasure, and I'm committed to making sure your experience with us is nothing short of excellent. If there's ever anything I can do for you, please don't hesitate to reach out. Have a wonderful day!`
  }
];

export const VOICE_OPTIONS = [
  { id: "HXPJDxQ2YWg0wT4IBlof", name: "Ingo", description: "Default company voice" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Professional male voice" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Warm female voice" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Confident male voice" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Friendly female voice" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Calm male voice" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Bright female voice" },
];

export function processVoicemailTemplate(
  template: string, 
  variables: {
    firstName?: string;
    name?: string;
    senderName?: string;
    propertyAddress?: string;
  }
): string {
  let result = template;
  
  if (variables.firstName) {
    result = result.replace(/\{\{first_name\}\}/g, variables.firstName);
  }
  if (variables.name) {
    result = result.replace(/\{\{name\}\}/g, variables.name);
  }
  if (variables.senderName) {
    result = result.replace(/\{\{sender_name\}\}/g, variables.senderName);
  }
  if (variables.propertyAddress) {
    result = result.replace(/\{\{property_address\}\}/g, variables.propertyAddress);
  }
  
  return result;
}
