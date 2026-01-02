import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  Bed, Bath, Square, Users, Car, Building, DollarSign, 
  Mail, Phone, User, PawPrint, ExternalLink, MapPin, Download, Image as ImageIcon, Calendar, Pencil, Check, X,
  AlertCircle, Info, RefreshCw, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZillowPricingInstructionsModal } from "./ZillowPricingInstructionsModal";

const PRICING_MULTIPLIER = 2.2;

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
  zillow_rent_zestimate: number | null;
  calculated_listing_price: number | null;
  zillow_last_fetched: string | null;
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
  onPropertyUpdated?: () => void;
}

export function PartnerPropertyDetailsModal({ 
  property, 
  open, 
  onOpenChange,
  onPropertyUpdated
}: PartnerPropertyDetailsModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingZestimate, setEditingZestimate] = useState(false);
  const [zestimateValue, setZestimateValue] = useState("");
  const [savingZestimate, setSavingZestimate] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  
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

  const handleEditAddress = () => {
    setEditedAddress(property.address || "");
    setEditingAddress(true);
  };

  const handleSaveAddress = async () => {
    if (!editedAddress.trim()) {
      toast.error("Address cannot be empty");
      return;
    }

    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from("partner_properties")
        .update({ address: editedAddress.trim() })
        .eq("id", property.id);

      if (error) throw error;

      toast.success("Address updated successfully");
      setEditingAddress(false);
      onPropertyUpdated?.();
    } catch (error: any) {
      console.error("Error updating address:", error);
      toast.error(error.message || "Failed to update address");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingAddress(false);
    setEditedAddress("");
  };

  const handleEditZestimate = () => {
    setZestimateValue(property.zillow_rent_zestimate?.toString() || "");
    setEditingZestimate(true);
  };

  const handleSaveZestimate = async () => {
    const value = parseFloat(zestimateValue);
    if (isNaN(value) || value <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }

    setSavingZestimate(true);
    try {
      const calculatedPrice = Math.round(value * PRICING_MULTIPLIER);
      const { error } = await supabase
        .from("partner_properties")
        .update({ 
          zillow_rent_zestimate: value,
          calculated_listing_price: calculatedPrice,
          zillow_last_fetched: new Date().toISOString()
        })
        .eq("id", property.id);

      if (error) throw error;

      toast.success(`Rent Zestimate saved! Listing price: $${calculatedPrice.toLocaleString()} (${PRICING_MULTIPLIER}x)`);
      setEditingZestimate(false);
      onPropertyUpdated?.();
    } catch (error: any) {
      console.error("Error saving Zestimate:", error);
      toast.error(error.message || "Failed to save Zestimate");
    } finally {
      setSavingZestimate(false);
    }
  };

  const handleCancelZestimate = () => {
    setEditingZestimate(false);
    setZestimateValue("");
  };

  const openZillowPage = () => {
    if (!property.address) {
      toast.error("Address is required to look up Zillow");
      return;
    }
    const formattedAddress = property.address
      .trim()
      .toLowerCase()
      .replace(/,/g, "")
      .replace(/\./g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    window.open(`https://www.zillow.com/homes/${formattedAddress}_rb/`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                {property.property_title || "Partner Property Details"}
              </DialogTitle>
              {editingAddress ? (
                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={editedAddress}
                    onChange={(e) => setEditedAddress(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    placeholder="Enter address..."
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                    className="h-8 px-2"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={savingAddress}
                    className="h-8 px-2"
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 group">
                  <MapPin className="w-4 h-4" />
                  <span>{property.address || [property.city, property.state, property.zip_code].filter(Boolean).join(", ") || "No address"}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditAddress}
                    className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <Badge className="bg-orange-500 text-white flex-shrink-0">Partner Property</Badge>
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

            {/* Team Instructions Box */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300">Team Instructions</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowInstructionsModal(true)}
                      className="h-7 px-2 text-blue-600"
                    >
                      <HelpCircle className="w-4 h-4 mr-1" />
                      Full Guide
                    </Button>
                  </div>
                  <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-decimal list-inside">
                    <li><strong>Find Rent Zestimate:</strong> Go to Zillow or <strong>ask AI</strong> to find the Rent Zestimate</li>
                    <li><strong>Calculate:</strong> Listing Price = Rent Zestimate × <strong>{PRICING_MULTIPLIER}</strong></li>
                    <li><strong>Enter Value:</strong> Click "Enter Value" in the Zillow Rent Zestimate box below</li>
                    <li><strong>Never use owner's suggested rent</strong> - always use the formula above</li>
                  </ol>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800"
                      onClick={openZillowPage}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Zillow
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800"
                      onClick={() => setShowInstructionsModal(true)}
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      View Instructions
                    </Button>
                  </div>
                </div>
              </div>
            </div>

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

            {/* Pricing with Zillow Integration */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Pricing
              </h3>
              
              {/* Main listing price - uses calculated_listing_price if available */}
              <div className="p-4 border-2 border-green-500 rounded-lg mb-4 bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <p className="font-semibold text-green-800 dark:text-green-300">MidTermNation Listing Price</p>
                  </div>
                  {property.zillow_last_fetched && (
                    <span className="text-xs text-muted-foreground">
                      Updated: {formatDate(property.zillow_last_fetched)}
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {property.calculated_listing_price 
                    ? formatCurrency(property.calculated_listing_price)
                    : <span className="text-amber-600">⚠️ Needs Zillow Verification</span>
                  }
                </p>
                {property.zillow_rent_zestimate && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Based on Zillow Rent Zestimate: {formatCurrency(property.zillow_rent_zestimate)} × {PRICING_MULTIPLIER}
                  </p>
                )}
              </div>

              {/* Zillow Rent Zestimate Input */}
              <div className="p-4 border border-amber-300 dark:border-amber-700 rounded-lg mb-4 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Zillow Rent Zestimate</p>
                  </div>
                  {!editingZestimate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEditZestimate}
                      className="h-7 px-2"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      {property.zillow_rent_zestimate ? "Update" : "Enter Value"}
                    </Button>
                  )}
                </div>
                
                {editingZestimate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">$</span>
                    <Input
                      type="number"
                      value={zestimateValue}
                      onChange={(e) => setZestimateValue(e.target.value)}
                      className="flex-1 h-10"
                      placeholder="Enter Zillow Rent Zestimate..."
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveZestimate}
                      disabled={savingZestimate}
                      className="h-10"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelZestimate}
                      disabled={savingZestimate}
                      className="h-10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl font-semibold">
                      {property.zillow_rent_zestimate 
                        ? formatCurrency(property.zillow_rent_zestimate)
                        : <span className="text-muted-foreground">Not entered yet</span>
                      }
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Go to Zillow → Search this address → Find "Rent Zestimate" → Enter value above
                    </p>
                  </div>
                )}
              </div>

              {/* Owner's Suggested Price (for reference) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Owner's Suggested Rent</p>
                  </div>
                  <p className="text-xl font-semibold text-muted-foreground">{formatCurrency(property.monthly_price)}</p>
                  <p className="text-xs text-amber-600 mt-1">⚠️ Do not use - for reference only</p>
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

      {/* Zillow Pricing Instructions Modal */}
      <ZillowPricingInstructionsModal
        open={showInstructionsModal}
        onOpenChange={setShowInstructionsModal}
        address={property.address || undefined}
      />
    </Dialog>
  );
}
