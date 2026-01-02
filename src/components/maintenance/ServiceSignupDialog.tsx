import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, Eye, Building2, Truck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface ServiceSignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PropertyData {
  id: string;
  name: string;
  address: string;
  trash_pickup_day?: string;
  trash_bin_location?: string;
  gate_code?: string;
  access_instructions?: string;
}

interface VendorData {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  specialty: string[];
}

const ServiceSignupDialog = ({ open, onOpenChange }: ServiceSignupDialogProps) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserEmail(user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", user.id)
          .single();
        if (profile) {
          setCurrentUserName(profile.first_name || "");
        }
      }
    };
    if (open) {
      fetchUser();
    }
  }, [open]);

  // Fetch properties with trash info
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-for-service-signup"],
    queryFn: async () => {
      // First get all active properties
      const { data: props, error: propsError } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("offboarded_at", null)
        .order("name");

      if (propsError) throw propsError;

      // Get onboarding data for trash info
      const { data: onboardingData } = await supabase
        .from("owner_onboarding_submissions")
        .select("property_id, trash_pickup_day, trash_bin_location, gate_code");

      // Get maintenance book data for additional access info
      const { data: maintenanceData } = await supabase
        .from("property_maintenance_book")
        .select("property_id, gate_code, access_instructions, lockbox_code");

      // Merge data
      return props?.map((prop) => {
        const onboarding = onboardingData?.find((o) => o.property_id === prop.id);
        const maintenance = maintenanceData?.find((m) => m.property_id === prop.id);
        return {
          ...prop,
          trash_pickup_day: onboarding?.trash_pickup_day,
          trash_bin_location: onboarding?.trash_bin_location,
          gate_code: onboarding?.gate_code || maintenance?.gate_code,
          access_instructions: maintenance?.access_instructions,
        } as PropertyData;
      }) || [];
    },
    enabled: open,
  });

  // Fetch vendors with email
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-service-signup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, email, specialty")
        .eq("status", "active")
        .not("email", "is", null)
        .order("name");

      if (error) throw error;
      return data as VendorData[];
    },
    enabled: open,
  });

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  );

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId),
    [vendors, selectedVendorId]
  );

  const isTrashService = useMemo(
    () => selectedVendor?.specialty?.includes("trash_services"),
    [selectedVendor]
  );

  // Generate email when property and vendor are selected
  useEffect(() => {
    if (selectedProperty && selectedVendor) {
      generateEmail();
    }
  }, [selectedProperty, selectedVendor]);

  const generateEmail = () => {
    if (!selectedProperty || !selectedVendor) return;

    const vendorName = selectedVendor.company_name || selectedVendor.name;
    const serviceType = isTrashService ? "Garbage Can Roll-Off" : "Property Services";
    
    setEmailSubject(`Service Signup Request - ${selectedProperty.address}`);

    let body = `Dear ${vendorName} Team,

We would like to sign up for your ${serviceType} services for one of our managed properties.

PROPERTY DETAILS
─────────────────────────
Address: ${selectedProperty.address}
Property Name: ${selectedProperty.name}
Property Manager: PeachHaus Group LLC`;

    if (isTrashService) {
      body += `

SERVICE INFORMATION
─────────────────────────`;
      if (selectedProperty.trash_pickup_day) {
        body += `
Trash Pickup Day: ${selectedProperty.trash_pickup_day}`;
      }
      if (selectedProperty.trash_bin_location) {
        body += `
Bin Location: ${selectedProperty.trash_bin_location}`;
      }
      body += `
Note: Bins should be placed out the evening before pickup and retrieved after pickup.`;
    }

    body += `

ACCESS INSTRUCTIONS
─────────────────────────`;
    if (selectedProperty.gate_code) {
      body += `
Gate Code: ${selectedProperty.gate_code}`;
    }
    if (selectedProperty.access_instructions) {
      body += `
${selectedProperty.access_instructions}`;
    }
    if (!selectedProperty.gate_code && !selectedProperty.access_instructions) {
      body += `
No special access instructions required.`;
    }

    body += `

Please confirm availability and provide pricing information at your earliest convenience.

Thank you for your service.

Best regards,`;

    setEmailBody(body);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVendor?.email) {
        throw new Error("Vendor email is required");
      }

      const { data, error } = await supabase.functions.invoke("send-vendor-service-email", {
        body: {
          to: selectedVendor.email,
          toName: selectedVendor.company_name || selectedVendor.name,
          subject: emailSubject,
          body: emailBody,
          propertyId: selectedPropertyId,
          vendorId: selectedVendorId,
          senderEmail: currentUserEmail,
          senderName: currentUserName,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Service signup email sent successfully!");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedPropertyId("");
    setSelectedVendorId("");
    setEmailSubject("");
    setEmailBody("");
    setShowPreview(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const getSpecialtyLabel = (specialty: string) => {
    return specialty.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Sign Up for New Service
          </DialogTitle>
          <DialogDescription>
            Select a property and vendor to generate a professional service signup email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid gap-6 py-4">
            {/* Property and Vendor Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property">Select Property</Label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger id="property">
                    <SelectValue placeholder="Choose a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{property.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor">Select Vendor</Label>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger id="vendor">
                    <SelectValue placeholder="Choose a vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        <div className="flex flex-col">
                          <span>{vendor.company_name || vendor.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {vendor.specialty.map(getSpecialtyLabel).join(", ")}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Property Info Summary */}
            {selectedProperty && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="font-medium mb-2">Property Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Address:</span>{" "}
                    <span className="font-medium">{selectedProperty.address}</span>
                  </div>
                  {selectedProperty.trash_pickup_day && (
                    <div>
                      <span className="text-muted-foreground">Trash Day:</span>{" "}
                      <span className="font-medium">{selectedProperty.trash_pickup_day}</span>
                    </div>
                  )}
                  {selectedProperty.gate_code && (
                    <div>
                      <span className="text-muted-foreground">Gate Code:</span>{" "}
                      <span className="font-medium">{selectedProperty.gate_code}</span>
                    </div>
                  )}
                  {selectedProperty.trash_bin_location && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Bin Location:</span>{" "}
                      <span className="font-medium">{selectedProperty.trash_bin_location}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Email Preview/Edit */}
            {selectedProperty && selectedVendor && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Email Content</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {showPreview ? "Edit" : "Preview"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs text-muted-foreground">
                    To: {selectedVendor.email}
                  </Label>
                  <input
                    id="subject"
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm font-medium"
                    placeholder="Subject"
                  />
                </div>

                {showPreview ? (
                  <ScrollArea className="h-[300px] rounded-lg border bg-white p-6">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {emailBody}
                      </pre>
                      <div className="mt-6 pt-4 border-t-2 border-amber-500">
                        <p className="font-bold text-base mb-0">
                          {currentUserName.toUpperCase() || currentUserEmail.split("@")[0].toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground mb-1">
                          {currentUserEmail.includes("anja") ? "CO-FOUNDER, GA REAL ESTATE BROKER" : "CO-FOUNDER, OPERATIONS"}
                        </p>
                        <p className="font-semibold text-amber-600 mb-2">PEACHHAUS GROUP LLC</p>
                        <p className="text-xs text-muted-foreground">
                          <strong>website</strong>{" "}
                          <a href="https://www.peachhausgroup.com" className="text-amber-600">
                            www.peachhausgroup.com
                          </a>
                          <br />
                          <strong>phone</strong> (404) 800-5932
                          <br />
                          <strong>email</strong>{" "}
                          <a href={`mailto:${currentUserEmail}`} className="text-amber-600">
                            {currentUserEmail}
                          </a>
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Email body..."
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendEmailMutation.mutate()}
            disabled={!selectedPropertyId || !selectedVendorId || !emailBody || sendEmailMutation.isPending}
            className="gap-2"
          >
            {sendEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceSignupDialog;
