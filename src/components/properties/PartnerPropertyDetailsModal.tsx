import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bed, Bath, Square, Users, Car, Building, DollarSign, 
  Mail, Phone, User, PawPrint, ExternalLink, MapPin,
  Wifi, Tv, Wind, Droplets, Flame, Zap, FileText, Database, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface PartnerPropertyDetailsModalProps {
  property: PartnerProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showListingData?: boolean;
}

export function PartnerPropertyDetailsModal({ 
  property, 
  open, 
  onOpenChange,
  showListingData = false
}: PartnerPropertyDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  if (!property) return null;

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    { label: "Contact Name", value: property.contact_name },
    { label: "Contact Email", value: property.contact_email },
    { label: "Contact Phone", value: property.contact_phone },
    { label: "Existing Listing URL", value: property.existing_listing_url },
    { label: "Virtual Tour URL", value: property.virtual_tour_url },
  ].filter(item => item.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-semibold">
            {property.property_title || "Partner Property Details"}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <MapPin className="w-4 h-4" />
            {property.address || [property.city, property.state, property.zip_code].filter(Boolean).join(", ") || "No address"}
          </div>
        </DialogHeader>
        
        <Tabs defaultValue={showListingData ? "listing-data" : "details"} className="w-full">
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="gap-2">
                <FileText className="w-4 h-4" />
                Property Details
              </TabsTrigger>
              <TabsTrigger value="listing-data" className="gap-2">
                <Database className="w-4 h-4" />
                Listing Data
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="mt-0">
            <ScrollArea className="max-h-[calc(90vh-180px)]">
              <div className="p-6 pt-4 space-y-6">
            {/* Featured Image & Gallery */}
            {property.featured_image_url && (
              <div className="space-y-3">
                <img 
                  src={property.featured_image_url} 
                  alt={property.property_title || "Property"} 
                  className="w-full h-64 object-cover rounded-lg"
                />
                {property.gallery_images && property.gallery_images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {property.gallery_images.slice(0, 4).map((img, idx) => (
                      <img 
                        key={idx}
                        src={img} 
                        alt={`Gallery ${idx + 1}`} 
                        className="w-full h-20 object-cover rounded-md"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Property Specifications */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Property Specifications
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Bed className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Bedrooms</p>
                    <p className="font-medium">{property.bedrooms || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Bath className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Bathrooms</p>
                    <p className="font-medium">{property.bathrooms || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Square className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sq Ft</p>
                    <p className="font-medium">{property.square_footage?.toLocaleString() || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Max Guests</p>
                    <p className="font-medium">{property.max_guests || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Building className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium">{property.property_type || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Building className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Stories</p>
                    <p className="font-medium">{property.stories || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Car className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Parking</p>
                    <p className="font-medium">
                      {property.parking_spaces ? `${property.parking_spaces} ${property.parking_type || 'spaces'}` : "N/A"}
                    </p>
                  </div>
                </div>
                {property.year_built && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Building className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Year Built</p>
                      <p className="font-medium">{property.year_built}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Pricing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(property.monthly_price)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Security Deposit</p>
                  </div>
                  <p className="text-xl font-semibold">{formatCurrency(property.security_deposit)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Cleaning Fee</p>
                  </div>
                  <p className="text-xl font-semibold">{formatCurrency(property.cleaning_fee)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            {property.property_description && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Description
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {property.property_description}
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Amenities */}
            {amenitiesList.length > 0 && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Amenities
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {amenitiesList.map((amenity: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Appliances */}
            {property.appliances_included && property.appliances_included.length > 0 && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Appliances Included
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {property.appliances_included.map((item: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Services & Utilities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {property.services_included && property.services_included.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Services Included
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {property.services_included.map((service: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {property.utilities_included && property.utilities_included.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Utilities Included
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {property.utilities_included.map((utility: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs bg-green-100 text-green-800">
                        {utility}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(property.services_included?.length || property.utilities_included?.length) && <Separator />}

            {/* Pet Policy */}
            {(property.pet_policy || property.pet_policy_details) && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                    <PawPrint className="w-4 h-4" />
                    Pet Policy
                  </h3>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="font-medium">{property.pet_policy || "Not specified"}</p>
                    {property.pet_policy_details && (
                      <p className="text-sm text-muted-foreground mt-1">{property.pet_policy_details}</p>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Contact Information */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {property.contact_name && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <User className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Contact</p>
                      <p className="font-medium text-sm">{property.contact_name}</p>
                    </div>
                  </div>
                )}
                {property.contact_email && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Mail className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium text-sm">{property.contact_email}</p>
                    </div>
                  </div>
                )}
                {property.contact_phone && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Phone className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium text-sm">{property.contact_phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* External Links */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                External Links
              </h3>
              <div className="flex flex-wrap gap-3">
                {property.existing_listing_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={property.existing_listing_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Existing Listing
                    </a>
                  </Button>
                )}
                {property.virtual_tour_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={property.virtual_tour_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Virtual Tour
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Sync Info */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Last synced: {formatDate(property.synced_at)} • Status: <Badge variant="secondary" className="text-xs ml-1">{property.status || "active"}</Badge>
              </p>
            </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="listing-data" className="mt-0">
            <ScrollArea className="max-h-[calc(90vh-180px)]">
              <div className="p-6 pt-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
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
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}