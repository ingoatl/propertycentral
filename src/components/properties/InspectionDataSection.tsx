import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ClipboardCheck, 
  Check, 
  X, 
  AlertTriangle, 
  Calendar,
  User,
  ChevronRight,
  ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  INSPECTION_SECTIONS, 
  getFieldByKey,
  Inspection,
  InspectionResponse,
  InspectionIssue,
  InspectionPhoto
} from '@/types/inspection';
import { format } from 'date-fns';

interface InspectionDataSectionProps {
  propertyId: string;
}

export const InspectionDataSection: React.FC<InspectionDataSectionProps> = ({ propertyId }) => {
  // Fetch latest inspection
  const { data: inspection, isLoading: loadingInspection } = useQuery({
    queryKey: ['property-inspection', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Inspection | null;
    }
  });
  
  // Fetch responses for latest inspection
  const { data: responses } = useQuery({
    queryKey: ['property-inspection-responses', inspection?.id],
    queryFn: async () => {
      if (!inspection?.id) return [];
      const { data, error } = await supabase
        .from('inspection_responses')
        .select('*')
        .eq('inspection_id', inspection.id);
      if (error) throw error;
      return data as InspectionResponse[];
    },
    enabled: !!inspection?.id
  });
  
  // Fetch issues for property
  const { data: issues } = useQuery({
    queryKey: ['property-inspection-issues', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_issues')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InspectionIssue[];
    }
  });
  
  // Fetch photos for latest inspection
  const { data: photos } = useQuery({
    queryKey: ['property-inspection-photos', inspection?.id],
    queryFn: async () => {
      if (!inspection?.id) return [];
      const { data, error } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspection.id);
      if (error) throw error;
      return data as InspectionPhoto[];
    },
    enabled: !!inspection?.id
  });

  // Separate field photos from issue photos
  const { fieldPhotos, issuePhotos } = React.useMemo(() => {
    const field: InspectionPhoto[] = [];
    const issue: InspectionPhoto[] = [];
    photos?.forEach(p => {
      if (p.issue_id) {
        issue.push(p);
      } else {
        field.push(p);
      }
    });
    return { fieldPhotos: field, issuePhotos: issue };
  }, [photos]);
  
  const responseMap = React.useMemo(() => {
    const map: Record<string, boolean | null> = {};
    responses?.forEach(r => {
      map[r.field_key] = r.value_bool;
    });
    return map;
  }, [responses]);

  // Map field_key to photo URL for display
  const fieldPhotoMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    fieldPhotos?.forEach(p => {
      if (p.field_key) {
        map[p.field_key] = p.photo_url;
      }
    });
    return map;
  }, [fieldPhotos]);
  
  const openIssues = issues?.filter(i => i.status === 'open') || [];
  
  if (loadingInspection) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (!inspection) {
    return (
      <div className="bg-muted/50 rounded-xl p-6 text-center">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h4 className="font-medium mb-1">No Inspections Yet</h4>
        <p className="text-sm text-muted-foreground">
          This property hasn't been inspected yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Latest Inspection Header */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Latest Inspection
          </h4>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {inspection.inspection_date 
                ? format(new Date(inspection.inspection_date), 'MMM d, yyyy')
                : 'No date'
              }
            </span>
            {inspection.inspector_name && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {inspection.inspector_name}
              </span>
            )}
          </div>
        </div>
        <Badge 
          variant={inspection.status === 'completed' ? 'default' : 'secondary'}
          className="capitalize"
        >
          {inspection.status}
        </Badge>
      </div>
      
      {/* Open Issues Alert */}
      {openIssues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
            <AlertTriangle className="h-5 w-5" />
            {openIssues.length} Open Issue{openIssues.length > 1 ? 's' : ''}
          </div>
          <div className="space-y-2">
            {openIssues.slice(0, 3).map(issue => (
              <div 
                key={issue.id}
                className="flex items-center justify-between bg-white dark:bg-background rounded-lg p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{issue.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-5",
                        issue.severity === 'critical' && "border-red-500 text-red-600",
                        issue.severity === 'high' && "border-orange-500 text-orange-600",
                        issue.severity === 'medium' && "border-yellow-500 text-yellow-600",
                        issue.severity === 'low' && "border-green-500 text-green-600"
                      )}
                    >
                      {issue.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {issue.responsible_party === 'pm' ? 'PM' : issue.responsible_party}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
            {openIssues.length > 3 && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                +{openIssues.length - 3} more issues
              </p>
            )}
          </div>
        </div>
      )}

      {/* Serial Number & Required Photos */}
      {fieldPhotos.length > 0 && (
        <div className="space-y-3">
          <h5 className="font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Serial Numbers & Required Photos ({fieldPhotos.length})
          </h5>
          <div className="grid grid-cols-2 gap-3">
            {fieldPhotos.map(photo => {
              const field = getFieldByKey(photo.field_key || '');
              return (
                <a
                  key={photo.id}
                  href={photo.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative rounded-xl overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
                >
                  <div className="aspect-[4/3]">
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || field?.label || 'Photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white font-medium truncate">
                      {field?.label?.replace(' - capture nameplate/serial', '') || photo.caption || 'Photo'}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Inspection Responses by Section */}
      <div className="space-y-4">
        {INSPECTION_SECTIONS.map(section => {
          const sectionResponses = section.fields.map(f => ({
            field: f,
            value: responseMap[f.key],
            photo: fieldPhotoMap[f.key]
          }));
          const answered = sectionResponses.filter(r => r.value !== undefined && r.value !== null);
          const passed = answered.filter(r => r.value === true).length;
          const failed = answered.filter(r => r.value === false).length;
          
          return (
            <div key={section.id} className="border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                <h5 className="font-medium">{section.title}</h5>
                <div className="flex items-center gap-2 text-sm">
                  {passed > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="h-4 w-4" /> {passed}
                    </span>
                  )}
                  {failed > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <X className="h-4 w-4" /> {failed}
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y">
                {sectionResponses.map(({ field, value, photo }) => (
                  <div 
                    key={field.key}
                    className={cn(
                      "px-4 py-3",
                      value === true && "bg-green-50/50 dark:bg-green-950/10",
                      value === false && "bg-red-50/50 dark:bg-red-950/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <span className="text-sm">{field.label}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {field.critical && (
                            <Badge variant="outline" className="text-[9px] h-4 border-red-300 text-red-600">
                              Critical
                            </Badge>
                          )}
                          {field.requiresPhoto && (
                            <Badge variant="outline" className="text-[9px] h-4">
                              <ImageIcon className="h-2.5 w-2.5 mr-0.5" />
                              Photo
                            </Badge>
                          )}
                        </div>
                      </div>
                      {value === true && (
                        <div className="p-1 bg-green-500 rounded-full">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {value === false && (
                        <div className="p-1 bg-red-500 rounded-full">
                          <X className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {value === undefined && (
                        <span className="text-xs text-muted-foreground">Not checked</span>
                      )}
                    </div>
                    {/* Show thumbnail if photo exists */}
                    {photo && (
                      <a
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block"
                      >
                        <img
                          src={photo}
                          alt={field.label}
                          className="h-16 w-24 object-cover rounded-lg border hover:ring-2 hover:ring-primary transition-all"
                        />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Issue Photos */}
      {issuePhotos.length > 0 && (
        <div className="space-y-3">
          <h5 className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Issue Photos ({issuePhotos.length})
          </h5>
          <div className="grid grid-cols-3 gap-2">
            {issuePhotos.map(photo => (
              <a
                key={photo.id}
                href={photo.photo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity"
              >
                <img
                  src={photo.photo_url}
                  alt={photo.caption || 'Issue photo'}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
