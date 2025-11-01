import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReconciliationList } from "@/components/reconciliation/ReconciliationList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download, FileText, ExternalLink, DollarSign, Receipt } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  date: string;
  type: 'charge' | 'expense';
  property_name?: string;
  owner_name?: string;
  category: string;
  description: string;
  amount: number;
  receipt_path?: string;
  status?: string;
  stripe_payment_intent_id?: string;
  exported: boolean;
}

interface PropertyOwner {
  id: string;
  name: string;
  email: string;
}

interface Property {
  id: string;
  name: string;
}

const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Utilities",
  "Repairs",
  "Supplies",
  "Insurance",
  "Property Tax",
  "Marketing",
  "Legal & Professional",
  "Other"
];

const CHARGE_CATEGORIES = [
  "Management Fee",
  "Late Fee",
  "Service Fee",
  "Other"
];

export default function MonthlyCharges() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Charge Owner Form State
  const [owners, setOwners] = useState<PropertyOwner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [chargeMonth, setChargeMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [chargeDescription, setChargeDescription] = useState<string>("");
  const [chargeCategory, setChargeCategory] = useState<string>("Management Fee");
  const [chargingOwner, setChargingOwner] = useState(false);
  
  // Record Expense Form State
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [expenseCategory, setExpenseCategory] = useState<string>("Maintenance");
  const [expenseDescription, setExpenseDescription] = useState<string>("");
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  
  // Filter State
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  useEffect(() => {
    checkAdminStatus();
    loadOwners();
    loadProperties();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadTransactions();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      setIsAdmin(!!roles);
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOwners = async () => {
    try {
      const { data, error } = await supabase
        .from('property_owners')
        .select('id, name, email')
        .order('name');

      if (error) throw error;
      setOwners(data || []);
    } catch (error: any) {
      console.error('Error loading owners:', error);
    }
  };

  const loadProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error: any) {
      console.error('Error loading properties:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      
      // Load charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('monthly_charges')
        .select(`
          *,
          property_owners (
            id,
            name
          )
        `)
        .order('charge_month', { ascending: false });

      if (chargesError) throw chargesError;

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          properties (
            id,
            name
          )
        `)
        .order('date', { ascending: false });

      if (expensesError) throw expensesError;

      // Combine into transactions array
      const chargeTransactions: Transaction[] = (chargesData || []).map(charge => ({
        id: charge.id,
        date: charge.charge_month,
        type: 'charge' as const,
        owner_name: charge.property_owners?.name || 'Unknown Owner',
        category: charge.category || 'Management Fee',
        description: `Charge for ${format(new Date(charge.charge_month), 'MMMM yyyy')}`,
        amount: Number(charge.total_management_fees),
        receipt_path: charge.receipt_path,
        status: charge.charge_status,
        stripe_payment_intent_id: charge.stripe_payment_intent_id,
        exported: charge.exported || false
      }));

      const expenseTransactions: Transaction[] = (expensesData || []).map(expense => ({
        id: expense.id,
        date: expense.date,
        type: 'expense' as const,
        property_name: expense.properties?.name || 'Unknown Property',
        category: expense.category || 'Uncategorized',
        description: expense.purpose || '',
        amount: Number(expense.amount),
        receipt_path: expense.file_path,
        exported: expense.exported || false
      }));

      // Combine and sort by date
      const allTransactions = [...chargeTransactions, ...expenseTransactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setTransactions(allTransactions);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleChargeOwner = async (viaPending: boolean = false) => {
    if (!selectedOwner || !chargeAmount || !chargeMonth) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setChargingOwner(true);

      if (viaPending) {
        // Save as pending charge without Stripe
        const { error } = await supabase
          .from('monthly_charges')
          .insert({
            owner_id: selectedOwner,
            charge_month: `${chargeMonth}-01`,
            total_management_fees: parseFloat(chargeAmount),
            category: chargeCategory,
            charge_status: 'pending'
          });

        if (error) throw error;

        toast.success("Charge saved as pending");
      } else {
        // Process via Stripe
        const { data, error } = await supabase.functions.invoke('charge-individual-owner', {
          body: {
            ownerId: selectedOwner,
            chargeMonth: `${chargeMonth}-01`,
            amount: parseFloat(chargeAmount),
            description: chargeDescription || `${chargeCategory} for ${format(new Date(chargeMonth), 'MMMM yyyy')}`
          }
        });

        if (error) throw error;

        toast.success(data.message || "Owner charged successfully");
      }

      // Reset form
      setSelectedOwner("");
      setChargeAmount("");
      setChargeDescription("");
      setChargeCategory("Management Fee");
      loadTransactions();
    } catch (error: any) {
      console.error('Error charging owner:', error);
      toast.error(error.message || "Failed to charge owner");
    } finally {
      setChargingOwner(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!selectedProperty || !expenseAmount || !expenseDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSavingExpense(true);

      let filePath = null;

      // Upload receipt if provided
      if (expenseFile) {
        const fileExt = expenseFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-documents')
          .upload(fileName, expenseFile);

        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      // Save expense
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('expenses')
        .insert({
          property_id: selectedProperty,
          date: expenseDate,
          amount: parseFloat(expenseAmount),
          category: expenseCategory,
          purpose: expenseDescription,
          file_path: filePath,
          user_id: userData.user?.id
        });

      if (error) throw error;

      toast.success("Expense recorded successfully");

      // Reset form
      setSelectedProperty("");
      setExpenseAmount("");
      setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
      setExpenseCategory("Maintenance");
      setExpenseDescription("");
      setExpenseFile(null);
      loadTransactions();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      toast.error(error.message || "Failed to save expense");
    } finally {
      setSavingExpense(false);
    }
  };

  const exportToCSV = () => {
    const csvRows = [];
    
    // QuickBooks CSV headers
    csvRows.push([
      'Date',
      'Transaction Type',
      'Account',
      'Customer/Vendor',
      'Category',
      'Description',
      'Amount',
      'Payment Method',
      'Reference #'
    ].join(','));

    // Add transaction rows
    const filteredTransactions = getFilteredTransactions();
    filteredTransactions.forEach(transaction => {
      csvRows.push([
        transaction.date,
        transaction.type === 'charge' ? 'Income' : 'Expense',
        transaction.type === 'charge' ? 'Management Fees' : 'Property Expenses',
        transaction.type === 'charge' ? transaction.owner_name : transaction.property_name,
        transaction.category,
        `"${transaction.description.replace(/"/g, '""')}"`,
        transaction.amount.toFixed(2),
        transaction.stripe_payment_intent_id ? 'Stripe' : 'Other',
        transaction.stripe_payment_intent_id || ''
      ].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickbooks_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();

    toast.success("Exported to QuickBooks CSV format");
  };

  const getFilteredTransactions = () => {
    return transactions.filter(transaction => {
      if (filterType !== 'all' && transaction.type !== filterType) return false;
      if (filterDateFrom && transaction.date < filterDateFrom) return false;
      if (filterDateTo && transaction.date > filterDateTo) return false;
      return true;
    });
  };

  const viewReceipt = async (receiptPath: string) => {
    const { data } = await supabase.storage
      .from('expense-documents')
      .createSignedUrl(receiptPath, 60);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monthly Charges</h1>
          <p className="text-muted-foreground">Manage charges, expenses, and export to QuickBooks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export to QuickBooks
          </Button>
        </div>
      </div>

      <Tabs defaultValue="charges" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="charges">Charge Owner</TabsTrigger>
          <TabsTrigger value="expenses">Record Expense</TabsTrigger>
          <TabsTrigger value="reconciliations">Reconciliations</TabsTrigger>
        </TabsList>

        <TabsContent value="reconciliations" className="mt-6">
          <ReconciliationList />
        </TabsContent>

        <TabsContent value="charges" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Charge Owner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner *</Label>
                <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map(owner => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name} ({owner.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge-month">Month *</Label>
                <Input
                  id="charge-month"
                  type="month"
                  value={chargeMonth}
                  onChange={(e) => setChargeMonth(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge-amount">Amount *</Label>
                <Input
                  id="charge-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge-category">Category</Label>
                <Select value={chargeCategory} onValueChange={setChargeCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge-description">Description</Label>
                <Textarea
                  id="charge-description"
                  placeholder="Optional notes..."
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => handleChargeOwner(false)} 
                  disabled={chargingOwner}
                  className="flex-1"
                >
                  {chargingOwner ? <Loader2 className="w-4 h-4 animate-spin" /> : "Charge via Stripe"}
                </Button>
                <Button 
                  onClick={() => handleChargeOwner(true)} 
                  disabled={chargingOwner}
                  variant="outline"
                  className="flex-1"
                >
                  Save as Pending
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Record Expense
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="property">Property *</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(prop => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-date">Date *</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount *</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-category">Category</Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-description">Description</Label>
                <Textarea
                  id="expense-description"
                  placeholder="Purpose of expense..."
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt-upload">Receipt</Label>
                <Input
                  id="receipt-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setExpenseFile(e.target.files?.[0] || null)}
                />
              </div>

              <Button 
                onClick={handleSaveExpense} 
                disabled={savingExpense}
                className="w-full"
              >
                {savingExpense ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Expense"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction History - shown below all tabs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Filter by Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="charge">Charges Only</SelectItem>
                  <SelectItem value="expense">Expenses Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>From Date</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label>To Date</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Property/Owner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getFilteredTransactions().map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={transaction.type === 'charge' ? 'default' : 'secondary'}>
                      {transaction.type === 'charge' ? 'Income' : 'Expense'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {transaction.type === 'charge' ? transaction.owner_name : transaction.property_name}
                  </TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                  <TableCell className="font-mono">
                    ${transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {transaction.receipt_path ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewReceipt(transaction.receipt_path!)}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {transaction.status ? (
                      <Badge variant={transaction.status === 'succeeded' ? 'default' : 'outline'}>
                        {transaction.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {transaction.stripe_payment_intent_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <a
                          href={`https://dashboard.stripe.com/payments/${transaction.stripe_payment_intent_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {getFilteredTransactions().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found. Start by charging an owner or recording an expense.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
