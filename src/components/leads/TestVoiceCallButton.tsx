import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Phone, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestVoiceCallButtonProps {
  leadId: string;
  leadPhone: string | null;
  leadName: string;
  propertyAddress?: string | null;
}

const VOICE_MESSAGES = [
  {
    id: "welcome",
    label: "Welcome Call",
    message: `Hi {{first_name}}, this is Ingo from PeachHaus. I wanted to personally reach out and welcome you to our property management family. We truly appreciate your trust in us, and I'm excited to help you maximize your rental income while taking excellent care of your property. Please don't hesitate to reach out anytime - I'm here to support you every step of the way. Looking forward to a wonderful partnership!`
  },
  {
    id: "follow-up",
    label: "Warm Follow-up",
    message: `Hey {{first_name}}, it's Ingo from PeachHaus. I hope you're having a wonderful day. I was thinking about you and wanted to check in - I noticed you might have some questions about our services, and I'd genuinely love to help. Your success is my priority, and I'm here whenever you're ready to chat. No pressure at all - just know that I'm here for you. Have a beautiful day!`
  },
  {
    id: "contract-thanks",
    label: "Contract Thank You",
    message: `{{first_name}}, this is Ingo from PeachHaus calling with some wonderful news! I just saw that your management agreement is all set, and I couldn't be more thrilled. Thank you so much for choosing to partner with us - it truly means the world. Next step is getting your payment details set up so we can start sending you that rental income. Check your email when you get a chance, and please know I'm always here if you need anything at all. Take care!`
  },
  {
    id: "nudge",
    label: "Gentle Nudge",
    message: `Hi {{first_name}}, Ingo here from PeachHaus. I hope I'm not catching you at a bad time - I just wanted to gently follow up and see how you're feeling about everything. I understand decisions like this take time, and I want you to know there's absolutely no rush. But I did want you to know that I'm genuinely here to help, and I'd love to answer any questions that might be on your mind. Feel free to call me back whenever works best for you. Wishing you all the best!`
  }
];

const TestVoiceCallButton = ({ leadId, leadPhone, leadName, propertyAddress }: TestVoiceCallButtonProps) => {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const processTemplate = (template: string): string => {
    const firstName = leadName?.split(' ')[0] || 'there';
    return template
      .replace(/\{\{name\}\}/g, leadName || 'there')
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{property_address\}\}/g, propertyAddress || 'your property');
  };

  const handleTestCall = async (messageId: string, message: string) => {
    if (!leadPhone) {
      toast.error("Lead has no phone number");
      return;
    }

    setIsLoading(messageId);
    
    try {
      const processedMessage = processTemplate(message);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-voice-call', {
        body: {
          leadId,
          message: processedMessage,
        }
      });

      if (error) {
        console.error('Voice call error:', error);
        toast.error(`Failed to initiate call: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success("Voice call initiated! You should receive a call shortly.");
      } else {
        toast.error(data?.error || "Failed to initiate call");
      }
    } catch (err) {
      console.error('Voice call error:', err);
      toast.error("Failed to initiate voice call");
    } finally {
      setIsLoading(null);
    }
  };

  if (!leadPhone) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Phone className="h-4 w-4" />
          Test Voice Call
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {VOICE_MESSAGES.map((msg) => (
          <DropdownMenuItem
            key={msg.id}
            onClick={() => handleTestCall(msg.id, msg.message)}
            disabled={isLoading !== null}
            className="cursor-pointer"
          >
            {isLoading === msg.id ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Phone className="h-4 w-4 mr-2" />
            )}
            {msg.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TestVoiceCallButton;
