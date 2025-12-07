import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  MapPin, 
  Bed, 
  Bath, 
  FileText,
  Database,
  ClipboardList,
  ExternalLink, 
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Image as ImageIcon,
  User
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { PartnerPropertyDetailsModal } from "./PartnerPropertyDetailsModal";
import { WorkflowDialog } from "@/components/onboarding/WorkflowDialog";

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
  stories: number | null;
  parking_spaces: number | null;
  parking_type: string | null;
  year_built: number | null;
  featured_image_url: string | null;
  gallery_images: string[] | null;
  amenities: any;
  monthly_price: number | null;
  security_deposit: number | null;
  cleaning_fee: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  pet_policy: string | null;
  pet_policy_details: string | null;
  existing_listing_url: string | null;
  virtual_tour_url: string | null;
  services_included: string[] | null;
  utilities_included: string[] | null;
  appliances_included: string[] | null;
  status: string | null;
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

interface ListingProject {
  id: string;
  partner_property_id: string;
  progress: number | null;
}

// Chris's user ID for auto-assignment
const CHRIS_USER_ID = "c4d6b107-70cd-487f-884c-0400edaf9f6f";

// Phase 7 tasks for partner property listings
const PHASE_7_TASKS = [
  { title: "Create PeachHaus Website Listing", field_type: "url" },
  { title: "Create Airbnb Listing", field_type: "url" },
  { title: "Create Furnished Finder Listing", field_type: "url" },
  { title: "Create VRBO Listing", field_type: "url" },
  { title: "Create Booking.com Listing", field_type: "url" },
  { title: "Create Zillow Listing", field_type: "url" },
  { title: "Create Facebook Marketplace Listing", field_type: "url" },
  { title: "Create Craigslist Listing", field_type: "url" },
];

