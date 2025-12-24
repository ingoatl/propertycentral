import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Mail, ChevronDown, Loader2 } from "lucide-react";
import { LeadStage, STAGE_CONFIG } from "@/types/leads";

interface TestEmailButtonProps {
  leadId: string;
  leadEmail: string | null;
  currentStage: LeadStage;
}

const TestEmailButton = ({ leadId, leadEmail, currentStage }: TestEmailButtonProps) => {
  const [sendingStep, setSendingStep] = useState<string | null>(null);

  // Fetch sequences for current stage
  const { data: sequences } = useQuery({
    queryKey: ["stage-sequences", currentStage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_follow_up_sequences")
        .select(`
          id,
          name,
          lead_follow_up_steps(
            id,
            step_number,
            action_type,
            template_subject,
            template_content
          )
        `)
        .eq("trigger_stage", currentStage)
        .eq("is_active", true);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Fetch lead data for template processing
  const { data: lead } = useQuery({
    queryKey: ["lead-for-test", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const sendTestEmail = useMutation({
    mutationFn: async ({ stepId, subject, content }: { stepId: string; subject: string; content: string }) => {
      if (!leadEmail) throw new Error("Lead has no email address");
      
      // Process template variables
      const firstName = lead?.name?.split(' ')[0] || 'there';
      const processedContent = content
        .replace(/\{\{name\}\}/g, lead?.name || "")
        .replace(/\{\{first_name\}\}/g, firstName)
        .replace(/\{\{email\}\}/g, lead?.email || "")
        .replace(/\{\{phone\}\}/g, lead?.phone || "")
        .replace(/\{\{property_address\}\}/g, lead?.property_address || "your property")
        .replace(/\{\{opportunity_value\}\}/g, lead?.opportunity_value?.toString() || "0")
        .replace(/\{\{ach_link\}\}/g, `https://peachhaus.co/payment-setup`)
        .replace(/\{\{onboarding_link\}\}/g, `https://peachhaus.co/onboard/existing-str`);

      const processedSubject = subject
        .replace(/\{\{name\}\}/g, lead?.name || "")
        .replace(/\{\{first_name\}\}/g, firstName);

      const { error } = await supabase.functions.invoke('send-lead-notification', {
        body: {
          leadId,
          type: 'email',
          message: processedContent,
          subject: processedSubject,
          isTest: true,
        }
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Test email sent to ${leadEmail}`);
      setSendingStep(null);
    },
    onError: (error) => {
      toast.error("Failed to send test email: " + error.message);
      setSendingStep(null);
    },
  });

  if (!leadEmail) {
    return null;
  }

  const allSteps = sequences?.flatMap(seq => 
    (seq.lead_follow_up_steps || [])
      .filter(step => step.action_type === 'email' || step.action_type === 'both')
      .map(step => ({
        ...step,
        sequenceName: seq.name,
      }))
  ) || [];

  if (allSteps.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1"
          disabled={sendingStep !== null}
        >
          {sendingStep ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
          Test Email
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Send test to {leadEmail}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allSteps.map((step) => (
          <DropdownMenuItem
            key={step.id}
            onClick={() => {
              setSendingStep(step.id);
              sendTestEmail.mutate({
                stepId: step.id,
                subject: step.template_subject || `Follow-up from PeachHaus`,
                content: step.template_content,
              });
            }}
            disabled={sendingStep !== null}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">
                Step {step.step_number}: {step.template_subject?.slice(0, 30) || 'Untitled'}
                {(step.template_subject?.length || 0) > 30 ? '...' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {step.sequenceName}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TestEmailButton;
