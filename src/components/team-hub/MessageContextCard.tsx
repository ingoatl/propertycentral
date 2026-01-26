import { Building2, User, Wrench, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MessageContextCardProps {
  propertyId?: string | null;
  leadId?: string | null;
  workOrderId?: string | null;
  ownerId?: string | null;
  compact?: boolean;
}

export function MessageContextCard({ 
  propertyId, 
  leadId, 
  workOrderId, 
  ownerId,
  compact = false 
}: MessageContextCardProps) {
  // Fetch property data
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['context-property', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address, image_path, property_type')
        .eq('id', propertyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch lead data
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['context-lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, stage, opportunity_value')
        .eq('id', leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch work order data
  const { data: workOrder, isLoading: workOrderLoading } = useQuery({
    queryKey: ['context-work-order', workOrderId],
    queryFn: async () => {
      if (!workOrderId) return null;
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, title, status, urgency, property_id')
        .eq('id', workOrderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workOrderId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch owner data
  const { data: owner, isLoading: ownerLoading } = useQuery({
    queryKey: ['context-owner', ownerId],
    queryFn: async () => {
      if (!ownerId) return null;
      const { data, error } = await supabase
        .from('property_owners')
        .select('id, name, email, phone')
        .eq('id', ownerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ownerId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = propertyLoading || leadLoading || workOrderLoading || ownerLoading;
  const hasContext = property || lead || workOrder || owner;

  if (!hasContext && !isLoading) return null;

  if (isLoading) {
    return (
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-6 w-24" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'new': 'bg-primary/10 text-primary',
      'contacted': 'bg-warning/10 text-warning',
      'qualified': 'bg-success/10 text-success',
      'closed-won': 'bg-success/10 text-success',
      'closed-lost': 'bg-destructive/10 text-destructive',
      'pending': 'bg-warning/10 text-warning',
      'in_progress': 'bg-primary/10 text-primary',
      'completed': 'bg-success/10 text-success',
      'cancelled': 'bg-muted text-muted-foreground',
    };
    return statusColors[status?.toLowerCase()] || 'bg-muted text-muted-foreground';
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {property && (
          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
            <Building2 className="h-3 w-3" />
            {property.name}
          </Badge>
        )}
        {lead && (
          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
            <User className="h-3 w-3" />
            {lead.name}
          </Badge>
        )}
        {workOrder && (
          <Badge variant="outline" className={cn("text-xs gap-1", getStatusColor(workOrder.status || ''))}>
            <Wrench className="h-3 w-3" />
            {workOrder.title?.slice(0, 20)}...
          </Badge>
        )}
        {owner && (
          <Badge variant="outline" className="text-xs gap-1 bg-background/50">
            <Users className="h-3 w-3" />
            {owner.name}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {property && (
        <Card className="p-2 flex items-center gap-3 bg-muted/30 border-muted">
          {property.image_path ? (
            <img 
              src={property.image_path} 
              alt={property.name} 
              className="h-10 w-14 object-cover rounded"
            />
          ) : (
            <div className="h-10 w-14 bg-muted rounded flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{property.name}</p>
            <p className="text-xs text-muted-foreground truncate">{property.address}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {property.property_type}
          </Badge>
        </Card>
      )}

      {lead && (
        <Card className="p-2 flex items-center gap-3 bg-muted/30 border-muted">
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground truncate">{lead.email || lead.phone}</p>
          </div>
          <Badge className={cn("text-xs shrink-0", getStatusColor(lead.stage || ''))}>
            {lead.stage?.replace(/-/g, ' ')}
          </Badge>
        </Card>
      )}

      {workOrder && (
        <Card className="p-2 flex items-center gap-3 bg-muted/30 border-muted">
          <div className="h-10 w-10 bg-warning/10 rounded-full flex items-center justify-center">
            <Wrench className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{workOrder.title}</p>
            <p className="text-xs text-muted-foreground">Urgency: {workOrder.urgency}</p>
          </div>
          <Badge className={cn("text-xs shrink-0", getStatusColor(workOrder.status || ''))}>
            {workOrder.status?.replace(/_/g, ' ')}
          </Badge>
        </Card>
      )}

      {owner && (
        <Card className="p-2 flex items-center gap-3 bg-muted/30 border-muted">
          <div className="h-10 w-10 bg-success/10 rounded-full flex items-center justify-center">
            <Users className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{owner.name}</p>
            <p className="text-xs text-muted-foreground truncate">{owner.email}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
