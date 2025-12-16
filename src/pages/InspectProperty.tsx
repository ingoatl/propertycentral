import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Camera, MessageSquare } from 'lucide-react';
import { MobileAppLayout, ScrollbarHideStyle } from '@/components/inspect/MobileAppLayout';
import { InspectTopBar } from '@/components/inspect/InspectTopBar';
import { YesNoToggle } from '@/components/inspect/YesNoToggle';
import { IssueCaptureDrawer } from '@/components/inspect/IssueCaptureDrawer';
import { PhotoCaptureField } from '@/components/inspect/PhotoCaptureField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  INSPECTION_SECTIONS, 
  getTotalFields, 
  InspectionField,
  InspectionResponse,
  InspectionPhoto
} from '@/types/inspection';
import { toast } from 'sonner';

const InspectProperty: React.FC = () => {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, boolean | null>>({});
  const [fieldPhotos, setFieldPhotos] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [issueDrawerOpen, setIssueDrawerOpen] = useState(false);
  const [pendingIssueField, setPendingIssueField] = useState<InspectionField | null>(null);
  
  // Fetch inspection with property
  const { data: inspection, isLoading: loadingInspection } = useQuery({
    queryKey: ['inspection', inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select(`
          *,
          property:properties(id, name, address)
        `)
        .eq('id', inspectionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!inspectionId
  });
  
  // Fetch existing responses
  const { data: existingResponses } = useQuery({
    queryKey: ['inspection-responses', inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_responses')
        .select('*')
        .eq('inspection_id', inspectionId);
      if (error) throw error;
      return data as InspectionResponse[];
    },
    enabled: !!inspectionId
  });

  // Fetch existing field photos (not issue photos)
  const { data: existingPhotos } = useQuery({
    queryKey: ['inspection-field-photos', inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspectionId)
        .is('issue_id', null); // Only field photos, not issue photos
      if (error) throw error;
      return data as InspectionPhoto[];
    },
    enabled: !!inspectionId
  });
  
  // Load existing responses and remarks into state
  useEffect(() => {
    if (existingResponses) {
      const responseMap: Record<string, boolean | null> = {};
      existingResponses.forEach(r => {
        responseMap[r.field_key] = r.value_bool;
      });
      setResponses(responseMap);
    }
  }, [existingResponses]);

  // Load existing remarks
  useEffect(() => {
    if (inspection?.notes) {
      setRemarks(inspection.notes);
    }
  }, [inspection]);

  // Load existing field photos into state
  useEffect(() => {
    if (existingPhotos) {
      const photoMap: Record<string, string> = {};
      existingPhotos.forEach(p => {
        if (p.field_key) {
          photoMap[p.field_key] = p.photo_url;
        }
      });
      setFieldPhotos(photoMap);
    }
  }, [existingPhotos]);
  
  // Save response mutation
  const saveResponseMutation = useMutation({
    mutationFn: async ({ fieldKey, sectionId, value }: { 
      fieldKey: string; 
      sectionId: string; 
      value: boolean 
    }) => {
      const { error } = await supabase
        .from('inspection_responses')
        .upsert({
          inspection_id: inspectionId,
          section_id: sectionId,
          field_key: fieldKey,
          value_bool: value,
          answered_at: new Date().toISOString()
        }, {
          onConflict: 'inspection_id,field_key'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-responses', inspectionId] });
    }
  });
  
  // Create issue mutation
  const createIssueMutation = useMutation({
    mutationFn: async (data: {
      fieldKey: string;
      title: string;
      detail: string;
      severity: string;
      responsibleParty: string;
      photo?: File;
    }) => {
      // Create issue
      const { data: issue, error: issueError } = await supabase
        .from('inspection_issues')
        .insert({
          property_id: inspection?.property_id,
          inspection_id: inspectionId,
          field_key: data.fieldKey,
          title: data.title,
          detail: data.detail,
          severity: data.severity,
          responsible_party: data.responsibleParty
        })
        .select()
        .single();
      
      if (issueError) throw issueError;
      
      // Upload photo if provided
      if (data.photo && issue) {
        const fileExt = data.photo.name.split('.').pop();
        const fileName = `${inspectionId}/${issue.id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('inspection-photos')
          .upload(fileName, data.photo);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('inspection-photos')
          .getPublicUrl(fileName);
        
        // Save photo record
        await supabase.from('inspection_photos').insert({
          inspection_id: inspectionId,
          issue_id: issue.id,
          field_key: data.fieldKey,
          photo_url: urlData.publicUrl
        });
      }
      
      return issue;
    },
    onSuccess: () => {
      toast.success('Issue logged');
    }
  });
  
  // Save remarks mutation
  const saveRemarksMutation = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from('inspections')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', inspectionId);
      if (error) throw error;
    }
  });

  // Send inspection report email
  const sendReportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-inspection-report', {
        body: { inspectionId }
      });
      if (error) throw error;
      return data;
    }
  });

  // Complete inspection mutation
  const completeInspectionMutation = useMutation({
    mutationFn: async () => {
      // Save remarks first
      if (remarks.trim()) {
        await saveRemarksMutation.mutateAsync(remarks);
      }
      
      const { error } = await supabase
        .from('inspections')
        .update({ 
          status: 'completed',
          notes: remarks,
          updated_at: new Date().toISOString()
        })
        .eq('id', inspectionId);
      if (error) throw error;

      // Send email report
      await sendReportMutation.mutateAsync();
    },
    onSuccess: () => {
      toast.success('Inspection completed & email sent!');
      navigate('/inspect');
    },
    onError: (error) => {
      console.error('Error completing inspection:', error);
      toast.error('Inspection saved but email failed to send');
      navigate('/inspect');
    }
  });
  
  const currentSection = INSPECTION_SECTIONS[currentSectionIndex];
  const totalFields = getTotalFields();
  const answeredCount = Object.values(responses).filter(v => v !== null && v !== undefined).length;
  const progress = (answeredCount / totalFields) * 100;
  
  const handleAnswer = async (field: InspectionField, value: boolean) => {
    // Update local state immediately
    setResponses(prev => ({ ...prev, [field.key]: value }));
    
    // Save to database
    await saveResponseMutation.mutateAsync({
      fieldKey: field.key,
      sectionId: currentSection.id,
      value
    });
    
    // If "No", open issue drawer
    if (!value) {
      setPendingIssueField(field);
      setIssueDrawerOpen(true);
    }
  };
  
  const handleIssueSubmit = async (data: {
    detail: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    photo?: File;
  }) => {
    if (!pendingIssueField) return;
    
    await createIssueMutation.mutateAsync({
      fieldKey: pendingIssueField.key,
      title: pendingIssueField.label,
      detail: data.detail,
      severity: data.severity,
      responsibleParty: pendingIssueField.responsibleParty,
      photo: data.photo
    });
    
    setPendingIssueField(null);
  };

  const handlePhotoUploaded = (fieldKey: string, url: string) => {
    setFieldPhotos(prev => ({ ...prev, [fieldKey]: url }));
    queryClient.invalidateQueries({ queryKey: ['inspection-field-photos', inspectionId] });
  };
  
  const handleNext = () => {
    if (currentSectionIndex < INSPECTION_SECTIONS.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };
  
  const handleComplete = () => {
    completeInspectionMutation.mutate();
  };
  
  const isLastSection = currentSectionIndex === INSPECTION_SECTIONS.length - 1;
  const sectionComplete = currentSection?.fields.every(f => responses[f.key] !== undefined);
  
  if (loadingInspection) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <ScrollbarHideStyle />
      <MobileAppLayout
        topBar={
          <InspectTopBar
            title={currentSection?.title || 'Inspection'}
            subtitle={inspection?.property?.name}
            showBack
            onBack={() => currentSectionIndex > 0 ? handlePrevious() : navigate('/inspect')}
            progress={progress}
            rightAction={
              <span className="text-sm text-muted-foreground">
                {currentSectionIndex + 1}/{INSPECTION_SECTIONS.length}
              </span>
            }
          />
        }
      >
        <div className="p-4 space-y-4 pb-24">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="rounded-full">
              Section {currentSectionIndex + 1}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {currentSection?.fields.length} items
            </span>
            {currentSection?.fields.some(f => f.requiresPhoto) && (
              <Badge variant="secondary" className="rounded-full text-xs">
                <Camera className="h-3 w-3 mr-1" />
                Photos required
              </Badge>
            )}
          </div>
          
          {/* Questions */}
          <div className="space-y-4">
            {currentSection?.fields.map((field, index) => (
              <div
                key={field.key}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all animate-fade-in",
                  responses[field.key] === true && "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
                  responses[field.key] === false && "border-red-500/30 bg-red-50/50 dark:bg-red-950/20",
                  responses[field.key] === undefined && "border-border bg-card"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <p className="font-medium leading-snug">{field.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {field.requiresPhoto && (
                        <Badge variant="outline" className="text-[10px] h-5 rounded-full">
                          <Camera className="h-3 w-3 mr-0.5" />
                          Photo
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground capitalize">
                        {field.responsibleParty === 'pm' ? 'PM' : field.responsibleParty}
                      </span>
                    </div>
                  </div>
                  {responses[field.key] === true && fieldPhotos[field.key] && (
                    <div className="p-1 bg-green-500 rounded-full">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {responses[field.key] === true && !field.requiresPhoto && (
                    <div className="p-1 bg-green-500 rounded-full">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                <YesNoToggle
                  value={responses[field.key] ?? null}
                  onChange={(value) => handleAnswer(field, value)}
                />

                {/* Photo Capture for fields that require it */}
                {field.requiresPhoto && inspectionId && (
                  <PhotoCaptureField
                    inspectionId={inspectionId}
                    fieldKey={field.key}
                    photoLabel={field.photoLabel || 'Capture photo'}
                    photoType={field.photoType || 'both'}
                    existingPhotoUrl={fieldPhotos[field.key]}
                    onPhotoUploaded={(url) => handlePhotoUploaded(field.key, url)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Remarks Section - Show on last section */}
          {isLastSection && (
            <div className="mt-6 p-4 rounded-2xl border-2 border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <Label className="text-base font-semibold">Inspector Remarks</Label>
              </div>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any additional notes, observations, or recommendations..."
                className="min-h-[120px] rounded-xl resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                These remarks will be included in the inspection report email.
              </p>
            </div>
          )}
        </div>
        
        {/* Fixed Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border/50">
          <div className="flex gap-3">
            {currentSectionIndex > 0 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="flex-1 h-12 rounded-xl"
              >
                Previous
              </Button>
            )}
            
            {isLastSection ? (
              <Button
                onClick={handleComplete}
                disabled={completeInspectionMutation.isPending}
                className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700"
              >
                {completeInspectionMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Check className="h-5 w-5 mr-2" />
                )}
                Complete Inspection
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="flex-1 h-12 rounded-xl"
              >
                Next Section
              </Button>
            )}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </MobileAppLayout>
      
      {/* Issue Capture Drawer */}
      <IssueCaptureDrawer
        open={issueDrawerOpen}
        onOpenChange={(open) => {
          setIssueDrawerOpen(open);
          if (!open) setPendingIssueField(null);
        }}
        field={pendingIssueField}
        onSubmit={handleIssueSubmit}
      />
    </>
  );
};

export default InspectProperty;
