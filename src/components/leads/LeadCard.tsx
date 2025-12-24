import { Lead, STAGE_CONFIG } from "@/types/leads";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, DollarSign, MessageSquare, Sparkles, Clock, PhoneCall, Volume2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TestEmailButton from "./TestEmailButton";

interface LeadCardProps {
  lead: Lead & {
    last_contacted_at?: string | null;
    last_response_at?: string | null;
    follow_up_paused?: boolean;
    active_sequence_id?: string | null;
  };
  onClick: () => void;
  compact?: boolean;
}

const LeadCard = ({ lead, onClick, compact = false }: LeadCardProps) => {
  const stageConfig = STAGE_CONFIG[lead.stage];
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Fetch communication counts including voice calls
  const { data: commCounts } = useQuery({
    queryKey: ["lead-comm-counts", lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_communications")
        .select("communication_type")
        .eq("lead_id", lead.id);
      
      const sms = data?.filter(c => c.communication_type === "sms").length || 0;
      const email = data?.filter(c => c.communication_type === "email").length || 0;
      const voiceCall = data?.filter(c => c.communication_type === "voice_call").length || 0;
      return { sms, email, voiceCall };
    },
    staleTime: 30000,
  });

  // Fetch next scheduled follow-up
  const { data: nextFollowUp } = useQuery({
    queryKey: ["lead-next-followup", lead.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_follow_up_schedules")
        .select("scheduled_for, step_number")
        .eq("lead_id", lead.id)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 30000,
  });

  // Fetch sequence info
  const { data: sequenceInfo } = useQuery({
    queryKey: ["lead-sequence-info", lead.active_sequence_id],
    queryFn: async () => {
      if (!lead.active_sequence_id) return null;
      const { data } = await supabase
        .from("lead_follow_up_sequences")
        .select("name, lead_follow_up_steps(count)")
        .eq("id", lead.active_sequence_id)
        .maybeSingle();
      return data;
    },
    enabled: !!lead.active_sequence_id,
    staleTime: 60000,
  });

  if (compact) {
    return (
      <Card 
        className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-card border"
        onClick={onClick}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm truncate">{lead.name}</h4>
              {lead.opportunity_source && (
                <p className="text-xs text-muted-foreground truncate">
                  {lead.opportunity_source}
                </p>
              )}
            </div>
            {lead.ai_qualification_score && (
              <Badge variant="outline" className="shrink-0 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                {lead.ai_qualification_score}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lead.opportunity_value > 0 && (
              <span className="flex items-center gap-1 font-medium text-green-600">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(lead.opportunity_value)}
              </span>
            )}
            {lead.property_address && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{lead.property_address}</span>
              </span>
            )}
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {lead.active_sequence_id && (
              <Badge className="text-xs px-1.5 py-0 bg-green-100 text-green-700 border-green-300">
                <Sparkles className="h-3 w-3 mr-1" />
                Auto
              </Badge>
            )}
            {commCounts && commCounts.sms > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                <MessageSquare className="h-3 w-3 mr-1" />
                {commCounts.sms}
              </Badge>
            )}
            {commCounts && commCounts.email > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                <Mail className="h-3 w-3 mr-1" />
                {commCounts.email}
              </Badge>
            )}
            {commCounts && commCounts.voiceCall > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-purple-100 text-purple-700">
                <Volume2 className="h-3 w-3 mr-1" />
                {commCounts.voiceCall}
              </Badge>
            )}
            {nextFollowUp && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-orange-300 text-orange-600">
                <Clock className="h-3 w-3 mr-1" />
                Step {nextFollowUp.step_number} • {formatDistanceToNow(new Date(nextFollowUp.scheduled_for), { addSuffix: true })}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1 pt-1">
            {lead.phone && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`tel:${lead.phone}`);
                }}
              >
                <Phone className="h-3 w-3" />
              </Button>
            )}
            {lead.email && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`mailto:${lead.email}`);
                }}
              >
                <Mail className="h-3 w-3" />
              </Button>
            )}
            <div onClick={(e) => e.stopPropagation()} className="ml-auto flex items-center gap-2">
              <TestEmailButton 
                leadId={lead.id} 
                leadEmail={lead.email} 
                currentStage={lead.stage} 
              />
              <span className="text-xs text-muted-foreground">
                #{lead.lead_number}
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{lead.name}</h3>
            <p className="text-sm text-muted-foreground">
              {lead.opportunity_source || 'Unknown Source'}
            </p>
          </div>
          <Badge className={`${stageConfig.bgColor} ${stageConfig.color} border-0`}>
            {stageConfig.label}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          {lead.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{lead.phone}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-muted-foreground truncate">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.property_address && (
            <div className="flex items-center gap-2 text-muted-foreground col-span-2 truncate">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{lead.property_address}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {lead.opportunity_value > 0 && (
              <span className="text-sm font-medium text-green-600">
                {formatCurrency(lead.opportunity_value)}
              </span>
            )}
            {lead.ai_qualification_score && (
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Score: {lead.ai_qualification_score}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(lead.created_at), 'MMM d, yyyy')}
          </span>
        </div>
        
        {lead.ai_next_action && (
          <div className="p-2 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{lead.ai_next_action}</span>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LeadCard;
