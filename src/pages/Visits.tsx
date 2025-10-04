import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Property, Visit } from "@/types";
import { toast } from "sonner";

const Visits = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: "",
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

    if (!formData.propertyId) {
      toast.error("Please select a property");
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    try {
      setLoading(true);
      // Capture current date and time automatically
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5);

      const { error } = await supabase
        .from("visits")
        .insert({
          property_id: formData.propertyId,
          date: currentDate,
          time: currentTime,
          price,
          notes: formData.notes || null,
        });

      if (error) throw error;

      setFormData({
        propertyId: "",
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
    <div className="space-y-6 animate-fade-in pb-6">
      <div className="pb-4 border-b border-border/50">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Log Visit</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Quick entry for property visits</p>
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg pb-4">
          <CardTitle className="text-lg sm:text-xl text-foreground">New Visit Entry</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Select property and log your visit instantly
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Property Selection - Large and prominent */}
            <div className="space-y-3">
              <Label htmlFor="property" className="text-base font-semibold">Select Property *</Label>
              <Select value={formData.propertyId} onValueChange={handlePropertySelect}>
                <SelectTrigger id="property" className="h-14 text-lg border-2 focus:border-primary">
                  <SelectValue placeholder="Choose a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id} className="text-base py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{property.name}</span>
                        <span className="text-sm text-muted-foreground">${property.visitPrice.toFixed(2)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visit Price - Large input */}
            <div className="space-y-3">
              <Label htmlFor="price" className="text-base font-semibold">Visit Price ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="h-14 text-lg border-2 focus:border-primary"
                placeholder="Auto-filled from property"
              />
            </div>

            {/* Notes - Optional */}
            <div className="space-y-3">
              <Label htmlFor="notes" className="text-base font-semibold">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any notes about this visit..."
                className="text-base min-h-[120px] border-2 focus:border-primary"
              />
            </div>

            {/* Auto-capture notice */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Auto-tracked</p>
                <p>Date and time will be recorded automatically when you submit</p>
              </div>
            </div>

            {/* Large submit button */}
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-14 text-lg font-semibold shadow-warm hover:scale-[1.02] transition-transform"
            >
              {loading ? (
                "Logging..."
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Log Visit Now
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="text-lg sm:text-xl">Recent Visits</CardTitle>
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
                  className="p-4 sm:p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 bg-gradient-subtle"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-base sm:text-lg text-foreground">
                        {getPropertyName(visit.propertyId)}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{getPropertyAddress(visit.propertyId)}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {new Date(visit.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
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
                    <div className="text-left sm:text-right">
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
