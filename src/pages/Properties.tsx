import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, MapPin, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Property } from "@/types";
import { toast } from "sonner";
import { z } from "zod";

const propertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  address: z.string().trim().min(1, "Address is required").max(500, "Address must be less than 500 characters"),
  visitPrice: z.number().positive("Visit price must be positive").max(10000, "Visit price cannot exceed $10,000"),
});

const Properties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    visitPrice: "",
  });

  useEffect(() => {
    loadProperties();
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
        createdAt: p.created_at,
      })));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading properties:", error);
      }
      toast.error("Failed to load properties");
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
          user_id: user.id,
        });

      if (error) throw error;

      setFormData({ name: "", address: "", visitPrice: "" });
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
            <Card 
              key={property.id} 
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
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(property.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2 bg-gradient-subtle p-4 rounded-lg">
                  <span className="text-sm text-muted-foreground">Visit Price:</span>
                  <span className="text-2xl font-bold text-primary">${property.visitPrice.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Properties;
