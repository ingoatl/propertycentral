import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataForListingPlatformsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyName: string;
}

interface ListingData {
  // Listing URLs - Priority
  airbnbUrl: string;
  vrboUrl: string;
  directBookingWebsite: string;
  
  // Basic Info
  propertyAddress: string;
  brandName: string;
  rentalType: string;
  propertyTypeDetail: string;
  stories: string;
  parking: string;
  elementarySchool: string;
  middleSchool: string;
  highSchool: string;
  adaCompliant: string;
  basement: string;
  fencedYard: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  
  // Pet Info
  petsAllowed: string;
  petRules: string;
  maxPets: string;
  maxPetWeight: string;
  
  // Financial
  monthlyRent: string;
  nightlyRate: string;
  securityDeposit: string;
  utilityCap: string;
  cleaningFee: string;
  adminFee: string;
  petFee: string;
  monthlyPetRent: string;
  monthlyCleaningFee: string;
  
  // Lease Terms
  leaseTerm: string;
  noticeToVacate: string;
  
  // Contact & Web
  contactEmail: string;
  
  // Assets
  propertyPhotos: string;
  listingDescriptions: string;
}

export const DataForListingPlatforms = ({
  open,
  onOpenChange,
  propertyId,
  propertyName
}: DataForListingPlatformsProps) => {
  const [loading, setLoading] = useState(false);
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (open && propertyId) {
      loadListingData();
    }
  }, [open, propertyId]);

  const loadListingData = async () => {
    setLoading(true);
    try {
      console.log("Loading listing data for property:", propertyId);
      
      // Get the project ID for this property (use maybeSingle to avoid errors)
      const { data: projects, error: projectError } = await supabase
        .from("onboarding_projects")
        .select("id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("Projects query result:", { projects, projectError });

      if (!projects) {
        console.error("No project found for property:", propertyId);
        toast.error("No onboarding project found for this property");
        setLoading(false);
        return;
      }

      // Fetch all onboarding tasks
      const { data: tasks, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select("title, field_value")
        .eq("project_id", projects.id);

      console.log("Tasks query result:", { taskCount: tasks?.length, tasksError });

      // Fetch property data from comprehensive view
      const { data: propertyData, error: propertyError } = await supabase
        .from("comprehensive_property_data")
        .select("*")
        .eq("id", propertyId)
        .maybeSingle();

      console.log("Property data result:", { propertyData, propertyError });

      // Helper function to get task value
      const getTaskValue = (title: string) => {
        const task = tasks?.find(t => t.title === title);
        return task?.field_value || "";
      };

      // Build listing data object - PRIORITIZE task values over property data
      const data: ListingData = {
        // Listing URLs first
        airbnbUrl: getTaskValue("Airbnb") || "",
        vrboUrl: getTaskValue("VRBO") || "",
        directBookingWebsite: getTaskValue("Direct Booking Website") || propertyData?.website_url || "",
        
        propertyAddress: propertyData?.address || "",
        brandName: getTaskValue("Brand Name") || propertyData?.brand_name || "",
        rentalType: propertyData?.rental_type || "",
        propertyTypeDetail: getTaskValue("Property Type Detail") || propertyData?.property_type_detail || "",
        stories: getTaskValue("Stories") || propertyData?.stories || "",
        parking: getTaskValue("Parking Type") ? `${getTaskValue("Parking Type")} - ${getTaskValue("Parking Capacity")} spaces` : (propertyData?.parking_type ? `${propertyData.parking_type} - ${propertyData.parking_spaces} spaces` : ""),
        elementarySchool: getTaskValue("Elementary School") || propertyData?.elementary_school || "",
        middleSchool: getTaskValue("Middle School") || propertyData?.middle_school || "",
        highSchool: getTaskValue("High School") || propertyData?.high_school || "",
        adaCompliant: getTaskValue("ADA Compliant") || "",
        basement: propertyData?.basement ? "Yes" : "No",
        fencedYard: getTaskValue("Fenced Yard") || propertyData?.fenced_yard || "",
        bedrooms: getTaskValue("Bedrooms") || propertyData?.bedrooms?.toString() || "",
        bathrooms: getTaskValue("Bathrooms") || propertyData?.bathrooms?.toString() || "",
        sqft: getTaskValue("Square Footage") || propertyData?.sqft?.toString() || "",
        
        petsAllowed: getTaskValue("Pets Allowed") || (propertyData?.pets_allowed ? "Yes" : "No"),
        petRules: getTaskValue("Pet Rules") || propertyData?.pet_rules || "",
        maxPets: getTaskValue("Maximum Number of Pets") || propertyData?.max_pets?.toString() || "",
        maxPetWeight: getTaskValue("Maximum Pet Weight (lbs)") || propertyData?.max_pet_weight?.toString() || "",
        
        monthlyRent: getTaskValue("Monthly Rent") || (propertyData?.monthly_rent ? `$${propertyData.monthly_rent}` : ""),
        nightlyRate: getTaskValue("Nightly Rate") || (propertyData?.nightly_rate ? `$${propertyData.nightly_rate}` : ""),
        securityDeposit: getTaskValue("Security Deposit") || (propertyData?.security_deposit ? `$${propertyData.security_deposit}` : ""),
        utilityCap: getTaskValue("Utility Cap") || (propertyData?.utility_cap ? `$${propertyData.utility_cap}` : ""),
        cleaningFee: getTaskValue("Cleaning Fee") || (propertyData?.cleaning_fee ? `$${propertyData.cleaning_fee}` : ""),
        adminFee: getTaskValue("Admin Fee") || (propertyData?.admin_fee ? `$${propertyData.admin_fee}` : ""),
        petFee: getTaskValue("Pet Fee") || (propertyData?.pet_fee ? `$${propertyData.pet_fee}` : ""),
        monthlyPetRent: getTaskValue("Monthly Pet Rent") || (propertyData?.monthly_pet_rent ? `$${propertyData.monthly_pet_rent}` : ""),
        monthlyCleaningFee: getTaskValue("Monthly Cleaning Fee") || (propertyData?.monthly_cleaning_fee ? `$${propertyData.monthly_cleaning_fee}` : ""),
        
        leaseTerm: getTaskValue("Lease Term") || propertyData?.lease_term || "",
        noticeToVacate: getTaskValue("Notice to Vacate") || propertyData?.notice_to_vacate || "",
        
        contactEmail: getTaskValue("Contact Email") || propertyData?.contact_email || "",
        
        propertyPhotos: getTaskValue("Upload professional photos") || getTaskValue("Link to existing photos") || "",
        listingDescriptions: getTaskValue("Digital guidebook published") || ""
      };

      console.log("Built listing data:", data);
      setListingData(data);
    } catch (error) {
      console.error("Error loading listing data:", error);
      toast.error("Failed to load listing data");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`Copied ${fieldName}`);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const DataRow = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <div className="flex items-start justify-between py-3 max-md:py-4 border-b border-border/50 last:border-0 gap-4 max-md:gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm max-md:text-lg font-medium text-foreground mb-1">{label}</p>
        {note && <p className="text-xs max-md:text-sm text-muted-foreground mt-0.5">{note}</p>}
        {value ? (
          isUrl(value) ? (
            <a 
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm max-md:text-base text-primary hover:underline break-words overflow-wrap-anywhere block"
              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {value}
            </a>
          ) : (
            <p className="text-sm max-md:text-base text-muted-foreground break-words">{value}</p>
          )
        ) : (
          <p className="text-sm max-md:text-base text-muted-foreground">—</p>
        )}
      </div>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0 mt-0.5"
          onClick={() => copyToClipboard(value, label)}
        >
          {copiedField === label ? (
            <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
          )}
        </Button>
      )}
    </div>
  );

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('www.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] max-md:max-h-screen">
        <DialogHeader>
          <DialogTitle className="text-xl max-md:text-2xl">Listing Data - {propertyName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : listingData ? (
          <ScrollArea className="h-[70vh] max-md:h-[calc(100vh-120px)] pr-4 max-md:pr-2">
            <div className="space-y-6 max-md:space-y-5">
              {/* Listing URLs - Priority Section */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3 max-md:pb-4">
                  <CardTitle className="text-base max-md:text-xl">Listing URLs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Airbnb URL" value={listingData.airbnbUrl} />
                  <DataRow label="VRBO URL" value={listingData.vrboUrl} />
                  <DataRow label="Direct Booking Website" value={listingData.directBookingWebsite} />
                </CardContent>
              </Card>

              {/* Property Specifications */}
              <Card>
                <CardHeader className="pb-3 max-md:pb-4">
                  <CardTitle className="text-base max-md:text-xl">Property Specifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Property Address" value={listingData.propertyAddress} />
                  <DataRow label="Brand Name" value={listingData.brandName} />
                  <DataRow label="STR/MTR" value={listingData.rentalType} />
                  <DataRow label="House Type" value={listingData.propertyTypeDetail} />
                  <DataRow label="Stories" value={listingData.stories} />
                  <DataRow label="Parking" value={listingData.parking} />
                  <DataRow label="Bedrooms" value={listingData.bedrooms} />
                  <DataRow label="Bathrooms" value={listingData.bathrooms} />
                  <DataRow label="Square Footage" value={listingData.sqft} />
                  <DataRow label="ADA Compliant" value={listingData.adaCompliant} />
                  <DataRow label="Basement" value={listingData.basement} />
                  <DataRow label="Fenced Yard" value={listingData.fencedYard} />
                </CardContent>
              </Card>

              {/* Schools & Pet Policies */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Schools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Elementary School" value={listingData.elementarySchool} />
                  <DataRow label="Middle School" value={listingData.middleSchool} />
                  <DataRow label="High School" value={listingData.highSchool} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pet Policies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Pets Allowed" value={listingData.petsAllowed} />
                  <DataRow label="Pet Rules" value={listingData.petRules} />
                  <DataRow label="Maximum Pets" value={listingData.maxPets} />
                  <DataRow label="Max Pet Weight (lbs)" value={listingData.maxPetWeight} />
                </CardContent>
              </Card>

              {/* Financial Terms */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Financial Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Monthly Rent" value={listingData.monthlyRent} />
                  <DataRow label="Nightly Rate" value={listingData.nightlyRate} />
                  <DataRow label="Security Deposit" value={listingData.securityDeposit} />
                  <DataRow label="Utility Cap" value={listingData.utilityCap} />
                  <DataRow label="Cleaning Fee" value={listingData.cleaningFee} note="Move-out - one time" />
                  <DataRow label="Admin Fee" value={listingData.adminFee} note="One time" />
                  <DataRow label="Pet Fee" value={listingData.petFee} note="Per pet" />
                  <DataRow label="Monthly Pet Rent" value={listingData.monthlyPetRent} note="Per pet/negotiable" />
                  <DataRow label="Monthly Cleaning Fee" value={listingData.monthlyCleaningFee} />
                </CardContent>
              </Card>

              {/* Lease Terms */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Lease Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Lease Term" value={listingData.leaseTerm} />
                  <DataRow label="Notice to Vacate" value={listingData.noticeToVacate} />
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Contact Email" value={listingData.contactEmail} />
                </CardContent>
              </Card>

              {/* Assets */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Assets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <DataRow label="Property Photos" value={listingData.propertyPhotos} />
                  <DataRow label="Listing Descriptions" value={listingData.listingDescriptions} />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No listing data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
