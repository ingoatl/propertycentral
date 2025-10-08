import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Calendar as CalendarIcon, MapPin, Receipt, Upload, Trash2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Property, Expense } from "@/types";
import { toast } from "sonner";
import { z } from "zod";
import { ExpenseDocumentLink } from "@/components/ExpenseDocumentLink";
import { ExpenseDetailModal } from "@/components/ExpenseDetailModal";

const expenseSchema = z.object({
  propertyId: z.string().uuid("Please select a property"),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount cannot exceed $1,000,000"),
  date: z.string().min(1, "Date is required"),
  purpose: z.string().max(2000, "Purpose must be less than 2000 characters").optional(),
});

const Expenses = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterPropertyId, setFilterPropertyId] = useState<string>("all");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
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
        .order("date", { ascending: false })
        .limit(10);

      if (expensesError) throw expensesError;

      setExpenses((expensesData || []).map(e => ({
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
      })));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading data:", error);
      }
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadData();
      toast.success("Expense deleted");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error deleting expense:", error);
      }
      toast.error("Failed to delete expense");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border/50">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Expenses</h1>
        <p className="text-muted-foreground mt-1">Track property-related expenses</p>
      </div>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="text-foreground">Add Expense</CardTitle>
          <CardDescription className="text-muted-foreground">Record a new expense</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="property">Property *</Label>
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
                  Amount *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="text-base"
                  required
                />
              </div>

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
                  required
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
                  maxLength={2000}
                />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Receipt/Document (Optional)
              </Label>
              <Input
                id="file"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="text-base cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full md:w-auto shadow-warm">
              {loading ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Recent Expenses</CardTitle>
            <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {(filterPropertyId === "all" ? expenses : expenses.filter(e => e.propertyId === filterPropertyId)).length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(filterPropertyId === "all" ? expenses : expenses.filter(e => e.propertyId === filterPropertyId)).map((expense, index) => (
                <div
                  key={expense.id} 
                  className="p-5 border border-border/50 rounded-xl hover:shadow-card transition-all duration-300 hover:scale-[1.01] bg-gradient-subtle"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <h3 className="font-semibold text-lg text-foreground">{getPropertyName(expense.propertyId)}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {getPropertyAddress(expense.propertyId)}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {new Date(expense.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                      {expense.purpose && (
                        <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-primary/30 pl-3">
                          {expense.purpose}
                        </p>
                      )}
                      {expense.filePath && (
                        <ExpenseDocumentLink filePath={expense.filePath} />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-500">${expense.amount.toFixed(2)}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedExpense(expense);
                            setIsDetailModalOpen(true);
                          }}
                          className="hover:bg-primary/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseDetailModal
        expense={selectedExpense}
        propertyName={selectedExpense ? getPropertyName(selectedExpense.propertyId) : ""}
        propertyAddress={selectedExpense ? getPropertyAddress(selectedExpense.propertyId) : ""}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
      />
    </div>
  );
};

export default Expenses;
