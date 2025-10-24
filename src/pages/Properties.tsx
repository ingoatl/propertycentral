import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, MapPin, Building2, Edit, ClipboardList, FileText, Upload, Image as ImageIcon, Search, Database } from "lucide-react";
import villa14Image from "@/assets/villa14.jpg";
import { WorkflowDialog } from "@/components/onboarding/WorkflowDialog";
import { PropertyDetailsModal } from "@/components/onboarding/PropertyDetailsModal";
import { PropertyListingDataModal } from "@/components/onboarding/PropertyListingDataModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Property } from "@/types";
import { toast } from "sonner";
import { z } from "zod";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Badge } from "@/components/ui/badge";
import { BulkUpdateListingURLs } from "@/components/onboarding/BulkUpdateListingURLs";

const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  address: z.string().trim().min(1, "Address is required").max(500, "Address must be less than 500 characters"),
  visitPrice: z.number().positive("Visit price must be positive").max(10000, "Visit price cannot exceed $10,000"),
  rentalType: z.enum(["hybrid", "mid_term", "long_term"], { required_error: "Please select a rental type" }),
});

const Properties = () => {
  const { isAdmin } = useAdminCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPropertyForDetails, setSelectedPropertyForDetails] = useState<{ id: string; name: string; projectId: string | null } | null>(null);
  const [selectedPropertyForWorkflow, setSelectedPropertyForWorkflow] = useState<{ id: string; name: string; address: string; projectId: string | null; visitPrice: number; taskId?: string } | null>(null);
  const [selectedPropertyForListingData, setSelectedPropertyForListingData] = useState<{ id: string; name: string } | null>(null);
  const [propertyProjects, setPropertyProjects] = useState<Record<string, string>>({});
  const [propertyProjectsProgress, setPropertyProjectsProgress] = useState<Record<string, number>>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<"All" | "Client-Managed" | "Company-Owned" | "Inactive">("All");
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

  useEffect(() => {
    const openWorkflowId = searchParams.get('openWorkflow');
    const taskId = searchParams.get('taskId');
    
    if (openWorkflowId && properties.length > 0) {
      const projectId = openWorkflowId;
      const propertyId = Object.entries(propertyProjects).find(
        ([_, pId]) => pId === projectId
      )?.[0];

      if (propertyId) {
        const property = properties.find(p => p.id === propertyId);
        if (property) {
          setSelectedPropertyForWorkflow({
            id: property.id,
            name: property.name,
            address: property.address,
            projectId: projectId,
            visitPrice: property.visitPrice,
            taskId: taskId || undefined
          });
          searchParams.delete('openWorkflow');
          searchParams.delete('taskId');
          setSearchParams(searchParams);
        }
      }
    }
  }, [searchParams, properties, propertyProjects]);

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
        image_path: p.image_path || (p.name.includes("Villa") && p.name.includes("14") ? villa14Image : undefined),
        propertyType: p.property_type as "Client-Managed" | "Company-Owned" | "Inactive" | undefined,
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
      const { data: projects, error } = await supabase
        .from("onboarding_projects")
        .select("id, property_id, progress")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const projectMap: Record<string, string> = {};
      const progressMap: Record<string, number> = {};
      
      // For each project, recalculate progress based on tasks with data
      for (const project of projects || []) {
        if (project.property_id && !projectMap[project.property_id]) {
          projectMap[project.property_id] = project.id;
          
          // Fetch tasks to calculate real-time progress
          const { data: tasks } = await supabase
            .from("onboarding_tasks")
            .select("status, field_value")
            .eq("project_id", project.id);
          
          if (tasks && tasks.length > 0) {
            const tasksWithProgress = tasks.filter(
              t => t.status === "completed" || (t.field_value && t.field_value.trim() !== "")
            ).length;
            const calculatedProgress = (tasksWithProgress / tasks.length) * 100;
            progressMap[project.property_id] = calculatedProgress;
            
            // Update the project progress in the database if it changed
            if (Math.abs(calculatedProgress - (project.progress || 0)) > 0.1) {
              await supabase
                .from("onboarding_projects")
                .update({ 
                  progress: calculatedProgress,
                  status: calculatedProgress === 100 ? "completed" : calculatedProgress > 0 ? "in-progress" : "pending"
                })
                .eq("id", project.id);
            }
          } else {
            progressMap[project.property_id] = project.progress || 0;
          }
        }
      }
      
      setPropertyProjects(projectMap);
      setPropertyProjectsProgress(progressMap);
    } catch (error: any) {
      console.error("Error loading projects:", error);
    }
  };

  const handleImageUpload = async (propertyId: string, file: File) => {
    try {
      setUploadingImage(propertyId);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${propertyId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('properties')
        .update({ image_path: publicUrl })
        .eq('id', propertyId);

      if (updateError) throw updateError;

      toast.success("Image uploaded successfully");
      await loadProperties();
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const visitPrice = parseFloat(formData.visitPrice);
    
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

  // Filter properties
  const filteredProperties = properties.filter(property => {
    if (propertyTypeFilter !== "All") {
      if (property.propertyType !== propertyTypeFilter) return false;
    } else {
      if (property.propertyType === "Inactive") return false;
    }

    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      const matchesName = property.name.toLowerCase().includes(search);
      const matchesAddress = property.address.toLowerCase().includes(search);
      const matchesType = property.propertyType?.toLowerCase().includes(search);
      const addressParts = property.address.split(',');
      const city = addressParts.length > 1 ? addressParts[1].trim().toLowerCase() : '';
      const matchesCity = city.includes(search);
      return matchesName || matchesAddress || matchesCity || matchesType;
    }

    return true;
  });

  const clientManagedProperties = filteredProperties.filter(p => p.propertyType === "Client-Managed");
  const companyOwnedProperties = filteredProperties.filter(p => p.propertyType === "Company-Owned");

  const getPropertyTypeTag = (type?: string) => {
    if (type === "Client-Managed") return "[Managed]";
    if (type === "Company-Owned") return "[Owned]";
    if (type === "Inactive") return "[Inactive]";
    return "";
  };

  const getPropertyTypeColor = (type?: string) => {
    if (type === "Client-Managed") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (type === "Company-Owned") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    if (type === "Inactive") return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    return "";
  };

  const renderPropertyCard = (property: Property, index: number) => (
    <Card 
      key={property.id}
      className="shadow-card hover:shadow-warm transition-all duration-300 border-border/50 overflow-hidden group"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div 
        className="relative w-full aspect-[16/9] bg-muted overflow-hidden cursor-pointer"
        onClick={() => {
          if (propertyProjects[property.id]) {
            setSelectedPropertyForDetails({
              id: property.id,
              name: property.name,
              projectId: propertyProjects[property.id]
            });
          }
        }}
      >
        {property.image_path ? (
          <img 
            src={property.image_path} 
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-subtle">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        <div className="absolute top-1.5 right-1.5" onClick={(e) => e.stopPropagation()}>
          <label htmlFor={`upload-${property.id}`} className="cursor-pointer">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs gap-1.5 shadow-lg backdrop-blur-sm bg-background/80 hover:bg-background/90"
              disabled={uploadingImage === property.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById(`upload-${property.id}`)?.click();
              }}
            >
              <Upload className="w-3 h-3" />
              {uploadingImage === property.id ? "..." : "Upload"}
            </Button>
          </label>
          <input
            id={`upload-${property.id}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(property.id, file);
            }}
          />
        </div>

        <div className="absolute top-1.5 left-1.5 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 shadow-lg backdrop-blur-sm bg-background/80 hover:bg-background/90"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(property);
            }}
          >
            <Edit className="w-3 h-3" />
          </Button>
          {isAdmin && (
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 shadow-lg backdrop-blur-sm bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(property.id);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
            {property.name}
          </CardTitle>
          {property.propertyType && (
            <Badge variant={property.propertyType === "Client-Managed" ? "default" : "secondary"} className="flex-shrink-0 text-[10px] px-2 py-0.5">
              {property.propertyType === "Client-Managed" ? "Managed" : property.propertyType === "Company-Owned" ? "Owned" : "Inactive"}
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="line-clamp-1">{property.address}</span>
        </CardDescription>
        {property.rentalType && (
          <div className="pt-1">
            <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${
              property.rentalType === 'hybrid' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
              property.rentalType === 'mid_term' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              {property.rentalType === 'hybrid' ? '🔄 Hybrid' :
               property.rentalType === 'mid_term' ? '🏠 Mid-term' :
               '🏡 Long-term'}
            </span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="px-3 pb-3 space-y-2">
        {propertyProjects[property.id] && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(propertyProjectsProgress[property.id] || 0)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${propertyProjectsProgress[property.id] || 0}%` }}
              />
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedPropertyForDetails({
              id: property.id,
              name: property.name,
              projectId: propertyProjects[property.id] || null
            });
          }}
          className="w-full h-8 text-xs"
        >
          <FileText className="w-3 h-3 mr-1.5" />
          View Details
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSelectedPropertyForListingData({
              id: property.id,
              name: property.name
            });
          }}
          className="w-full h-8 text-xs"
        >
          <Database className="w-3 h-3 mr-1.5" />
          Show Listing Data
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={() => {
            setSelectedPropertyForWorkflow({
              id: property.id,
              name: property.name,
              address: property.address,
              projectId: propertyProjects[property.id] || null,
              visitPrice: property.visitPrice
            });
          }}
          className="w-full h-8 text-xs"
        >
          <ClipboardList className="w-3 h-3 mr-1.5" />
          Onboarding
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Properties</h1>
          <p className="text-muted-foreground mt-1">Manage your property portfolio</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <BulkUpdateListingURLs />}
          <Button onClick={() => setShowForm(!showForm)} className="gap-2 shadow-warm hover:scale-105 transition-transform">
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by property name, address, city, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={propertyTypeFilter}
          onValueChange={(value: "All" | "Client-Managed" | "Company-Owned" | "Inactive") =>
            setPropertyTypeFilter(value)
          }
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Client-Managed">Client-Managed</SelectItem>
            <SelectItem value="Company-Owned">Company-Owned</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
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

      {clientManagedProperties.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              UNDER MANAGEMENT (Client Properties)
            </h2>
            <span className="text-sm text-muted-foreground">({clientManagedProperties.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {clientManagedProperties.map(renderPropertyCard)}
          </div>
        </div>
      )}

      {companyOwnedProperties.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              PEACHAUS PORTFOLIO (Owned & Operated)
            </h2>
            <span className="text-sm text-muted-foreground">({companyOwnedProperties.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {companyOwnedProperties.map(renderPropertyCard)}
          </div>
        </div>
      )}

      {filteredProperties.length === 0 && (
        <Card className="shadow-card border-border/50">
          <CardContent className="pt-12 pb-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {properties.length === 0 
                ? "No properties yet. Add your first property to get started!" 
                : "No properties match your search criteria."}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedPropertyForListingData && (
        <PropertyListingDataModal
          open={!!selectedPropertyForListingData}
          onOpenChange={(open) => {
            if (!open) setSelectedPropertyForListingData(null);
          }}
          propertyId={selectedPropertyForListingData.id}
          propertyName={selectedPropertyForListingData.name}
        />
      )}

      {selectedPropertyForWorkflow && (
        <WorkflowDialog
          open={!!selectedPropertyForWorkflow}
          onOpenChange={(open) => {
            if (!open) setSelectedPropertyForWorkflow(null);
          }}
          project={selectedPropertyForWorkflow.projectId ? {
            id: selectedPropertyForWorkflow.projectId,
            property_id: selectedPropertyForWorkflow.id,
            owner_name: '',
            property_address: selectedPropertyForWorkflow.address,
            status: 'in-progress',
            progress: 0,
            created_at: '',
            updated_at: ''
          } : null}
          propertyId={selectedPropertyForWorkflow.id}
          propertyName={selectedPropertyForWorkflow.name}
          propertyAddress={selectedPropertyForWorkflow.address}
          visitPrice={selectedPropertyForWorkflow.visitPrice}
          taskId={selectedPropertyForWorkflow.taskId}
          onUpdate={loadPropertyProjects}
        />
      )}

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
