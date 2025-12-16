import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, ChevronRight, Building2, Loader2 } from 'lucide-react';
import { MobileAppLayout, ScrollbarHideStyle } from '@/components/inspect/MobileAppLayout';
import { InspectTopBar } from '@/components/inspect/InspectTopBar';
import { InspectMenuBar } from '@/components/inspect/InspectMenuBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const Inspect: React.FC = () => {
  const navigate = useNavigate();
  const [inspectorName, setInspectorName] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  
  // Fetch properties (exclude offboarded)
  const { data: properties, isLoading } = useQuery({
    queryKey: ['inspect-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, address')
        .is('offboarded_at', null)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch existing inspection for selected property
  const { data: existingInspection } = useQuery({
    queryKey: ['existing-inspection', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return null;
      const { data, error } = await supabase
        .from('inspections')
        .select('id, status, inspector_name, created_at')
        .eq('property_id', selectedPropertyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPropertyId
  });
  
  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
  const hasExistingInspection = !!existingInspection;
  
  const handleStartOrEditInspection = async () => {
    if (!selectedPropertyId || !inspectorName.trim()) return;
    
    // If there's an existing inspection, navigate to it
    if (existingInspection) {
      navigate(`/inspect/property/${existingInspection.id}`);
      return;
    }
    
    // Create new inspection record
    const { data: inspection, error } = await supabase
      .from('inspections')
      .insert({
        property_id: selectedPropertyId,
        inspector_name: inspectorName.trim(),
        status: 'in_progress'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating inspection:', error);
      return;
    }
    
    // Navigate to inspection form
    navigate(`/inspect/property/${inspection.id}`);
  };

  return (
    <>
      <ScrollbarHideStyle />
      <MobileAppLayout
        topBar={<InspectTopBar title="Property Inspection" />}
        menuBar={<InspectMenuBar />}
      >
        <div className="p-4 space-y-6">
          {/* Hero */}
          <div className="text-center py-6">
            <div className="inline-flex p-4 bg-primary/10 rounded-3xl mb-4">
              <ClipboardCheck className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">STR Inspection</h2>
            <p className="text-muted-foreground">
              Quick property check before guest arrival
            </p>
          </div>
          
          {/* Inspector Name */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
              Your Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Enter your name"
              className={cn(
                "h-14 rounded-2xl text-base px-4",
                !inspectorName.trim() && selectedPropertyId && "border-destructive"
              )}
            />
          </div>
          
          {/* Property Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Select Property</Label>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                {properties?.map((property) => (
                  <button
                    key={property.id}
                    onClick={() => setSelectedPropertyId(property.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                      "active:scale-[0.98]",
                      selectedPropertyId === property.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl",
                      selectedPropertyId === property.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{property.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {property.address}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "h-5 w-5 transition-colors",
                      selectedPropertyId === property.id
                        ? "text-primary"
                        : "text-muted-foreground"
                    )} />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Start/Edit Button */}
          <div className="space-y-2">
            <Button
              onClick={handleStartOrEditInspection}
              disabled={!selectedPropertyId || !inspectorName.trim()}
              className={cn(
                "w-full h-14 rounded-2xl text-lg font-semibold",
                hasExistingInspection 
                  ? "bg-amber-600 hover:bg-amber-700" 
                  : "bg-primary hover:bg-primary/90",
                "transition-all disabled:opacity-50"
              )}
            >
              {hasExistingInspection ? 'Edit Inspection' : 'Start Inspection'}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
            
            {/* Existing inspection info */}
            {hasExistingInspection && (
              <p className="text-center text-sm text-amber-600 dark:text-amber-400">
                {existingInspection.status === 'completed' ? 'Completed' : 'In Progress'} inspection exists
              </p>
            )}
            
            {/* Validation hint */}
            {(!selectedPropertyId || !inspectorName.trim()) && (
              <p className="text-center text-sm text-muted-foreground">
                {!inspectorName.trim() && !selectedPropertyId && "Enter your name and select a property"}
                {!inspectorName.trim() && selectedPropertyId && "Enter your name to continue"}
                {inspectorName.trim() && !selectedPropertyId && "Select a property to continue"}
              </p>
            )}
          </div>
          
          {/* Info */}
          <p className="text-center text-sm text-muted-foreground">
            ~15 quick checks • Takes 5-10 minutes
          </p>
        </div>
      </MobileAppLayout>
    </>
  );
};

export default Inspect;
