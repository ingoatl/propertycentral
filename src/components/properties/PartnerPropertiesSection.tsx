import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Users, 
  ExternalLink, 
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PartnerProperty {
  id: string;
  source_id: string;
  source_system: string;
  category: string;
  property_title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  property_type: string | null;
  property_description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  max_guests: number | null;
  monthly_price: number | null;
  featured_image_url: string | null;
  status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  existing_listing_url: string | null;
  synced_at: string | null;
}

interface SyncLog {
  id: string;
  sync_type: string;
  source_system: string;
  properties_synced: number;
  properties_failed: number;
  sync_status: string;
  started_at: string;
  completed_at: string | null;
}

export const PartnerPropertiesSection = () => {
  const [properties, setProperties] = useState<PartnerProperty[]>([]);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartnerProperties();
    loadLastSync();
  }, []);

  const loadPartnerProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("partner_properties")
        .select("*")
        .eq("status", "active")
        .order("synced_at", { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error loading partner properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLastSync = async () => {
    try {
      const { data, error } = await supabase
        .from("partner_sync_log")
        .select("*")
        .eq("source_system", "midtermnation")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setLastSync(data);
    } catch (error) {
      console.error("Error loading sync log:", error);
    }
  };

  const getSyncStatusBadge = () => {
    if (!lastSync) return null;
    
    const syncAge = Date.now() - new Date(lastSync.started_at).getTime();
    const hoursAgo = syncAge / (1000 * 60 * 60);

    if (lastSync.sync_status === "failed") {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Sync Failed
        </Badge>
      );
    }

    if (hoursAgo > 25) {
      return (
        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
          <Clock className="w-3 h-3" />
          Sync Overdue
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
        <CheckCircle className="w-3 h-3" />
        Synced {format(new Date(lastSync.started_at), "MMM d, h:mm a")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          <Building2 className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-semibold text-foreground">
            PARTNER INVENTORY (MidTermNation)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-40 bg-muted" />
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-orange-500" />
          <h2 className="text-xl font-semibold text-foreground">
            PARTNER INVENTORY (MidTermNation)
          </h2>
          <span className="text-sm text-muted-foreground">({properties.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {getSyncStatusBadge()}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {properties.map((property, index) => (
          <Card 
            key={property.id}
            className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 overflow-hidden group border-l-4 border-l-orange-400"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
              {property.featured_image_url ? (
                <img 
                  src={property.featured_image_url} 
                  alt={property.property_title || "Partner property"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10">
                  <Building2 className="w-12 h-12 text-orange-300" />
                </div>
              )}
              <Badge className="absolute top-2 right-2 bg-orange-500 text-white">
                Partner
              </Badge>
            </div>

            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                  {property.property_title || "Untitled Property"}
                </CardTitle>
              </div>
              <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="line-clamp-1">
                  {[property.city, property.state].filter(Boolean).join(", ") || property.address || "No address"}
                </span>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="px-3 pb-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {property.bedrooms && (
                  <span className="flex items-center gap-1">
                    <Bed className="w-3 h-3" />
                    {property.bedrooms} bed
                  </span>
                )}
                {property.bathrooms && (
                  <span className="flex items-center gap-1">
                    <Bath className="w-3 h-3" />
                    {property.bathrooms} bath
                  </span>
                )}
                {property.square_footage && (
                  <span className="flex items-center gap-1">
                    <Square className="w-3 h-3" />
                    {property.square_footage.toLocaleString()} sqft
                  </span>
                )}
                {property.max_guests && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {property.max_guests} guests
                  </span>
                )}
              </div>

              {property.monthly_price && (
                <div className="text-sm font-semibold text-primary">
                  ${property.monthly_price.toLocaleString()}/mo
                </div>
              )}

              {property.existing_listing_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => window.open(property.existing_listing_url!, "_blank")}
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  View Listing
                </Button>
              )}

              {property.contact_email && (
                <div className="text-xs text-muted-foreground truncate">
                  Contact: {property.contact_name || property.contact_email}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
