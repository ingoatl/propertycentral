import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Trash2, CheckCircle, DollarSign, Pause, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PauseServiceDialog } from "./PauseServiceDialog";

interface ActiveService {
  id: string;
  property_id: string;
  vendor_id: string;
  specialty: string;
  monthly_cost: number;
  notes?: string;
  property?: {
    id: string;
    name: string;
    address: string;
  };
  vendor?: {
    id: string;
    name: string;
    company_name?: string;
    email?: string;
  };
}

export function CollapsibleActiveServices() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ActiveService | null>(null);

  const { data: activeServices = [], isLoading } = useQuery({
    queryKey: ["active-vendor-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_vendor_assignments")
        .select(`
          id,
          property_id,
          vendor_id,
          specialty,
          monthly_cost,
          notes,
          property:properties(id, name, address),
          vendor:vendors(id, name, company_name, email)
        `)
        .order("specialty");

      if (error) throw error;
      return data as ActiveService[];
    },
  });

  const handlePauseClick = (service: ActiveService) => {
    setSelectedService(service);
    setPauseDialogOpen(true);
  };

  const handlePauseSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["active-vendor-services"] });
  };

  const servicesByType = activeServices.reduce((acc, service) => {
    const specialty = service.specialty || "other";
    if (!acc[specialty]) {
      acc[specialty] = [];
    }
    acc[specialty].push(service);
    return acc;
  }, {} as Record<string, ActiveService[]>);

  const getSpecialtyLabel = (specialty: string) => {
    const labels: Record<string, string> = {
      valet_trash: "Valet Trash",
      trash_services: "Trash Services",
      cleaning: "Cleaning",
      hvac: "HVAC",
      plumbing: "Plumbing",
      electrical: "Electrical",
      pool_spa: "Pool/Spa",
      pest_control: "Pest Control",
      landscaping: "Landscaping",
    };
    return labels[specialty] || specialty.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const totalMonthlyCost = activeServices.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);
  const uniqueVendors = new Set(activeServices.map(s => s.vendor_id)).size;

  if (isLoading) {
    return <Skeleton className="h-14 w-full" />;
  }

  if (activeServices.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-muted">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Active Services
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {Object.keys(servicesByType).length} Services
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {uniqueVendors} Vendors
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${totalMonthlyCost}/mo
                </Badge>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {Object.entries(servicesByType).map(([specialty, services]) => {
              const vendorName = services[0]?.vendor?.company_name || services[0]?.vendor?.name || "Unknown";
              const monthlyTotal = services.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

              return (
                <div key={specialty} className="rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">
                        <Trash2 className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-sm">{getSpecialtyLabel(specialty)}</span>
                      <span className="text-xs text-muted-foreground">• {vendorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{services.length} Properties</Badge>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                        ${monthlyTotal}/mo
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5 group"
                      >
                        <span className="truncate flex-1">
                          {service.property?.address || service.property?.name || "Unknown"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          onClick={() => handlePauseClick(service)}
                          title="Pause"
                        >
                          <Pause className="h-3 w-3 text-amber-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>

      {selectedService && (
        <PauseServiceDialog
          open={pauseDialogOpen}
          onOpenChange={setPauseDialogOpen}
          vendorId={selectedService.vendor_id}
          vendorName={selectedService.vendor?.company_name || selectedService.vendor?.name || "Vendor"}
          vendorEmail={selectedService.vendor?.email}
          preSelectedPropertyId={selectedService.property_id}
          preSelectedAssignmentId={selectedService.id}
          onSuccess={handlePauseSuccess}
        />
      )}
    </Collapsible>
  );
}
