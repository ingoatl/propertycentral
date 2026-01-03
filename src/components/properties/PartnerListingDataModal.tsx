import { 
  ResponsiveModal, 
  ResponsiveModalContent, 
  ResponsiveModalHeader, 
  ResponsiveModalTitle 
} from "@/components/ui/responsive-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Copy, Check, Download, Image as ImageIcon, User, Mail, Phone, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PartnerProperty {
  id: string;
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

interface PartnerListingDataModalProps {
  property: PartnerProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartnerListingDataModal({ 
  property, 
  open, 
  onOpenChange
}: PartnerListingDataModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  
  if (!property) return null;

  const amenitiesList = Array.isArray(property.amenities) 
    ? property.amenities 
    : typeof property.amenities === 'object' && property.amenities !== null
      ? Object.values(property.amenities).flat()
      : [];

  const copyToClipboard = (value: string, fieldName: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Get all images
  const allImages = [
    ...(property.featured_image_url ? [property.featured_image_url] : []),
    ...(property.gallery_images || [])
  ];

  const downloadAllImages = async () => {
    if (allImages.length === 0) {
      toast.error("No images available to download");
      return;
    }

    setDownloading(true);
    toast.info(`Downloading ${allImages.length} images...`);

    try {
      for (let i = 0; i < allImages.length; i++) {
        const imageUrl = allImages[i];
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const urlParts = imageUrl.split('/');
        let filename = urlParts[urlParts.length - 1];
        if (!filename || !filename.includes('.')) {
          const extension = blob.type.split('/')[1] || 'jpg';
          filename = `${property.property_title?.replace(/[^a-zA-Z0-9]/g, '_') || 'property'}_image_${i + 1}.${extension}`;
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        if (i < allImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      toast.success(`Downloaded ${allImages.length} images successfully!`);
    } catch (error) {
      console.error("Error downloading images:", error);
      toast.error("Failed to download some images. Try right-clicking to save individually.");
    } finally {
      setDownloading(false);
    }
  };

  // Listing data items for quick copy - organized by category
  const ownerInfoItems = [
    { label: "Owner Name", value: property.contact_name, icon: User },
    { label: "Owner Email", value: property.contact_email, icon: Mail },
    { label: "Owner Phone", value: property.contact_phone, icon: Phone },
  ].filter(item => item.value);

  const propertyInfoItems = [
    { label: "Property Title", value: property.property_title },
    { label: "Full Address", value: property.address || [property.city, property.state, property.zip_code].filter(Boolean).join(", ") },
    { label: "City", value: property.city },
    { label: "State", value: property.state },
    { label: "Zip Code", value: property.zip_code },
    { label: "Property Type", value: property.property_type },
    { label: "Bedrooms", value: property.bedrooms?.toString() },
    { label: "Bathrooms", value: property.bathrooms?.toString() },
    { label: "Square Footage", value: property.square_footage?.toLocaleString() },
    { label: "Max Guests", value: property.max_guests?.toString() },
    { label: "Stories", value: property.stories?.toString() },
    { label: "Parking Spaces", value: property.parking_spaces?.toString() },
    { label: "Parking Type", value: property.parking_type },
    { label: "Year Built", value: property.year_built?.toString() },
  ].filter(item => item.value);

  const pricingItems = [
    { 
      label: "Listing Price (Zillow × 2.3)", 
      value: (property as any).calculated_listing_price 
        ? `$${(property as any).calculated_listing_price.toLocaleString()}/mo` 
        : null, 
      highlight: true,
      badge: "Use this price"
    },
    { 
      label: "Zillow Rent Zestimate", 
      value: (property as any).zillow_rent_zestimate 
        ? `$${(property as any).zillow_rent_zestimate.toLocaleString()}/mo` 
        : null
    },
    { 
      label: "MidTermNation Price", 
      value: property.monthly_price ? `$${property.monthly_price.toLocaleString()}/mo` : null,
      note: "Original sync price"
    },
    { label: "Security Deposit", value: property.security_deposit ? `$${property.security_deposit.toLocaleString()}` : null },
    { label: "Cleaning Fee", value: property.cleaning_fee ? `$${property.cleaning_fee.toLocaleString()}` : null },
  ].filter(item => item.value);

  const policyItems = [
    { label: "Pet Policy", value: property.pet_policy },
    { label: "Pet Details", value: property.pet_policy_details },
  ].filter(item => item.value);

  const descriptionItems = [
    { label: "Description", value: property.property_description },
    { label: "Amenities", value: amenitiesList.length > 0 ? amenitiesList.join(", ") : null },
    { label: "Services Included", value: property.services_included?.join(", ") },
    { label: "Utilities Included", value: property.utilities_included?.join(", ") },
    { label: "Appliances Included", value: property.appliances_included?.join(", ") },
  ].filter(item => item.value);

  const linkItems = [
    { label: "Existing Listing URL", value: property.existing_listing_url },
    { label: "Virtual Tour URL", value: property.virtual_tour_url },
  ].filter(item => item.value);

  const allItems = [...ownerInfoItems, ...propertyInfoItems, ...pricingItems, ...policyItems, ...descriptionItems, ...linkItems];

  const renderDataItem = (item: { label: string; value: string | null | undefined; highlight?: boolean }, idx: number) => (
    <div 
      key={idx}
      className={`flex items-center justify-between p-3 max-md:p-4 rounded-lg hover:bg-muted cursor-pointer transition-colors group ${item.highlight ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : 'bg-muted/50'}`}
      onClick={() => item.value && copyToClipboard(item.value, item.label)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs max-md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {item.label}
        </p>
        <p className="text-sm max-md:text-base font-medium truncate pr-4">
          {item.value}
        </p>
        {item.highlight && (
          <p className="text-xs max-md:text-sm text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 max-md:w-4 max-md:h-4" />
            Calculate listing price: Zillow Zestimate × 2.3
          </p>
        )}
      </div>
      <div className="flex-shrink-0">
        {copiedField === item.label ? (
          <Check className="w-4 h-4 max-md:w-6 max-md:h-6 text-green-600" />
        ) : (
          <Copy className="w-4 h-4 max-md:w-6 max-md:h-6 text-muted-foreground opacity-100 max-md:opacity-100 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-2xl p-0">
        <ResponsiveModalHeader className="p-4 md:p-6 pb-2 md:pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <ResponsiveModalTitle className="text-lg md:text-xl font-semibold">
                Listing Data
              </ResponsiveModalTitle>
              <div className="flex items-center gap-2 text-sm max-md:text-base text-muted-foreground mt-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  {property.property_title || property.address || [property.city, property.state].filter(Boolean).join(", ") || "No address"}
                </span>
              </div>
            </div>
            <Badge className="bg-orange-500 text-white flex-shrink-0">Partner</Badge>
          </div>
        </ResponsiveModalHeader>
        
        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)] max-md:max-h-[calc(95vh-140px)]">
          <div className="p-4 md:p-6 pt-0 space-y-4">
            <div className="flex flex-col max-md:gap-3 md:flex-row md:items-center md:justify-between gap-2">
              <p className="text-sm max-md:text-base text-muted-foreground">
                Click any field to copy its value.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="max-md:w-full max-md:h-12 max-md:text-base"
                onClick={() => {
                  const allText = allItems.map(item => `${item.label}: ${item.value}`).join("\n");
                  navigator.clipboard.writeText(allText);
                  toast.success("All listing data copied!");
                }}
              >
                <Copy className="w-3 h-3 max-md:w-5 max-md:h-5 mr-1.5" />
                Copy All
              </Button>
            </div>

            {/* Owner Information Section */}
            {ownerInfoItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs max-md:text-sm font-semibold text-primary uppercase tracking-wide flex items-center gap-2">
                  <User className="w-3 h-3 max-md:w-4 max-md:h-4" />
                  Owner Information
                </h4>
                <div className="grid gap-2">
                  {ownerInfoItems.map((item, idx) => renderDataItem(item, idx))}
                </div>
              </div>
            )}

            {/* Property Details Section */}
            <div className="space-y-2">
              <h4 className="text-xs max-md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Property Details
              </h4>
              <div className="grid gap-2">
                {propertyInfoItems.map((item, idx) => renderDataItem(item, idx))}
              </div>
            </div>

            {/* Pricing Section */}
            {pricingItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs max-md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Pricing
                </h4>
                <div className="grid gap-2">
                  {pricingItems.map((item, idx) => renderDataItem(item, idx))}
                </div>
              </div>
            )}

            {/* Policy Section */}
            {policyItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs max-md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Policies
                </h4>
                <div className="grid gap-2">
                  {policyItems.map((item, idx) => renderDataItem(item, idx))}
                </div>
              </div>
            )}

            {/* Description & Features Section */}
            {descriptionItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs max-md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Description & Features
                </h4>
                <div className="grid gap-2">
                  {descriptionItems.map((item, idx) => renderDataItem(item, idx))}
                </div>
              </div>
            )}

            {/* Links Section */}
            {linkItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs max-md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  External Links
                </h4>
                <div className="grid gap-2">
                  {linkItems.map((item, idx) => renderDataItem(item, idx))}
                </div>
              </div>
            )}

            {/* Images Section with Download All */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex flex-col max-md:gap-3 md:flex-row md:items-center md:justify-between">
                <h4 className="text-xs max-md:text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <ImageIcon className="w-3 h-3 max-md:w-4 max-md:h-4" />
                  Property Images ({allImages.length})
                </h4>
                {allImages.length > 0 && (
                  <Button 
                    variant="default" 
                    size="sm"
                    className="max-md:w-full max-md:h-12 max-md:text-base"
                    onClick={downloadAllImages}
                    disabled={downloading}
                  >
                    <Download className="w-3 h-3 max-md:w-5 max-md:h-5 mr-1.5" />
                    {downloading ? "Downloading..." : `Download All (${allImages.length})`}
                  </Button>
                )}
              </div>

              {property.featured_image_url && (
                <div>
                  <p className="text-xs max-md:text-sm text-muted-foreground mb-2">Featured Image</p>
                  <img 
                    src={property.featured_image_url} 
                    alt={property.property_title || "Property"} 
                    className="w-full h-48 max-md:h-56 object-cover rounded-lg"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs max-md:text-sm max-md:h-10 max-md:w-full"
                    onClick={() => copyToClipboard(property.featured_image_url!, "Featured Image URL")}
                  >
                    <Copy className="w-3 h-3 max-md:w-4 max-md:h-4 mr-1.5" />
                    Copy Image URL
                  </Button>
                </div>
              )}

              {property.gallery_images && property.gallery_images.length > 0 && (
                <div>
                  <p className="text-xs max-md:text-sm text-muted-foreground mb-2">Gallery Images ({property.gallery_images.length})</p>
                  <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
                    {property.gallery_images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img 
                          src={img} 
                          alt={`Gallery ${idx + 1}`} 
                          className="w-full h-24 max-md:h-32 object-cover rounded-md"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity bg-black/50 text-white text-xs max-md:text-sm"
                          onClick={() => copyToClipboard(img, `Gallery Image ${idx + 1}`)}
                        >
                          <Copy className="w-3 h-3 max-md:w-4 max-md:h-4 mr-1" />
                          Copy URL
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allImages.length === 0 && (
                <div className="flex items-center justify-center h-24 max-md:h-32 bg-muted/50 rounded-lg">
                  <p className="text-sm max-md:text-base text-muted-foreground">No images available</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