export const PartnerPropertiesSection = () => {
  const [properties, setProperties] = useState<PartnerProperty[]>([]);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingProjects, setListingProjects] = useState<Record<string, { id: string; progress: number }>>({});
  const [selectedProperty, setSelectedProperty] = useState<PartnerProperty | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [showListingDataView, setShowListingDataView] = useState(false);
  const [creatingProject, setCreatingProject] = useState<string | null>(null);
  const [selectedWorkflowProject, setSelectedWorkflowProject] = useState<{ id: string; name: string; address: string; projectId: string; ownerName: string } | null>(null);

  useEffect(() => {
    loadPartnerProperties();
    loadLastSync();
    loadListingProjects();
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

  const loadListingProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("id, partner_property_id, progress")
        .not("partner_property_id", "is", null);

      if (error) throw error;
      
      const projectMap: Record<string, { id: string; progress: number }> = {};
      
      for (const project of data || []) {
        if (project.partner_property_id) {
          // Calculate real progress from tasks
          const { data: tasks } = await supabase
            .from("onboarding_tasks")
            .select("status, field_value")
            .eq("project_id", project.id);
          
          let progress = project.progress || 0;
          if (tasks && tasks.length > 0) {
            const tasksWithProgress = tasks.filter(
              t => t.status === "completed" || (t.field_value && t.field_value.trim() !== "")
            ).length;
            progress = (tasksWithProgress / tasks.length) * 100;
          }
          
          projectMap[project.partner_property_id] = { 
            id: project.id, 
            progress 
          };
        }
      }
      setListingProjects(projectMap);
    } catch (error) {
      console.error("Error loading listing projects:", error);
    }
  };

  const createListingProject = async (property: PartnerProperty) => {
    setCreatingProject(property.id);
    try {
      // Get Chris's profile
      const { data: chrisProfile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", CHRIS_USER_ID)
        .single();

      const ownerName = property.contact_name || "MidTermNation Partner";
      const propertyAddress = property.address || 
        [property.city, property.state].filter(Boolean).join(", ") || 
        property.property_title || 
        "Partner Property";

      // Create the project with partner_property_id
      const { data: project, error: projectError } = await supabase
        .from("onboarding_projects")
        .insert({
          owner_name: ownerName,
          property_address: propertyAddress,
          status: "in-progress",
          progress: 0,
          partner_property_id: property.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create Phase 7 tasks assigned to Chris
      const tasks = PHASE_7_TASKS.map((task, index) => ({
        project_id: project.id,
        phase_number: 7,
        phase_title: "Listings & Booking Platforms",
        title: task.title,
        field_type: task.field_type,
        status: "pending",
        assigned_to: chrisProfile?.first_name || "Chris",
        assigned_to_uuid: CHRIS_USER_ID,
        due_date: format(addDays(new Date(), 7 + index), "yyyy-MM-dd"),
        field_value: task.title.includes("Airbnb") && property.existing_listing_url 
          ? property.existing_listing_url 
          : null,
      }));

      const { error: tasksError } = await supabase
        .from("onboarding_tasks")
        .insert(tasks);

      if (tasksError) throw tasksError;

      // Update local state
      setListingProjects(prev => ({
        ...prev,
        [property.id]: { id: project.id, progress: 0 }
      }));

      toast.success(`Listing project created and assigned to ${chrisProfile?.first_name || "Chris"}`);
    } catch (error: any) {
      console.error("Error creating listing project:", error);
      toast.error(error.message || "Failed to create listing project");
    } finally {
      setCreatingProject(null);
    }
  };

  const openPropertyDetails = (property: PartnerProperty, showListingData = false) => {
    setSelectedProperty(property);
    setShowListingDataView(showListingData);
    setDetailsModalOpen(true);
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
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return null;
  }

  return (
    <>
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
          {properties.map((property, index) => {
            const projectInfo = listingProjects[property.id];
            const isCreating = creatingProject === property.id;
            const displayAddress = property.address || 
              [property.city, property.state, property.zip_code].filter(Boolean).join(", ") || 
              "No address";

            return (
              <Card 
                key={property.id}
                className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 overflow-hidden group"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Image with hover actions - matching existing property cards */}
                <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden cursor-pointer">
                  {property.featured_image_url ? (
                    <img 
                      src={property.featured_image_url} 
                      alt={property.property_title || "Partner property"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10">
                      <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  {/* Hover-only action button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPropertyDetails(property);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                    {property.existing_listing_url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(property.existing_listing_url!, "_blank");
                        }}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Airbnb
                      </Button>
                    )}
                  </div>
                </div>

                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
                      {property.property_title || "Untitled Property"}
                    </CardTitle>
                    <Badge className="flex-shrink-0 text-[10px] px-2 py-0.5 bg-orange-500 text-white">
                      Partner
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="line-clamp-1">{displayAddress}</span>
                  </CardDescription>
                  {/* Property specs like bed/bath */}
                  <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
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
                    {property.monthly_price && (
                      <span className="font-medium text-primary">
                        ${property.monthly_price.toLocaleString()}/mo
                      </span>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="px-3 pb-3 space-y-2">
                  {/* Progress bar - only show if project exists */}
                  {projectInfo && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round(projectInfo.progress)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${projectInfo.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Property Details button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPropertyDetails(property)}
                    className="w-full h-8 text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1.5" />
                    Property Details
                  </Button>

                  {/* Show Listing Data button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openPropertyDetails(property, true)}
                    className="w-full h-8 text-xs"
                  >
                    <Database className="w-3 h-3 mr-1.5" />
                    Show Listing Data
                  </Button>

                  {/* Create Listings / View Tasks button */}
                  {projectInfo ? (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full h-8 text-xs"
                      onClick={() => {
                        const displayAddress = property.address || 
                          [property.city, property.state, property.zip_code].filter(Boolean).join(", ") || 
                          "Partner Property";
                        setSelectedWorkflowProject({
                          id: property.id,
                          name: property.property_title || "Partner Property",
                          address: displayAddress,
                          projectId: projectInfo.id,
                          ownerName: property.contact_name || "MidTermNation Partner"
                        });
                      }}
                    >
                      <ClipboardList className="w-3 h-3 mr-1.5" />
                      Onboarding
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full h-8 text-xs"
                      onClick={() => createListingProject(property)}
                      disabled={isCreating}
                    >
                      {isCreating ? (
                        <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <ClipboardList className="w-3 h-3 mr-1.5" />
                      )}
                      {isCreating ? "Creating..." : "Create Listings"}
                    </Button>
                  )}

                  {/* Owner info from API */}
                  {property.contact_name && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate pt-1 border-t">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">Owner: {property.contact_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <PartnerPropertyDetailsModal 
        property={selectedProperty}
        open={detailsModalOpen}
        onOpenChange={(open) => {
          setDetailsModalOpen(open);
          if (!open) setShowListingDataView(false);
        }}
        showListingData={showListingDataView}
      />

      {selectedWorkflowProject && (
        <WorkflowDialog
          open={!!selectedWorkflowProject}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedWorkflowProject(null);
              loadListingProjects();
            }
          }}
          project={{ 
            id: selectedWorkflowProject.projectId, 
            owner_name: selectedWorkflowProject.ownerName,
            property_address: selectedWorkflowProject.address,
            status: "in-progress",
            progress: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }}
          propertyId={selectedWorkflowProject.id}
          propertyName={selectedWorkflowProject.name}
          propertyAddress={selectedWorkflowProject.address}
          visitPrice={0}
          onUpdate={loadListingProjects}
          isPartnerProperty={true}
        />
      )}
    </>
  );
};