import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Home, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RentRollEntry {
  property_id: string;
  property_name: string;
  property_address: string;
  owner_name: string;
  rental_type: string;
  current_tenant: string | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent: number;
  nightly_rate: number | null;
  occupancy_status: "occupied" | "vacant" | "upcoming";
  property_type: string;
}

export function RentRollTab() {
  const [rentRoll, setRentRoll] = useState<RentRollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all active properties with their bookings
      const { data: properties, error } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          address,
          rental_type,
          property_type,
          nightly_rate,
          owner_id
        `)
        .is("offboarded_at", null)
        .order("name");

      if (error) throw error;

      const today = new Date().toISOString().split("T")[0];

      const rentRollData: RentRollEntry[] = await Promise.all(
        (properties || []).map(async (prop) => {
          // Get owner name
          let ownerName = "No Owner";
          if (prop.owner_id) {
            const { data: ownerData } = await supabase
              .from("property_owners")
              .select("name")
              .eq("id", prop.owner_id)
              .single();
            ownerName = ownerData?.name || "Unknown";
          }

          // Get current/upcoming booking
          const { data: bookings } = await supabase
            .from("mid_term_bookings")
            .select("tenant_name, start_date, end_date, monthly_rent")
            .eq("property_id", prop.id)
            .or(`start_date.lte.${today},end_date.gte.${today}`)
            .order("start_date", { ascending: false })
            .limit(1);

          const currentBooking = bookings?.[0];
          let occupancyStatus: "occupied" | "vacant" | "upcoming" = "vacant";
          
          if (currentBooking) {
            if (currentBooking.start_date <= today && currentBooking.end_date >= today) {
              occupancyStatus = "occupied";
            } else if (currentBooking.start_date > today) {
              occupancyStatus = "upcoming";
            }
          }

          return {
            property_id: prop.id,
            property_name: prop.name,
            property_address: prop.address || "",
            owner_name: ownerName,
            rental_type: prop.rental_type || "hybrid",
            current_tenant: currentBooking?.tenant_name || null,
            lease_start: currentBooking?.start_date || null,
            lease_end: currentBooking?.end_date || null,
            monthly_rent: currentBooking?.monthly_rent || 0,
            nightly_rate: prop.nightly_rate,
            occupancy_status: occupancyStatus,
            property_type: prop.property_type || "Client-Managed",
          };
        })
      );

      setRentRoll(rentRollData);
    } catch (error) {
      console.error("Error loading rent roll:", error);
      toast({
        title: "Error",
        description: "Failed to load rent roll",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getOccupancyBadge = (status: string) => {
    const colors: Record<string, string> = {
      occupied: "bg-green-100 text-green-800",
      vacant: "bg-red-100 text-red-800",
      upcoming: "bg-blue-100 text-blue-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const exportRentRoll = () => {
    const csvContent = [
      ["Property", "Address", "Owner", "Type", "Tenant", "Lease Start", "Lease End", "Monthly Rent", "Status"].join(","),
      ...rentRoll.map(r => [
        `"${r.property_name}"`,
        `"${r.property_address}"`,
        `"${r.owner_name}"`,
        r.rental_type,
        `"${r.current_tenant || ""}"`,
        r.lease_start || "",
        r.lease_end || "",
        r.monthly_rent,
        r.occupancy_status,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-roll-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    totalProperties: rentRoll.length,
    occupied: rentRoll.filter(r => r.occupancy_status === "occupied").length,
    vacant: rentRoll.filter(r => r.occupancy_status === "vacant").length,
    totalMonthlyRent: rentRoll.reduce((sum, r) => sum + (r.monthly_rent || 0), 0),
  };

  const occupancyRate = stats.totalProperties > 0 
    ? Math.round((stats.occupied / stats.totalProperties) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.totalProperties}</div>
          <div className="text-sm text-muted-foreground">Total Properties</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.occupied}</div>
          <div className="text-sm text-muted-foreground">Occupied</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{stats.vacant}</div>
          <div className="text-sm text-muted-foreground">Vacant</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{occupancyRate}%</div>
          <div className="text-sm text-muted-foreground">Occupancy Rate</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalMonthlyRent)}</div>
          <div className="text-sm text-muted-foreground">Monthly Rent</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Property Rent Roll</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportRentRoll}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {rentRoll.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Properties</h3>
          <p className="text-muted-foreground">No active properties found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Current Tenant</TableHead>
                <TableHead>Lease Period</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentRoll.map((entry) => (
                <TableRow key={entry.property_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.property_name}</div>
                      <div className="text-sm text-muted-foreground">{entry.property_address}</div>
                    </div>
                  </TableCell>
                  <TableCell>{entry.owner_name}</TableCell>
                  <TableCell className="capitalize">{entry.rental_type?.replace("_", " ")}</TableCell>
                  <TableCell>{entry.current_tenant || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    {entry.lease_start && entry.lease_end ? (
                      <span className="text-sm">
                        {format(new Date(entry.lease_start), "MMM d")} - {format(new Date(entry.lease_end), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.monthly_rent > 0 ? formatCurrency(entry.monthly_rent) : "-"}
                  </TableCell>
                  <TableCell>{getOccupancyBadge(entry.occupancy_status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
