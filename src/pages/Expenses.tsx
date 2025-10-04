import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Calendar as CalendarIcon } from "lucide-react";
import { storage } from "@/lib/storage";
import { Property, Expense } from "@/types";
import { toast } from "sonner";

const Expenses = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [formData, setFormData] = useState({
    propertyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    purpose: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setProperties(storage.getProperties());
    setExpenses(storage.getExpenses());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.propertyId || !formData.amount || !formData.date) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    storage.addExpense({
      propertyId: formData.propertyId,
      amount,
      date: formData.date,
      purpose: formData.purpose,
    });

    setFormData({
      propertyId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      purpose: "",
    });

    loadData();
    toast.success("Expense added successfully!");
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
        <p className="text-muted-foreground">Track property-related expenses</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-foreground">Add Expense</CardTitle>
          <CardDescription className="text-muted-foreground">Record a new expense</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select value={formData.propertyId} onValueChange={(value) => setFormData({ ...formData, propertyId: value })}>
                <SelectTrigger id="property" className="text-base">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="text-base"
                />
              </div>

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
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose (Optional)</Label>
              <Textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="e.g., Maintenance, Repairs, Supplies..."
                className="text-base min-h-[100px]"
              />
            </div>

            <Button type="submit" className="w-full md:w-auto shadow-warm">
              Add Expense
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Recent Expenses</h2>
        {expenses.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No expenses recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {expenses
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 10)
              .map((expense) => (
                <Card key={expense.id} className="shadow-card">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{getPropertyName(expense.propertyId)}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(expense.date).toLocaleDateString()}
                        </p>
                        {expense.purpose && <p className="text-sm text-muted-foreground mt-2">{expense.purpose}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">${expense.amount.toFixed(2)}</p>
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

export default Expenses;
