import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, DollarSign, Plus, Trash2, Send, CreditCard, Banknote, Zap, FileText } from "lucide-react";
import { format } from "date-fns";

interface PropertyOwner {
  id: string;
  name: string;
  email: string;
  payment_method?: string;
  stripe_customer_id?: string;
}

interface PendingReconciliation {
  id: string;
  property_name: string;
  reconciliation_month: string;
  total_due: number;
  management_fee: number;
  visit_fees: number;
  total_expenses: number;
  status: string;
}

interface ChargeLineItem {
  id: string;
  category: string;
  description: string;
  amount: string;
}

const CHARGE_CATEGORIES = [
  "Management Fee",
  "Security Deposit",
  "Onboarding Fee",
  "Late Fee",
  "Service Fee",
  "Design Setup",
  "Visit Fee",
  "Expense Reimbursement",
  "Other"
];

interface QuickChargeBuilderProps {
  onSuccess?: () => void;
}

export const QuickChargeBuilder = ({ onSuccess }: QuickChargeBuilderProps) => {
  const [owners, setOwners] = useState<PropertyOwner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [chargeSource, setChargeSource] = useState<"custom" | "reconciliation">("custom");
  const [pendingReconciliations, setPendingReconciliations] = useState<PendingReconciliation[]>([]);
  const [selectedReconciliation, setSelectedReconciliation] = useState<string>("");
  const [lineItems, setLineItems] = useState<ChargeLineItem[]>([
    { id: crypto.randomUUID(), category: "Management Fee", description: "", amount: "" }
  ]);
  const [statementNotes, setStatementNotes] = useState("");
  const [isCharging, setIsCharging] = useState(false);
  const [loadingReconciliations, setLoadingReconciliations] = useState(false);
  
  // Selected owner details
  const selectedOwnerData = owners.find(o => o.id === selectedOwner);
  const paymentMethod = selectedOwnerData?.payment_method || "card";
  const processingFeeRate = paymentMethod === "ach" ? 0.01 : 0.03;

  useEffect(() => {
    loadOwners();
  }, []);

  useEffect(() => {
    if (selectedOwner && chargeSource === "reconciliation") {
      loadPendingReconciliations(selectedOwner);
    }
  }, [selectedOwner, chargeSource]);

  const loadOwners = async () => {
    const { data, error } = await supabase
      .from('property_owners')
      .select('id, name, email, payment_method, stripe_customer_id')
      .order('name');
    
    if (!error && data) {
      setOwners(data);
    }
  };

  const loadPendingReconciliations = async (ownerId: string) => {
    setLoadingReconciliations(true);
    try {
      const { data, error } = await supabase
        .from('monthly_reconciliations')
        .select(`
          id,
          reconciliation_month,
          management_fee,
          visit_fees,
          total_expenses,
          status,
          charged_at,
          properties(name)
        `)
        .eq('properties.owner_id', ownerId)
        .in('status', ['approved', 'statement_sent'])
        .is('charged_at', null)
        .order('reconciliation_month', { ascending: false });

      if (!error && data) {
        const mapped = data.map((rec: any) => ({
          id: rec.id,
          property_name: rec.properties?.name || 'Unknown',
          reconciliation_month: rec.reconciliation_month,
          total_due: (rec.management_fee || 0) + (rec.visit_fees || 0) + (rec.total_expenses || 0),
          management_fee: rec.management_fee || 0,
          visit_fees: rec.visit_fees || 0,
          total_expenses: rec.total_expenses || 0,
          status: rec.status
        }));
        setPendingReconciliations(mapped);
        
        // Auto-select current month if available
        const currentMonth = format(new Date(), 'yyyy-MM');
        const currentMonthRec = mapped.find(r => r.reconciliation_month.startsWith(currentMonth));
        if (currentMonthRec) {
          setSelectedReconciliation(currentMonthRec.id);
        } else if (mapped.length > 0) {
          setSelectedReconciliation(mapped[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading reconciliations:', err);
    } finally {
      setLoadingReconciliations(false);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), category: "Management Fee", description: "", amount: "" }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof ChargeLineItem, value: string) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    if (chargeSource === "reconciliation" && selectedReconciliation) {
      const rec = pendingReconciliations.find(r => r.id === selectedReconciliation);
      return rec?.total_due || 0;
    }
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const subtotal = calculateSubtotal();
  const processingFee = subtotal * processingFeeRate;
  const total = subtotal + processingFee;

  const handleCharge = async () => {
    if (!selectedOwner) {
      toast.error("Please select an owner");
      return;
    }

    if (chargeSource === "reconciliation" && selectedReconciliation) {
      // Charge from reconciliation
      setIsCharging(true);
      try {
        const { data, error } = await supabase.functions.invoke('charge-from-reconciliation', {
          body: { reconciliation_id: selectedReconciliation }
        });
        
        if (error) throw error;
        
        toast.success(`Successfully charged $${(data.amount / 100).toFixed(2)}`);
        setSelectedReconciliation("");
        loadPendingReconciliations(selectedOwner);
        onSuccess?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to charge");
      } finally {
        setIsCharging(false);
      }
    } else {
      // Custom charge using charge-individual-owner
      const validItems = lineItems.filter(item => parseFloat(item.amount) > 0);
      if (validItems.length === 0) {
        toast.error("Please add at least one fee with an amount");
        return;
      }

      setIsCharging(true);
      try {
        const totalBase = validItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const description = validItems.map(i => `${i.category}${i.description ? ': ' + i.description : ''}`).join(', ');
        
        const { data, error } = await supabase.functions.invoke('charge-individual-owner', {
          body: {
            ownerId: selectedOwner,
            chargeMonth: format(new Date(), 'yyyy-MM-dd'),
            amount: totalBase,
            description: description
          }
        });
        
        if (error) throw error;
        
        toast.success(data.message || "Owner charged successfully");
        setLineItems([{ id: crypto.randomUUID(), category: "Management Fee", description: "", amount: "" }]);
        setSelectedOwner("");
        setStatementNotes("");
        onSuccess?.();
      } catch (err: any) {
        toast.error(err.message || "Failed to charge");
      } finally {
        setIsCharging(false);
      }
    }
  };

  const selectedRec = pendingReconciliations.find(r => r.id === selectedReconciliation);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Quick Charge
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Charge owners from reconciliations or create custom charges with automatic processing fees
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Owner Selection */}
        <div className="space-y-2">
          <Label>Owner *</Label>
          <Select value={selectedOwner} onValueChange={setSelectedOwner}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select owner..." />
            </SelectTrigger>
            <SelectContent>
              {owners.map(owner => (
                <SelectItem key={owner.id} value={owner.id}>
                  <div className="flex items-center gap-2">
                    <span>{owner.name}</span>
                    {owner.stripe_customer_id && (
                      <Badge variant="outline" className="text-xs">
                        {owner.payment_method === "ach" ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOwnerData && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {selectedOwnerData.payment_method === "ach" ? (
                <>
                  <Banknote className="w-3 h-3" />
                  ACH Bank Transfer (1% processing fee)
                </>
              ) : (
                <>
                  <CreditCard className="w-3 h-3" />
                  Credit Card (3% processing fee)
                </>
              )}
            </p>
          )}
        </div>

        {/* Charge Source Toggle */}
        {selectedOwner && (
          <div className="space-y-3">
            <Label>Charge Source</Label>
            <RadioGroup 
              value={chargeSource} 
              onValueChange={(v) => setChargeSource(v as "custom" | "reconciliation")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="cursor-pointer font-normal">Custom Amount</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="reconciliation" id="reconciliation" />
                <Label htmlFor="reconciliation" className="cursor-pointer font-normal flex items-center gap-1">
                  From Reconciliation
                  {pendingReconciliations.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{pendingReconciliations.length}</Badge>
                  )}
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* From Reconciliation View */}
        {chargeSource === "reconciliation" && selectedOwner && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
            {loadingReconciliations ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : pendingReconciliations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No pending reconciliations found for this owner
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Month</Label>
                  <Select value={selectedReconciliation} onValueChange={setSelectedReconciliation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reconciliation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingReconciliations.map(rec => (
                        <SelectItem key={rec.id} value={rec.id}>
                          <div className="flex items-center justify-between gap-4">
                            <span>{rec.property_name} - {format(new Date(rec.reconciliation_month + 'T00:00:00'), 'MMMM yyyy')}</span>
                            <span className="font-medium">${rec.total_due.toFixed(2)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRec && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Management Fee:</span>
                      <span>${selectedRec.management_fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Visit Fees:</span>
                      <span>${selectedRec.visit_fees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expenses:</span>
                      <span>${selectedRec.total_expenses.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Custom Amount View */}
        {chargeSource === "custom" && selectedOwner && (
          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={item.id} className="p-4 bg-muted/30 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Fee #{index + 1}
                  </span>
                  {lineItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(item.id)}
                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select 
                      value={item.category} 
                      onValueChange={(value) => updateLineItem(item.id, 'category', value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHARGE_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      placeholder="Optional details..."
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Amount *</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={item.amount}
                        onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addLineItem}
              className="w-full gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Add Another Fee
            </Button>
          </div>
        )}

        {/* Notes */}
        {selectedOwner && chargeSource === "custom" && (
          <div className="space-y-2">
            <Label>Statement Notes (optional)</Label>
            <Textarea
              placeholder="Additional notes..."
              value={statementNotes}
              onChange={(e) => setStatementNotes(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* Totals */}
        {selectedOwner && subtotal > 0 && (
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-amber-600">
              <span>Processing Fee ({(processingFeeRate * 100).toFixed(0)}%):</span>
              <span>${processingFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total Charge:</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Charge Button */}
        {selectedOwner && (
          <Button 
            onClick={handleCharge} 
            disabled={isCharging || subtotal <= 0}
            className="w-full h-12 text-base gap-2 bg-gradient-to-r from-primary to-primary/80"
            size="lg"
          >
            {isCharging ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Charge ${total.toFixed(2)} Now
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
