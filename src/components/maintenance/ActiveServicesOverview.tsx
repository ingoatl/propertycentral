import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  };
}

const ActiveServicesOverview = () => {
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
          vendor:vendors(id, name, company_name)
        `)
        .order("specialty");

      if (error) throw error;
      return data as ActiveService[];
    },
  });

  // Group services by specialty
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
      valet_trash: "Valet Trash Service",
      trash_services: "Trash Services",
      cleaning: "Cleaning Service",
      hvac: "HVAC Service",
      plumbing: "Plumbing Service",
      electrical: "Electrical Service",
      pool_spa: "Pool/Spa Service",
      pest_control: "Pest Control",
      landscaping: "Landscaping",
    };
    return labels[specialty] || specialty.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const getSpecialtyIcon = (specialty: string) => {
    if (specialty === "valet_trash" || specialty === "trash_services") {
      return <Trash2 className="h-5 w-5" />;
    }
    return <CheckCircle className="h-5 w-5" />;
  };

  const totalMonthlyCost = activeServices.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (activeServices.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-primary" />
            Active Services
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <DollarSign className="h-3 w-3" />
              ${totalMonthlyCost}/month total
            </Badge>
            <Badge variant="outline">
              {activeServices.length} assignments
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(servicesByType).map(([specialty, services]) => {
          const vendorName = services[0]?.vendor?.company_name || services[0]?.vendor?.name || "Unknown";
          const monthlyTotal = services.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

          return (
            <div key={specialty} className="rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-primary">{getSpecialtyIcon(specialty)}</span>
                  <span className="font-medium">{getSpecialtyLabel(specialty)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{services.length} Properties</Badge>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    ${monthlyTotal}/month
                  </Badge>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                Provider: <span className="font-medium text-foreground">{vendorName}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      <span className="truncate">{service.property?.name || "Unknown Property"}</span>
                    </div>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">
                      ${service.monthly_cost || 0}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ActiveServicesOverview;