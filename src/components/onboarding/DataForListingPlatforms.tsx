import { useState, useEffect } from "react";
import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle 
} from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  icalUrl: string;
  bookingUrl: string;
  furnishedFinderUrl: string;
  zillowUrl: string;
  
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
  yearBuilt: string;
  pool: string;
  furnished: string;
  maxOccupancy: string;
  wifiSSID: string;
  wifiPassword: string;
  uniqueSellingPoints: string;
  
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
  
  // Contact Information
  contactEmail: string;
  contactPhone: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  primaryCleanerName: string;
  primaryCleanerPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  
  // Assets
  propertyPhotos: string;
  listingDescriptions: string;
  virtualTour: string;
  floorplan: string;
  videoTour: string;
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
  const [searchQuery, setSearchQuery] = useState("");

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

      // Fetch iCal URL from properties table
      const { data: propertyInfo } = await supabase
        .from("properties")
        .select("ical_url")
        .eq("id", propertyId)
        .maybeSingle();

      console.log("Property data result:", { propertyData, propertyError, icalUrl: propertyInfo?.ical_url });

      // Helper function to get task value
      const getTaskValue = (title: string) => {
        const task = tasks?.find(t => t.title === title);
        return task?.field_value || "";
      };

      // Build listing data object - PRIORITIZE task values over property data
      const data: ListingData = {
        // Listing URLs first
        airbnbUrl: getTaskValue("Airbnb") || getTaskValue("Airbnb - 1 year Listing") || getTaskValue("Airbnb – 1-Year Listing") || "",
        vrboUrl: getTaskValue("VRBO") || "",
        directBookingWebsite: getTaskValue("Direct Booking Website") || getTaskValue("Direct Booking Page") || propertyData?.website_url || "",
        icalUrl: getTaskValue("iCal Feed URL") || propertyInfo?.ical_url || "",
        bookingUrl: getTaskValue("Booking.com") || getTaskValue("Booking") || "",
        furnishedFinderUrl: getTaskValue("Furnished Finder") || "",
        zillowUrl: getTaskValue("Zillow") || "",
        
        propertyAddress: propertyData?.address || "",
        brandName: getTaskValue("Brand Name") || propertyData?.brand_name || "",
        rentalType: propertyData?.rental_type || "",
        propertyTypeDetail: getTaskValue("Property Type Detail") || getTaskValue("House Type") || propertyData?.property_type_detail || "",
        stories: getTaskValue("Stories") || getTaskValue("Number of Stories") || propertyData?.stories || "",
        parking: getTaskValue("Parking Type") ? `${getTaskValue("Parking Type")} - ${getTaskValue("Parking Capacity") || getTaskValue("Parking Spaces")} spaces` : (propertyData?.parking_type ? `${propertyData.parking_type} - ${propertyData.parking_spaces} spaces` : ""),
        elementarySchool: getTaskValue("Elementary School") || propertyData?.elementary_school || "",
        middleSchool: getTaskValue("Middle School") || propertyData?.middle_school || "",
        highSchool: getTaskValue("High School") || propertyData?.high_school || "",
        adaCompliant: getTaskValue("ADA Compliant") || "",
        basement: getTaskValue("Basement") || (propertyData?.basement ? "Yes" : "No"),
        fencedYard: getTaskValue("Fenced Yard") || propertyData?.fenced_yard || "",
        bedrooms: getTaskValue("Bedrooms") || getTaskValue("Number of Bedrooms") || propertyData?.bedrooms?.toString() || "",
        bathrooms: getTaskValue("Bathrooms") || getTaskValue("Number of Bathrooms") || propertyData?.bathrooms?.toString() || "",
        sqft: getTaskValue("Square Footage") || propertyData?.sqft?.toString() || "",
        yearBuilt: getTaskValue("Year Built") || "",
        pool: getTaskValue("Pool") || getTaskValue("Pool/Hot Tub Information") || "",
        furnished: getTaskValue("Furnished") || "",
        maxOccupancy: getTaskValue("Max Occupancy") || "",
        wifiSSID: getTaskValue("WiFi SSID") || "",
        wifiPassword: getTaskValue("WiFi password") || "",
        uniqueSellingPoints: getTaskValue("Unique Selling Points") || getTaskValue("Unique selling points of property") || "",
        
        petsAllowed: getTaskValue("Pets Allowed") || (propertyData?.pets_allowed ? "Yes" : "No"),
        petRules: getTaskValue("Pet Rules") || getTaskValue("Pet policy") || propertyData?.pet_rules || "",
        maxPets: getTaskValue("Maximum Number of Pets") || propertyData?.max_pets?.toString() || "",
        maxPetWeight: getTaskValue("Maximum Pet Weight (lbs)") || getTaskValue("Pet size restrictions") || propertyData?.max_pet_weight?.toString() || "",
        
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
        
        // Contact Information - expanded
        contactEmail: getTaskValue("Contact Email") || propertyData?.contact_email || "",
        contactPhone: getTaskValue("Contact Phone") || "",
        ownerName: getTaskValue("Owner Name") || "",
        ownerEmail: getTaskValue("Owner Email") || "",
        ownerPhone: getTaskValue("Owner Phone") || "",
        primaryCleanerName: getTaskValue("Primary cleaner name") || "",
        primaryCleanerPhone: getTaskValue("Primary cleaner phone number") || "",
        emergencyContactName: getTaskValue("Emergency Contact Name") || "",
        emergencyContactPhone: getTaskValue("Emergency Contact Phone") || "",
        
        // Assets - expanded
        propertyPhotos: getTaskValue("Upload professional photos") || getTaskValue("Link to existing photos") || getTaskValue("Existing Photos Link") || getTaskValue("Professional Photos") || "",
        listingDescriptions: getTaskValue("Digital guidebook published") || getTaskValue("Listing Description") || "",
        virtualTour: getTaskValue("Virtual Tour") || getTaskValue("Virtual walkthrough created/uploaded") || "",
        floorplan: getTaskValue("Floorplan") || "",
        videoTour: getTaskValue("Video Tour") || ""
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

  const DataRow = ({ label, value, note }: { label: string; value: string; note?: string }) => {
    const query = searchQuery.toLowerCase();
    const isMatch = searchQuery && (
      label.toLowerCase().includes(query) ||
      value.toLowerCase().includes(query) ||
      (note && note.toLowerCase().includes(query))
    );

    return (
      <div className={`flex items-start justify-between py-3 max-md:py-4 border-b border-border/50 last:border-0 gap-4 max-md:gap-3 ${isMatch ? 'bg-primary/5 px-2 rounded-md' : ''}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm max-md:text-base font-medium text-foreground mb-1">{label}</p>
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
            className="h-8 w-8 max-md:h-12 max-md:w-12 flex-shrink-0 mt-0.5 flex"
            onClick={() => copyToClipboard(value, label)}
          >
            {copiedField === label ? (
              <Check className="h-4 w-4 max-md:h-6 max-md:w-6 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 max-md:h-6 max-md:w-6" />
            )}
          </Button>
        )}
      </div>
    );
  };

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('www.');
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-4xl p-0 h-[90vh] max-md:h-[95vh]">
        <ResponsiveModalHeader className="p-4 md:p-6 pb-2 flex-shrink-0">
          <ResponsiveModalTitle className="text-lg md:text-xl">
            Listing Data - {propertyName}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="relative flex-shrink-0 px-4 md:px-6 mb-4">
          <Input
            placeholder="Search listing data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-md:h-12 max-md:text-base"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : listingData ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pb-6">
            <div className="space-y-4 max-md:space-y-3 px-4 md:px-6 pb-6">
              {/* Listing URLs - Priority Section */}
              <Card className="border-primary/20">
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Listing URLs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Airbnb URL" value={listingData.airbnbUrl} />
                  <DataRow label="VRBO URL" value={listingData.vrboUrl} />
                  <DataRow label="Booking.com URL" value={listingData.bookingUrl} />
                  <DataRow label="Furnished Finder URL" value={listingData.furnishedFinderUrl} />
                  <DataRow label="Zillow URL" value={listingData.zillowUrl} />
                  <DataRow label="Direct Booking Website" value={listingData.directBookingWebsite} />
                  <DataRow label="iCal Feed URL" value={listingData.icalUrl} />
                </CardContent>
              </Card>

              {/* Property Specifications */}
              <Card>
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Property Specifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Property Address" value={listingData.propertyAddress} />
                  <DataRow label="Brand Name" value={listingData.brandName} />
                  <DataRow label="STR/MTR" value={listingData.rentalType} />
                  <DataRow label="House Type" value={listingData.propertyTypeDetail} />
                  <DataRow label="Bedrooms" value={listingData.bedrooms} />
                  <DataRow label="Bathrooms" value={listingData.bathrooms} />
                  <DataRow label="Square Footage" value={listingData.sqft} />
                  <DataRow label="Stories" value={listingData.stories} />
                  <DataRow label="Year Built" value={listingData.yearBuilt} />
                  <DataRow label="Max Occupancy" value={listingData.maxOccupancy} />
                  <DataRow label="Parking" value={listingData.parking} />
                  <DataRow label="Pool/Hot Tub" value={listingData.pool} />
                  <DataRow label="Furnished" value={listingData.furnished} />
                  <DataRow label="ADA Compliant" value={listingData.adaCompliant} />
                  <DataRow label="Basement" value={listingData.basement} />
                  <DataRow label="Fenced Yard" value={listingData.fencedYard} />
                  <DataRow label="WiFi Network (SSID)" value={listingData.wifiSSID} />
                  <DataRow label="WiFi Password" value={listingData.wifiPassword} />
                  <DataRow label="Unique Selling Points" value={listingData.uniqueSellingPoints} />
                </CardContent>
              </Card>

              {/* Schools */}
              <Card>
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Schools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Elementary School" value={listingData.elementarySchool} />
                  <DataRow label="Middle School" value={listingData.middleSchool} />
                  <DataRow label="High School" value={listingData.highSchool} />
                </CardContent>
              </Card>

              {/* Pet Policies */}
              <Card>
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Pet Policies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Pets Allowed" value={listingData.petsAllowed} />
                  <DataRow label="Pet Rules" value={listingData.petRules} />
                  <DataRow label="Maximum Pets" value={listingData.maxPets} />
                  <DataRow label="Max Pet Weight (lbs)" value={listingData.maxPetWeight} />
                </CardContent>
              </Card>

              {/* Financial Terms */}
              <Card>
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Financial Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
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
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Lease Terms</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Lease Term" value={listingData.leaseTerm} />
                  <DataRow label="Notice to Vacate" value={listingData.noticeToVacate} />
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Owner Name" value={listingData.ownerName} />
                  <DataRow label="Owner Email" value={listingData.ownerEmail} />
                  <DataRow label="Owner Phone" value={listingData.ownerPhone} />
                  <DataRow label="Contact Email" value={listingData.contactEmail} />
                  <DataRow label="Contact Phone" value={listingData.contactPhone} />
                  <DataRow label="Primary Cleaner" value={listingData.primaryCleanerName} />
                  <DataRow label="Cleaner Phone" value={listingData.primaryCleanerPhone} />
                  <DataRow label="Emergency Contact" value={listingData.emergencyContactName} />
                  <DataRow label="Emergency Phone" value={listingData.emergencyContactPhone} />
                </CardContent>
              </Card>

              {/* Assets */}
              <Card>
                <CardHeader className="pb-2 max-md:pb-3 px-4 max-md:px-4">
                  <CardTitle className="text-sm max-md:text-lg">Assets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 px-4 max-md:px-4">
                  <DataRow label="Property Photos" value={listingData.propertyPhotos} />
                  <DataRow label="Virtual Tour" value={listingData.virtualTour} />
                  <DataRow label="Video Tour" value={listingData.videoTour} />
                  <DataRow label="Floorplan" value={listingData.floorplan} />
                  <DataRow label="Listing Descriptions" value={listingData.listingDescriptions} />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No listing data available
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
};
