import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Key, Lock, Car, AlertTriangle, Shield, Wrench, Home, Phone, Mail, Droplet, Zap, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface MaintenanceBookTabProps {
  propertyId: string;
}

export function MaintenanceBookTab({ propertyId }: MaintenanceBookTabProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch all maintenance data from multiple sources
  const { data: maintenanceData, isLoading } = useQuery({
    queryKey: ["maintenance-book-full", propertyId],
    queryFn: async () => {
      // Source 1: owner_onboarding_submissions via property_id
      const { data: onboardingSubmission } = await supabase
        .from("owner_onboarding_submissions")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Source 2: Also try via owner_id if property has owner
      let ownerSubmission = null;
      if (!onboardingSubmission) {
        const { data: property } = await supabase
          .from("properties")
          .select("owner_id")
          .eq("id", propertyId)
          .maybeSingle();
        
        if (property?.owner_id) {
          const { data: ownerData } = await supabase
            .from("owner_onboarding_submissions")
            .select("*")
            .eq("owner_id", property.owner_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          ownerSubmission = ownerData;
        }
      }
      
      // Source 3: Fetch from onboarding_tasks via onboarding_projects
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let taskData: Record<string, string> = {};
      if (projectData?.id) {
        const { data: tasks } = await supabase
          .from("onboarding_tasks")
          .select("title, field_value")
          .eq("project_id", projectData.id)
          .not("field_value", "is", null);
        
        if (tasks) {
          tasks.forEach(task => {
            if (task.field_value) {
              // Map task titles to field names
              const titleMap: Record<string, string> = {
                'Smart Lock Code': 'smart_lock_code',
                'Smart Lock Brand': 'smart_lock_brand',
                'Lockbox Code': 'lockbox_code',
                'Gate Code': 'gate_code',
                'Alarm Code': 'alarm_code',
                'Garage Code': 'garage_code',
                'Vendor Access Code': 'vendor_access_code',
                'Parking Instructions': 'parking_instructions',
                'Water Shutoff Location': 'water_shutoff_location',
                'Breaker Panel Location': 'breaker_panel_location',
                'Gas Shutoff Location': 'gas_shutoff_location',
                'Fire Extinguisher Locations': 'fire_extinguisher_locations',
                'Security Brand': 'security_brand',
                'HOA Contact Name': 'hoa_contact_name',
                'HOA Contact Phone': 'hoa_contact_phone',
              };
              const fieldName = titleMap[task.title];
              if (fieldName) {
                taskData[fieldName] = task.field_value;
              }
            }
          });
        }
      }
      
      // Merge all sources (submission takes priority, then owner submission, then tasks)
      const merged = {
        ...taskData,
        ...(ownerSubmission || {}),
        ...(onboardingSubmission || {}),
      };
      
      return Object.keys(merged).length > 0 ? merged : null;
    },
    enabled: !!propertyId,
  });

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!maintenanceData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No Maintenance Data</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Complete the onboarding form to populate maintenance information.
        </p>
      </div>
    );
  }

  const CopyableField = ({ label, value, icon: Icon }: { label: string; value: string | null; icon: any }) => {
    if (!value) return null;
    return (
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => copyToClipboard(value, label)}
        >
          {copiedField === label ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* Access Codes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Access Codes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {maintenanceData.smart_lock_brand && (
              <Badge variant="secondary" className="mb-3">
                Smart Lock: {maintenanceData.smart_lock_brand}
              </Badge>
            )}
            <CopyableField label="Vendor Access Code" value={maintenanceData.vendor_access_code} icon={Key} />
            <CopyableField label="Smart Lock Code" value={maintenanceData.smart_lock_code} icon={Lock} />
            <CopyableField label="Lockbox Code" value={maintenanceData.lockbox_code} icon={Lock} />
            <CopyableField label="Gate Code" value={maintenanceData.gate_code} icon={Lock} />
            <CopyableField label="Garage Code" value={maintenanceData.garage_code} icon={Home} />
            <CopyableField label="Alarm Code" value={maintenanceData.alarm_code} icon={AlertTriangle} />
            {!maintenanceData.vendor_access_code && !maintenanceData.smart_lock_code && !maintenanceData.lockbox_code && !maintenanceData.gate_code && (
              <p className="text-sm text-muted-foreground text-center py-2">No access codes on file</p>
            )}
          </CardContent>
        </Card>

        {/* Utility Shutoffs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Utility Shutoffs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CopyableField label="Water Shutoff" value={maintenanceData.water_shutoff_location} icon={Droplet} />
            <CopyableField label="Breaker Panel" value={maintenanceData.breaker_panel_location} icon={Zap} />
            <CopyableField label="Gas Shutoff" value={maintenanceData.gas_shutoff_location} icon={Flame} />
            {!maintenanceData.water_shutoff_location && !maintenanceData.breaker_panel_location && !maintenanceData.gas_shutoff_location && (
              <p className="text-sm text-muted-foreground text-center py-2">No utility information on file</p>
            )}
          </CardContent>
        </Card>

        {/* Safety & Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Safety & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {maintenanceData.has_security_system && (
              <CopyableField label="Security System" value={maintenanceData.security_brand || "Yes"} icon={Shield} />
            )}
            <CopyableField label="Fire Extinguisher Locations" value={maintenanceData.fire_extinguisher_locations} icon={AlertTriangle} />
            {!maintenanceData.has_security_system && !maintenanceData.fire_extinguisher_locations && (
              <p className="text-sm text-muted-foreground text-center py-2">No safety information on file</p>
            )}
          </CardContent>
        </Card>

        {/* Parking & Access */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              Parking & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CopyableField label="Parking Instructions" value={maintenanceData.parking_instructions} icon={Car} />
            {!maintenanceData.parking_instructions && (
              <p className="text-sm text-muted-foreground text-center py-2">No parking information on file</p>
            )}
          </CardContent>
        </Card>

        {/* Property Contacts */}
        {(maintenanceData.hoa_contact_name || maintenanceData.hoa_contact_phone) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                HOA Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CopyableField label="HOA Contact Name" value={maintenanceData.hoa_contact_name} icon={Phone} />
              <CopyableField label="HOA Phone" value={maintenanceData.hoa_contact_phone} icon={Phone} />
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
