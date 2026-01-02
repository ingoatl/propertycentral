import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Phone, Mail, Star, Clock, Wrench, Shield, AlertTriangle, Loader2, ScanSearch, FileSignature } from "lucide-react";
import { Vendor, VENDOR_SPECIALTIES } from "@/types/maintenance";
import AddVendorDialog from "@/components/maintenance/AddVendorDialog";
import VendorDetailModal from "@/components/maintenance/VendorDetailModal";
import ServiceSignupDialog from "@/components/maintenance/ServiceSignupDialog";

const Vendors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showServiceSignupDialog, setShowServiceSignupDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const queryClient = useQueryClient();

  const extractVendorsFromEmails = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-vendors-from-emails');
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["vendors"] });
      } else {
        toast.error(data.error || 'Failed to extract vendors');
      }
    } catch (error: any) {
      console.error('Error extracting vendors:', error);
      toast.error(error.message || 'Failed to extract vendors from emails');
    } finally {
      setIsExtracting(false);
    }
  };

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*, billcom_vendor_id, billcom_synced_at, billcom_invite_sent_at")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch = 
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.phone.includes(searchQuery);
    
    const matchesSpecialty = !selectedSpecialty || vendor.specialty.includes(selectedSpecialty);
    
    return matchesSearch && matchesSpecialty;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preferred': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpecialtyLabel = (specialty: string) => {
    return specialty.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vendor Management</h1>
            <p className="text-muted-foreground mt-1">Manage your network of trusted vendors</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={extractVendorsFromEmails} 
              disabled={isExtracting}
              className="gap-2"
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              {isExtracting ? 'Scanning...' : 'Extract from Emails'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowServiceSignupDialog(true)} 
              className="gap-2"
            >
              <FileSignature className="h-4 w-4" />
              Sign Up for Service
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{vendors.length}</div>
              <p className="text-sm text-muted-foreground">Total Vendors</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {vendors.filter(v => v.status === 'preferred').length}
              </div>
              <p className="text-sm text-muted-foreground">Preferred</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">
                {vendors.filter(v => v.emergency_available).length}
              </div>
              <p className="text-sm text-muted-foreground">Emergency Available</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">
                {vendors.filter(v => v.insurance_expiration && new Date(v.insurance_expiration) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length}
              </div>
              <p className="text-sm text-muted-foreground">Insurance Expiring</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedSpecialty === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSpecialty(null)}
            >
              All
            </Button>
            {VENDOR_SPECIALTIES.slice(0, 6).map((specialty) => (
              <Button
                key={specialty}
                variant={selectedSpecialty === specialty ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSpecialty(specialty)}
              >
                {getSpecialtyLabel(specialty)}
              </Button>
            ))}
          </div>
        </div>

        {/* Vendor Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 h-48" />
              </Card>
            ))}
          </div>
        ) : filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No vendors found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery || selectedSpecialty 
                  ? "Try adjusting your filters"
                  : "Add your first vendor to get started"}
              </p>
              {!searchQuery && !selectedSpecialty && (
                <Button onClick={() => setShowAddDialog(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vendor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => (
              <Card 
                key={vendor.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedVendor(vendor)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{vendor.name}</CardTitle>
                      {vendor.company_name && (
                        <p className="text-sm text-muted-foreground">{vendor.company_name}</p>
                      )}
                    </div>
                    <Badge className={getStatusColor(vendor.status)}>
                      {vendor.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Contact Info */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {vendor.phone}
                    </div>
                    {vendor.email && (
                      <div className="flex items-center gap-1 text-muted-foreground truncate">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{vendor.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1">
                    {vendor.specialty.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {getSpecialtyLabel(s)}
                      </Badge>
                    ))}
                    {vendor.specialty.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{vendor.specialty.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm pt-2 border-t">
                    {vendor.average_rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        <span>{vendor.average_rating.toFixed(1)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5" />
                      {vendor.total_jobs_completed} jobs
                    </div>
                    {vendor.average_response_time_hours && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {vendor.average_response_time_hours}h avg
                      </div>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex gap-2">
                    {vendor.emergency_available && (
                      <Badge variant="outline" className="text-xs border-red-200 text-red-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        24/7
                      </Badge>
                    )}
                    {vendor.insurance_verified && (
                      <Badge variant="outline" className="text-xs border-green-200 text-green-600">
                        <Shield className="h-3 w-3 mr-1" />
                        Insured
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddVendorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["vendors"] });
          toast.success("Vendor added successfully");
        }}
      />

      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          open={!!selectedVendor}
          onOpenChange={(open) => !open && setSelectedVendor(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
          }}
        />
      )}

      <ServiceSignupDialog
        open={showServiceSignupDialog}
        onOpenChange={setShowServiceSignupDialog}
      />
    </>
  );
};

export default Vendors;
