import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, ChevronRight, Calendar, User, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { MobileAppLayout, ScrollbarHideStyle } from '@/components/inspect/MobileAppLayout';
import { InspectTopBar } from '@/components/inspect/InspectTopBar';
import { InspectMenuBar } from '@/components/inspect/InspectMenuBar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getTotalFields } from '@/types/inspection';

const InspectionsList: React.FC = () => {
  const navigate = useNavigate();
  
  // Fetch all inspections with property info and response counts
  const { data: inspections, isLoading } = useQuery({
    queryKey: ['all-inspections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select(`
          *,
          property:properties(id, name, address),
          responses:inspection_responses(count),
          issues:inspection_issues(count)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const totalFields = getTotalFields();

  const getStatusInfo = (inspection: any) => {
    const responseCount = inspection.responses?.[0]?.count || 0;
    const isComplete = responseCount >= totalFields;
    
    if (inspection.status === 'completed' && isComplete) {
      return { label: 'Complete', color: 'bg-green-500', icon: CheckCircle };
    } else if (inspection.status === 'completed' && !isComplete) {
      return { label: 'Incomplete', color: 'bg-amber-500', icon: AlertTriangle };
    } else {
      return { label: 'In Progress', color: 'bg-blue-500', icon: Clock };
    }
  };

  return (
    <>
      <ScrollbarHideStyle />
      <MobileAppLayout
        topBar={<InspectTopBar title="All Inspections" />}
        menuBar={<InspectMenuBar />}
      >
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : inspections?.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No inspections yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inspections?.map((inspection) => {
                const statusInfo = getStatusInfo(inspection);
                const StatusIcon = statusInfo.icon;
                const responseCount = inspection.responses?.[0]?.count || 0;
                const issueCount = inspection.issues?.[0]?.count || 0;
                
                return (
                  <button
                    key={inspection.id}
                    onClick={() => navigate(`/inspect/property/${inspection.id}`)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border-2 border-border bg-card",
                      "transition-all active:scale-[0.98] hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {inspection.property?.name || 'Unknown Property'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {inspection.property?.address}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {inspection.inspector_name || 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(inspection.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            variant="secondary" 
                            className={cn("text-[10px]", statusInfo.color, "text-white")}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {responseCount}/{totalFields} items
                          </Badge>
                          {issueCount > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {issueCount} issues
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </MobileAppLayout>
    </>
  );
};

export default InspectionsList;
