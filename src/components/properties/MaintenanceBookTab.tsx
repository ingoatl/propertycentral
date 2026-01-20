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

  // Fetch all onboarding data for maintenance information
  const { data: onboardingData, isLoading } = useQuery({
    queryKey: ["maintenance-book-data", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_onboarding_submissions")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
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

  if (!onboardingData) {
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
            {onboardingData.smart_lock_brand && (
              <Badge variant="secondary" className="mb-3">
                Smart Lock: {onboardingData.smart_lock_brand}
              </Badge>
            )}
            <CopyableField label="Vendor Access Code" value={onboardingData.vendor_access_code} icon={Key} />
            <CopyableField label="Smart Lock Code" value={onboardingData.smart_lock_code} icon={Lock} />
            <CopyableField label="Lockbox Code" value={onboardingData.lockbox_code} icon={Lock} />
            <CopyableField label="Gate Code" value={onboardingData.gate_code} icon={Lock} />
            <CopyableField label="Garage Code" value={onboardingData.garage_code} icon={Home} />
            <CopyableField label="Alarm Code" value={onboardingData.alarm_code} icon={AlertTriangle} />
            {!onboardingData.vendor_access_code && !onboardingData.smart_lock_code && !onboardingData.lockbox_code && !onboardingData.gate_code && (
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
            <CopyableField label="Water Shutoff" value={onboardingData.water_shutoff_location} icon={Droplet} />
            <CopyableField label="Breaker Panel" value={onboardingData.breaker_panel_location} icon={Zap} />
            <CopyableField label="Gas Shutoff" value={onboardingData.gas_shutoff_location} icon={Flame} />
            {!onboardingData.water_shutoff_location && !onboardingData.breaker_panel_location && !onboardingData.gas_shutoff_location && (
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
            {onboardingData.has_security_system && (
              <CopyableField label="Security System" value={onboardingData.security_brand || "Yes"} icon={Shield} />
            )}
            <CopyableField label="Fire Extinguisher Locations" value={onboardingData.fire_extinguisher_locations} icon={AlertTriangle} />
            {!onboardingData.has_security_system && !onboardingData.fire_extinguisher_locations && (
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
            <CopyableField label="Parking Instructions" value={onboardingData.parking_instructions} icon={Car} />
            {!onboardingData.parking_instructions && (
              <p className="text-sm text-muted-foreground text-center py-2">No parking information on file</p>
            )}
          </CardContent>
        </Card>

        {/* Property Contacts */}
        {(onboardingData.hoa_contact_name || onboardingData.hoa_contact_phone) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                HOA Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CopyableField label="HOA Contact Name" value={onboardingData.hoa_contact_name} icon={Phone} />
              <CopyableField label="HOA Phone" value={onboardingData.hoa_contact_phone} icon={Phone} />
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
