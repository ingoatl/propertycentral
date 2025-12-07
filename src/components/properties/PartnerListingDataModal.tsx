import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MapPin, Copy, Check } from "lucide-react";
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

  // Listing data items for quick copy
  const listingDataItems = [
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
    { label: "Monthly Rent", value: property.monthly_price ? `$${property.monthly_price.toLocaleString()}` : null },
    { label: "Security Deposit", value: property.security_deposit ? `$${property.security_deposit.toLocaleString()}` : null },
    { label: "Cleaning Fee", value: property.cleaning_fee ? `$${property.cleaning_fee.toLocaleString()}` : null },
    { label: "Pet Policy", value: property.pet_policy },
    { label: "Pet Details", value: property.pet_policy_details },
    { label: "Description", value: property.property_description },
    { label: "Amenities", value: amenitiesList.length > 0 ? amenitiesList.join(", ") : null },
    { label: "Services Included", value: property.services_included?.join(", ") },
    { label: "Utilities Included", value: property.utilities_included?.join(", ") },
    { label: "Appliances Included", value: property.appliances_included?.join(", ") },
    { label: "Owner Name", value: property.contact_name },
    { label: "Owner Email", value: property.contact_email },
    { label: "Owner Phone", value: property.contact_phone },
    { label: "Existing Listing URL", value: property.existing_listing_url },
    { label: "Virtual Tour URL", value: property.virtual_tour_url },
  ].filter(item => item.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold">
            Listing Data
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <MapPin className="w-4 h-4" />
            {property.property_title || property.address || [property.city, property.state].filter(Boolean).join(", ") || "No address"}
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6 pt-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Click any field to copy its value to clipboard for listing platforms.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allText = listingDataItems.map(item => `${item.label}: ${item.value}`).join("\n");
                  navigator.clipboard.writeText(allText);
                  toast.success("All listing data copied!");
                }}
              >
                <Copy className="w-3 h-3 mr-1.5" />
                Copy All
              </Button>
            </div>

            <div className="grid gap-2">
              {listingDataItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                  onClick={() => copyToClipboard(item.value!, item.label)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {item.label}
                    </p>
                    <p className="text-sm font-medium truncate pr-4">
                      {item.value}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {copiedField === item.label ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Featured Image for reference */}
            {property.featured_image_url && (
              <div className="pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Featured Image
                </p>
                <img 
                  src={property.featured_image_url} 
                  alt={property.property_title || "Property"} 
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => copyToClipboard(property.featured_image_url!, "Image URL")}
                >
                  <Copy className="w-3 h-3 mr-1.5" />
                  Copy Image URL
                </Button>
              </div>
            )}

            {/* Gallery Images */}
            {property.gallery_images && property.gallery_images.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Gallery Images ({property.gallery_images.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {property.gallery_images.slice(0, 6).map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={img} 
                        alt={`Gallery ${idx + 1}`} 
                        className="w-full h-24 object-cover rounded-md"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-xs"
                        onClick={() => copyToClipboard(img, `Gallery Image ${idx + 1}`)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy URL
                      </Button>
                    </div>
                  ))}
                </div>
                {property.gallery_images.length > 6 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{property.gallery_images.length - 6} more images
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
