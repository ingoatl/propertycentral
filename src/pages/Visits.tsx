import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Property, Visit } from "@/types";
import { toast } from "sonner";

const Visits = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: "",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    price: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("*")
        .order("name");

      if (propertiesError) throw propertiesError;

      setProperties((propertiesData || []).map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        visitPrice: Number(p.visit_price),
        createdAt: p.created_at,
      })));

      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(10);

      if (visitsError) throw visitsError;

      setVisits((visitsData || []).map(v => ({
        id: v.id,
        propertyId: v.property_id,
        date: v.date,
        time: v.time,
        price: Number(v.price),
        notes: v.notes,
        createdAt: v.created_at,
      })));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const handlePropertySelect = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    setFormData({
      ...formData,
      propertyId,
      price: property ? property.visitPrice.toString() : "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.propertyId || !formData.date || !formData.time) {
      toast.error("Please fill in all required fields");
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("visits")
        .insert({
          property_id: formData.propertyId,
          date: formData.date,
          time: formData.time,
          price,
          notes: formData.notes || null,
        });

      if (error) throw error;

      setFormData({
        propertyId: "",
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        price: "",
        notes: "",
      });

      await loadData();
      toast.success("Visit logged successfully!");
    } catch (error) {
      console.error("Error adding visit:", error);
      toast.error("Failed to log visit");
    } finally {
      setLoading(false);
    }
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property?.name || "Unknown";
  };

  const getPropertyAddress = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property?.address || "";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border/50">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Log Visit</h1>
        <p className="text-muted-foreground mt-1">Record property visits quickly</p>
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="text-foreground">New Visit</CardTitle>
          <CardDescription className="text-muted-foreground">Log a new property visit</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="property">Property *</Label>
              <Select value={formData.propertyId} onValueChange={handlePropertySelect}>
                <SelectTrigger id="property" className="text-base">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} - ${property.visitPrice.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Date *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Time *
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Visit Price ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="text-base"
                placeholder="Auto-filled from property"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this visit..."
                className="text-base min-h-[100px]"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full md:w-auto shadow-warm">
              {loading ? "Logging..." : "Log Visit"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="text-xl">Recent Visits</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {visits.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No visits logged yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((visit, index) => (
                <div 
                  key={visit.id} 
                  className="p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-semibold text-lg text-foreground">{getPropertyName(visit.propertyId)}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {getPropertyAddress(visit.propertyId)}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {new Date(visit.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {visit.time}
                        </span>
                      </div>
                      {visit.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
                          {visit.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">${visit.price.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Visits;
