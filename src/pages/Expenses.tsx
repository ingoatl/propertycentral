import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Calendar as CalendarIcon, Receipt, Upload, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Property, Expense } from "@/types";
import { toast } from "sonner";
import { z } from "zod";
import { PropertyExpenseView } from "@/components/PropertyExpenseView";
import { BackfillReceiptsButton } from "@/components/BackfillReceiptsButton";

const expenseSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount cannot exceed $1,000,000"),
  date: z.string().min(1, "Date is required"),
  purpose: z.string().max(2000, "Purpose must be less than 2000 characters").optional()
    .refine((val) => {
      if (!val) return true;
      const normalized = val.toLowerCase().trim();
      const visitKeywords = [
        'visit fee',
        'visit charge',
        'hourly charge',
        'property visit',
        'visit -',
        'hours @',
        'hour @',
        '@/hr',
        '/hr',
      ];
      return !visitKeywords.some(keyword => normalized.includes(keyword));
    }, {
      message: "Visit charges should be logged on the Visits page, not as expenses. Please use the Visits tab to record property visits and associated charges."
    }),
});

const Expenses = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    propertyId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    purpose: "",
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

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;

      const mappedExpenses = (expensesData || []).map(e => ({
        id: e.id,
        propertyId: e.property_id,
        amount: Number(e.amount),
        date: e.date,
        purpose: e.purpose,
        filePath: e.file_path,
        createdAt: e.created_at,
        category: e.category,
        orderNumber: e.order_number,
        orderDate: e.order_date,
        trackingNumber: e.tracking_number,
        vendor: e.vendor,
        itemsDetail: e.items_detail,
        deliveryAddress: e.delivery_address,
        exported: e.exported,
        isReturn: e.is_return,
        parentExpenseId: e.parent_expense_id,
        returnReason: e.return_reason,
        lineItems: e.line_items as { items: { name: string; price: number; }[] } | undefined,
      }));

      setExpenses(mappedExpenses);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload an image (JPG, PNG, WEBP) or PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    
    // Validate with zod
    const validation = expenseSchema.safeParse({
      propertyId: formData.propertyId,
      amount,
      date: formData.date,
      purpose: formData.purpose,
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
      
      let filePath = null;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-documents')
          .upload(fileName, selectedFile);

        if (uploadError) {
          throw new Error(`File upload failed: ${uploadError.message}`);
        }
        filePath = fileName;
      }

      const { error } = await supabase
        .from("expenses")
        .insert({
          property_id: formData.propertyId,
          amount,
          date: formData.date,
          purpose: formData.purpose || null,
          file_path: filePath,
          user_id: user.id,
        });

      if (error) throw error;

      setFormData({
        propertyId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        purpose: "",
      });
      setSelectedFile(null);

      await loadData();
      toast.success("Expense added successfully!");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error adding expense:", error);
      }
      toast.error(error.message || "Failed to add expense");
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

  // Group expenses by property
  const expensesByProperty = expenses.reduce((acc, expense) => {
    if (!acc[expense.propertyId]) {
      acc[expense.propertyId] = [];
    }
    acc[expense.propertyId].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  const getPropertyTotal = (propertyId: string) => {
    return expensesByProperty[propertyId]?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  };

  if (selectedPropertyId) {
    const property = properties.find(p => p.id === selectedPropertyId);
    const propertyExpenses = expensesByProperty[selectedPropertyId] || [];
    
    return (
      <PropertyExpenseView
        propertyId={selectedPropertyId}
        propertyName={property?.name || "Unknown"}
        propertyAddress={property?.address || ""}
        expenses={propertyExpenses}
        onBack={() => setSelectedPropertyId(null)}
        onExpenseDeleted={loadData}
      />
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground mt-1">Record and track property expenses</p>
        </div>
        <BackfillReceiptsButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record New Expense</CardTitle>
          <CardDescription>
            <span className="text-amber-600 dark:text-amber-500 font-medium">⚠️ Note:</span> Visit charges should be recorded on the <span className="font-semibold">Visits</span> page, not here. This form is for property expenses like maintenance, supplies, and utilities only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property">Property *</Label>
                <Select
                  value={formData.propertyId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, propertyId: value })
                  }
                >
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose *</Label>
                <Input
                  id="purpose"
                  placeholder="e.g., Maintenance, Supplies"
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData({ ...formData, purpose: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt (optional)</Label>
              <Input
                id="receipt"
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="text-xl">Properties with Expenses</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {Object.keys(expensesByProperty).length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(expensesByProperty).map((propertyId) => {
                const expenseCount = expensesByProperty[propertyId].length;
                const total = getPropertyTotal(propertyId);
                
                return (
                  <div
                    key={propertyId}
                    onClick={() => setSelectedPropertyId(propertyId)}
                    className="p-6 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.02] bg-gradient-subtle cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                          {getPropertyName(propertyId)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {getPropertyAddress(propertyId)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                          ${total.toFixed(2)}
                        </p>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Expenses;
