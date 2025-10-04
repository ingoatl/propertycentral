import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, MapPin } from "lucide-react";
import { storage } from "@/lib/storage";
import { Property } from "@/types";
import { toast } from "sonner";

const Properties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    visitPrice: "",
  });

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = () => {
    setProperties(storage.getProperties());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.address || !formData.visitPrice) {
      toast.error("Please fill in all fields");
      return;
    }

    const visitPrice = parseFloat(formData.visitPrice);
    if (isNaN(visitPrice) || visitPrice <= 0) {
      toast.error("Please enter a valid visit price");
      return;
    }

    storage.addProperty({
      name: formData.name,
      address: formData.address,
      visitPrice,
    });

    setFormData({ name: "", address: "", visitPrice: "" });
    setShowForm(false);
    loadProperties();
    toast.success("Property added successfully!");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this property? All associated visits and expenses will remain but will need reassignment.")) {
      storage.deleteProperty(id);
      loadProperties();
      toast.success("Property deleted");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Properties</h1>
          <p className="text-muted-foreground">Manage your property portfolio</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 shadow-warm">
          <Plus className="w-4 h-4" />
          Add Property
        </Button>
      </div>

      {showForm && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-foreground">Add New Property</CardTitle>
            <CardDescription className="text-muted-foreground">Enter property details below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Peach Street Duplex"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-base"
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitPrice">Visit Price ($)</Label>
                <Input
                  id="visitPrice"
                  type="number"
                  step="0.01"
                  placeholder="75.00"
                  value={formData.visitPrice}
                  onChange={(e) => setFormData({ ...formData, visitPrice: e.target.value })}
                  className="text-base"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="shadow-warm">
                  Add Property
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
          <Card className="col-span-full shadow-card">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No properties yet. Add your first property to get started!</p>
            </CardContent>
          </Card>
        ) : (
          properties.map((property) => (
            <Card key={property.id} className="shadow-card hover:shadow-warm transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-foreground">{property.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1 text-muted-foreground">
                      <MapPin className="w-3 h-3" />
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
                <div className="flex items-baseline gap-2">
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
