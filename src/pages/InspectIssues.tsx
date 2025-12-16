import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Calendar, User } from 'lucide-react';
import { MobileAppLayout, ScrollbarHideStyle } from '@/components/inspect/MobileAppLayout';
import { InspectTopBar } from '@/components/inspect/InspectTopBar';
import { InspectMenuBar } from '@/components/inspect/InspectMenuBar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const InspectIssues: React.FC = () => {
  // Fetch all open issues
  const { data: issues, isLoading } = useQuery({
    queryKey: ['all-inspection-issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_issues')
        .select(`
          *,
          property:properties(id, name, address),
          inspection:inspections(inspector_name)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <>
      <ScrollbarHideStyle />
      <MobileAppLayout
        topBar={<InspectTopBar title="Open Issues" />}
        menuBar={<InspectMenuBar />}
      >
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : issues?.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No open issues</p>
              <p className="text-sm text-muted-foreground mt-1">All clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues?.map((issue) => (
                <div
                  key={issue.id}
                  className={cn(
                    "p-4 rounded-2xl border-2 border-border bg-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{issue.title}</p>
                      {issue.detail && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {issue.detail}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{issue.property?.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {issue.inspection?.inspector_name || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(issue.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={cn("text-[10px]", getSeverityColor(issue.severity))}>
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {issue.responsible_party === 'pm' ? 'PM' : issue.responsible_party}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </MobileAppLayout>
    </>
  );
};

export default InspectIssues;
