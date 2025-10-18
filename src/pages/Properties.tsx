import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, MapPin, Building2, Edit, Mail, ClipboardList, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnboardingTab } from "@/components/onboarding/OnboardingTab";
import { PropertyDetailsModal } from "@/components/onboarding/PropertyDetailsModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Property } from "@/types";
import { toast } from "sonner";
import { z } from "zod";
import { PropertyEmailInsights } from "@/components/PropertyEmailInsights";

const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  address: z.string().trim().min(1, "Address is required").max(500, "Address must be less than 500 characters"),
  visitPrice: z.number().positive("Visit price must be positive").max(10000, "Visit price cannot exceed $10,000"),
  rentalType: z.enum(["hybrid", "mid_term", "long_term"], { required_error: "Please select a rental type" }),
});

const Properties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [emailInsightsDialogOpen, setEmailInsightsDialogOpen] = useState(false);
  const [selectedPropertyForInsights, setSelectedPropertyForInsights] = useState<Property | null>(null);
  const [selectedPropertyForDetails, setSelectedPropertyForDetails] = useState<{ id: string; name: string; projectId: string } | null>(null);
  const [propertyProjects, setPropertyProjects] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    visitPrice: "",
    rentalType: "" as "hybrid" | "mid_term" | "long_term" | "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    address: "",
    visitPrice: "",
    rentalType: "" as "hybrid" | "mid_term" | "long_term" | "",
  });

  useEffect(() => {
    loadProperties();
    loadPropertyProjects();
  }, []);

  const loadProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProperties((data || []).map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        visitPrice: Number(p.visit_price),
        rentalType: p.rental_type as "hybrid" | "mid_term" | "long_term" | undefined,
        createdAt: p.created_at,
      })));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading properties:", error);
      }
      toast.error("Failed to load properties");
    }
  };

  const loadPropertyProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("onboarding_projects")
        .select("id, property_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const projectMap: Record<string, string> = {};
      data?.forEach(project => {
        if (project.property_id && !projectMap[project.property_id]) {
          projectMap[project.property_id] = project.id;
        }
      });
      
      setPropertyProjects(projectMap);
    } catch (error: any) {
      console.error("Error loading projects:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const visitPrice = parseFloat(formData.visitPrice);
    
    // Validate with zod
    const validation = propertySchema.safeParse({
      name: formData.name,
      address: formData.address,
      visitPrice,
      rentalType: formData.rentalType,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("properties")
        .insert({
          name: formData.name.trim(),
          address: formData.address.trim(),
          visit_price: visitPrice,
          rental_type: formData.rentalType,
          user_id: user.id,
        });

      if (error) throw error;

      setFormData({ name: "", address: "", visitPrice: "", rentalType: "" });
      setShowForm(false);
      await loadProperties();
      toast.success("Property added successfully!");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error adding property:", error);
      }
      toast.error(error.message || "Failed to add property");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property? All associated visits and expenses will be deleted.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadProperties();
      toast.success("Property deleted");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error deleting property:", error);
      }
      toast.error("Failed to delete property");
    }
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setEditFormData({
      name: property.name,
      address: property.address,
      visitPrice: property.visitPrice.toString(),
      rentalType: property.rentalType || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    const visitPrice = parseFloat(editFormData.visitPrice);
    
    const validation = propertySchema.safeParse({
      name: editFormData.name,
      address: editFormData.address,
      visitPrice,
      rentalType: editFormData.rentalType,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("properties")
        .update({
          name: editFormData.name.trim(),
          address: editFormData.address.trim(),
          visit_price: visitPrice,
          rental_type: editFormData.rentalType,
        })
        .eq("id", editingProperty.id);

      if (error) throw error;

      setEditDialogOpen(false);
      setEditingProperty(null);
      await loadProperties();
      toast.success("Property updated successfully!");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error updating property:", error);
      }
      toast.error(error.message || "Failed to update property");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Properties</h1>
          <p className="text-muted-foreground mt-1">Manage your property portfolio</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 shadow-warm hover:scale-105 transition-transform">
          <Plus className="w-4 h-4" />
          Add Property
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-card border-border/50 animate-scale-in">
          <CardHeader className="bg-gradient-subtle rounded-t-lg">
            <CardTitle className="text-foreground">Add New Property</CardTitle>
            <CardDescription className="text-muted-foreground">Enter property details below</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Villa Ct SE - Unit 14"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-base"
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Peach St, Atlanta, GA"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="text-base"
                  maxLength={500}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitPrice">Visit Price ($)</Label>
                <Input
                  id="visitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10000"
                  placeholder="150.00"
                  value={formData.visitPrice}
                  onChange={(e) => setFormData({ ...formData, visitPrice: e.target.value })}
                  className="text-base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rentalType">Rental Type</Label>
              <Select
                value={formData.rentalType}
                onValueChange={(value: "hybrid" | "mid_term" | "long_term") =>
                  setFormData({ ...formData, rentalType: value })
                }
                >
                  <SelectTrigger id="rentalType">
                    <SelectValue placeholder="Select rental type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid">Hybrid Rental (Short + Mid-term)</SelectItem>
                    <SelectItem value="mid_term">Mid-term Rental</SelectItem>
                    <SelectItem value="long_term">Long-term Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="shadow-warm">
                  {loading ? "Adding..." : "Add Property"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Email Insights Dialog */}
      <Dialog open={emailInsightsDialogOpen} onOpenChange={setEmailInsightsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Insights - {selectedPropertyForInsights?.name}</DialogTitle>
            <DialogDescription>
              AI-generated insights from emails related to this property
            </DialogDescription>
          </DialogHeader>
          {selectedPropertyForInsights && (
            <PropertyEmailInsights propertyId={selectedPropertyForInsights.id} />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Property Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>Update property details below</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProperty} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Property Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Villa Ct SE - Unit 14"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="text-base"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                placeholder="123 Peach St, Atlanta, GA"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                className="text-base"
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-visitPrice">Visit Price ($)</Label>
              <Input
                id="edit-visitPrice"
                type="number"
                step="0.01"
                min="0"
                max="10000"
                placeholder="150.00"
                value={editFormData.visitPrice}
                onChange={(e) => setEditFormData({ ...editFormData, visitPrice: e.target.value })}
                className="text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-rentalType">Rental Type</Label>
              <Select
                value={editFormData.rentalType}
                onValueChange={(value: "hybrid" | "mid_term" | "long_term") =>
                  setEditFormData({ ...editFormData, rentalType: value })
                }
              >
                <SelectTrigger id="edit-rentalType">
                  <SelectValue placeholder="Select rental type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid Rental (Short + Mid-term)</SelectItem>
                  <SelectItem value="mid_term">Mid-term Rental</SelectItem>
                  <SelectItem value="long_term">Long-term Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="shadow-warm">
                {loading ? "Updating..." : "Update Property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {properties.length === 0 ? (
          <Card className="col-span-full shadow-card border-border/50">
            <CardContent className="pt-12 pb-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No properties yet. Add your first property to get started!</p>
            </CardContent>
          </Card>
        ) : (
          properties.map((property, index) => (
            <div key={property.id} className="space-y-4">
              <Card 
                className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 hover:scale-105 group"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-foreground group-hover:text-primary transition-colors">
                        {property.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        {property.address}
                      </CardDescription>
                      {property.rentalType && (
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            property.rentalType === 'hybrid' ? 'bg-blue-100 text-blue-800' :
                            property.rentalType === 'mid_term' ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {property.rentalType === 'hybrid' ? '🔄 Hybrid' :
                             property.rentalType === 'mid_term' ? '🏠 Mid-term' :
                             '🏡 Long-term'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(property)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(property.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (propertyProjects[property.id]) {
                          setSelectedPropertyForDetails({
                            id: property.id,
                            name: property.name,
                            projectId: propertyProjects[property.id]
                          });
                        }
                      }}
                      className="flex-1"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Property Details
                    </Button>
                  </div>

                  <Tabs 
                    defaultValue="onboarding" 
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-1">
                      <TabsTrigger value="onboarding">
                        <ClipboardList className="w-4 h-4 mr-1" />
                        Onboarding
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="onboarding" className="mt-4">
                      <OnboardingTab
                        propertyId={property.id}
                        propertyName={property.name}
                        propertyAddress={property.address}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

        {selectedPropertyForDetails && (
          <PropertyDetailsModal
            open={!!selectedPropertyForDetails}
            onOpenChange={(open) => !open && setSelectedPropertyForDetails(null)}
            projectId={selectedPropertyForDetails.projectId}
            propertyName={selectedPropertyForDetails.name}
            propertyId={selectedPropertyForDetails.id}
          />
        )}
    </div>
  );
};

export default Properties;
