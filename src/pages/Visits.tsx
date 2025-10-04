import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { storage } from "@/lib/storage";
import { Property, Visit } from "@/types";
import { toast } from "sonner";

const Visits = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
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

  const loadData = () => {
    setProperties(storage.getProperties());
    setVisits(storage.getVisits());
  };

  const handlePropertySelect = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    setFormData({
      ...formData,
      propertyId,
      price: property ? property.visitPrice.toString() : "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
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

    storage.addVisit({
      propertyId: formData.propertyId,
      date: formData.date,
      time: formData.time,
      price,
      notes: formData.notes,
    });

    setFormData({
      propertyId: "",
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      price: "",
      notes: "",
    });

    loadData();
    toast.success("Visit logged successfully!");
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Log Visit</h1>
        <p className="text-muted-foreground">Record property visits quickly</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">New Visit</CardTitle>
          <CardDescription className="text-muted-foreground">Log a new property visit</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
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
                  Date
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
                  Time
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
              <Label htmlFor="price">Visit Price ($)</Label>
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

            <Button type="submit" className="w-full md:w-auto shadow-warm">
              Log Visit
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Recent Visits</h2>
        {visits.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No visits logged yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {visits
              .sort((a, b) => new Date(b.date + " " + b.time).getTime() - new Date(a.date + " " + a.time).getTime())
              .slice(0, 10)
              .map((visit) => (
                <Card key={visit.id} className="shadow-card">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{getPropertyName(visit.propertyId)}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(visit.date).toLocaleDateString()} at {visit.time}
                        </p>
                        {visit.notes && <p className="text-sm text-muted-foreground mt-2">{visit.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">${visit.price.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Visits;
