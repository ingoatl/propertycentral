import { Lead, STAGE_CONFIG } from "@/types/leads";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, DollarSign, MessageSquare, FileText, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface LeadCardProps {
  lead: Lead;
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
            <span className="text-xs text-muted-foreground ml-auto">
              #{lead.lead_number}
            </span>
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
