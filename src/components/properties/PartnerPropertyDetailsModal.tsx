import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bed, Bath, Square, Users, Car, Building, DollarSign, 
  Mail, Phone, User, PawPrint, ExternalLink, MapPin, Download, Image as ImageIcon, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

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
}

export function PartnerPropertyDetailsModal({ 
  property, 
  open, 
  onOpenChange
}: PartnerPropertyDetailsModalProps) {
  const [downloading, setDownloading] = useState(false);
  
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

  // Get all images (featured + gallery)
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
      // Download each image
      for (let i = 0; i < allImages.length; i++) {
        const imageUrl = allImages[i];
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Extract filename from URL or generate one
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
        
        // Small delay between downloads
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                {property.property_title || "Partner Property Details"}
              </DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                {property.address || [property.city, property.state, property.zip_code].filter(Boolean).join(", ") || "No address"}
              </div>
            </div>
            <Badge className="bg-orange-500 text-white">Partner Property</Badge>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6 pt-0 space-y-6">
            {/* Featured Image & Gallery with Download Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Property Images ({allImages.length})
                </h3>
                {allImages.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={downloadAllImages}
                    disabled={downloading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloading ? "Downloading..." : `Download All (${allImages.length})`}
                  </Button>
                )}
              </div>
              
              {property.featured_image_url ? (
                <img 
                  src={property.featured_image_url} 
                  alt={property.property_title || "Property"} 
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
              
              {property.gallery_images && property.gallery_images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {property.gallery_images.map((img, idx) => (
                    <img 
                      key={idx}
                      src={img} 
                      alt={`Gallery ${idx + 1}`} 
                      className="w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(img, '_blank')}
                    />
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Owner Information - Prominent Section */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Owner Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Owner Name</p>
                    <p className="font-semibold">{property.contact_name || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-semibold text-sm">{property.contact_email || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-semibold">{property.contact_phone || "Not provided"}</p>
                  </div>
                </div>
              </div>
            </div>

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
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Year Built</p>
                    <p className="font-medium">{property.year_built || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pricing with Zillow Note */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Pricing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-muted-foreground">Monthly Rent (MidTermNation)</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(property.monthly_price)}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Calculate listing price: Zillow Zestimate × 2.3
                  </p>
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
                      <Badge key={idx} variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
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
                      <Badge key={idx} variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
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
                {!property.existing_listing_url && !property.virtual_tour_url && (
                  <p className="text-sm text-muted-foreground">No external links available</p>
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
      </DialogContent>
    </Dialog>
  );
}
