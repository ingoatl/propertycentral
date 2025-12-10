import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Zap, Flame, Droplets, Trash2, Wifi, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";

const UTILITY_ICONS: Record<string, any> = {
  electric: Zap,
  gas: Flame,
  water: Droplets,
  trash: Trash2,
  internet: Wifi,
  sewer: Droplets,
};

const UTILITY_COLORS: Record<string, string> = {
  electric: "#f59e0b",
  gas: "#ef4444",
  water: "#3b82f6",
  trash: "#6b7280",
  internet: "#8b5cf6",
  sewer: "#06b6d4",
};

export default function Utilities() {
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [isScanning, setIsScanning] = useState(false);

  const { data: properties } = useQuery({
    queryKey: ["properties-for-utilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, property_type")
        .in("property_type", ["Client-Managed", "Company-Owned"])
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: readings, refetch: refetchReadings } = useQuery({
    queryKey: ["utility-readings", selectedProperty],
    queryFn: async () => {
      let query = supabase
        .from("utility_readings")
        .select(`
          *,
          properties:property_id (
            id,
            name,
            address
          )
        `)
        .order("bill_date", { ascending: false });

      if (selectedProperty !== "all") {
        query = query.eq("property_id", selectedProperty);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts, refetch: refetchAlerts } = useQuery({
    queryKey: ["utility-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utility_anomaly_alerts")
        .select(`
          *,
          properties:property_id (
            id,
            name
          )
        `)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleScanInbox = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-utilities-inbox");
      if (error) throw error;
      toast.success(`Scan complete: ${data.newReadings} new readings found`);
      refetchReadings();
    } catch (error: any) {
      toast.error("Failed to scan inbox: " + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRunAnomalyDetection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("utility-anomaly-detector");
      if (error) throw error;
      toast.success(`Detection complete: ${data.anomaliesDetected} anomalies found`);
      refetchAlerts();
    } catch (error: any) {
      toast.error("Failed to run detection: " + error.message);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const { error } = await supabase
      .from("utility_anomaly_alerts")
      .update({ 
        is_resolved: true, 
        resolved_at: new Date().toISOString() 
      })
      .eq("id", alertId);

    if (error) {
      toast.error("Failed to resolve alert");
    } else {
      toast.success("Alert resolved");
      refetchAlerts();
    }
  };

  // Calculate summary stats
  const totalSpend = readings?.reduce((sum, r) => sum + (r.amount_due || 0), 0) || 0;
  const avgMonthlySpend = readings?.length ? totalSpend / Math.max(1, new Set(readings.map(r => r.bill_date?.substring(0, 7))).size) : 0;
  const criticalAlerts = alerts?.filter(a => a.severity === "critical").length || 0;
  const warningAlerts = alerts?.filter(a => a.severity === "warning").length || 0;

  // Group readings by utility type for charts
  const getUtilityBreakdown = () => {
    const breakdown: Record<string, number> = {};
    readings?.forEach(r => {
      breakdown[r.utility_type] = (breakdown[r.utility_type] || 0) + (r.amount_due || 0);
    });
    return Object.entries(breakdown).map(([type, amount]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      amount,
      fill: UTILITY_COLORS[type] || "#6b7280",
    }));
  };

  // Get monthly trends
  const getMonthlyTrends = () => {
    const months: Record<string, Record<string, number>> = {};
    readings?.forEach(r => {
      const month = r.bill_date?.substring(0, 7);
      if (month) {
        if (!months[month]) months[month] = {};
        months[month][r.utility_type] = (months[month][r.utility_type] || 0) + (r.amount_due || 0);
      }
    });
    
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM"),
        ...data,
      }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Utilities Monitor</h1>
          <p className="text-muted-foreground">Track consumption and costs across properties</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunAnomalyDetection}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Run Detection
          </Button>
          <Button onClick={handleScanInbox} disabled={isScanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning..." : "Scan Inbox"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spend (60 days)</p>
                <p className="text-2xl font-bold">${totalSpend.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Monthly</p>
                <p className="text-2xl font-bold">${avgMonthlySpend.toFixed(2)}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-destructive">{criticalAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-amber-500">{warningAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="readings">All Readings</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {(criticalAlerts + warningAlerts) > 0 && (
              <Badge variant="destructive" className="ml-2">{criticalAlerts + warningAlerts}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="flex gap-4 items-center">
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Utility Type */}
            <Card>
              <CardHeader>
                <CardTitle>Cost by Utility Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getUtilityBreakdown()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Cost"]} />
                    <Bar dataKey="amount" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getMonthlyTrends()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`]} />
                    <Legend />
                    <Line type="monotone" dataKey="electric" stroke={UTILITY_COLORS.electric} strokeWidth={2} />
                    <Line type="monotone" dataKey="gas" stroke={UTILITY_COLORS.gas} strokeWidth={2} />
                    <Line type="monotone" dataKey="water" stroke={UTILITY_COLORS.water} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Readings by Property */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Readings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {readings?.slice(0, 10).map(reading => {
                  const Icon = UTILITY_ICONS[reading.utility_type] || Zap;
                  return (
                    <div key={reading.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${UTILITY_COLORS[reading.utility_type]}20` }}
                        >
                          <Icon 
                            className="h-5 w-5" 
                            style={{ color: UTILITY_COLORS[reading.utility_type] }} 
                          />
                        </div>
                        <div>
                          <p className="font-medium">
                            {reading.properties?.name || "Unassigned"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {reading.provider} • {reading.bill_date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${reading.amount_due?.toFixed(2)}</p>
                        {reading.usage_amount && (
                          <p className="text-sm text-muted-foreground">
                            {reading.usage_amount} {reading.usage_unit}
                          </p>
                        )}
                        {reading.is_anomaly && (
                          <Badge variant="destructive" className="mt-1">Anomaly</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!readings || readings.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No utility readings yet. Click "Scan Inbox" to import from email.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readings">
          <Card>
            <CardHeader>
              <CardTitle>All Utility Readings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {readings?.map(reading => {
                  const Icon = UTILITY_ICONS[reading.utility_type] || Zap;
                  return (
                    <div key={reading.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${UTILITY_COLORS[reading.utility_type]}20` }}
                        >
                          <Icon 
                            className="h-5 w-5" 
                            style={{ color: UTILITY_COLORS[reading.utility_type] }} 
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{reading.properties?.name || "Unassigned"}</p>
                            <Badge variant="outline">{reading.utility_type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {reading.provider} • Bill Date: {reading.bill_date}
                          </p>
                          {reading.service_period_start && reading.service_period_end && (
                            <p className="text-xs text-muted-foreground">
                              Service: {reading.service_period_start} to {reading.service_period_end}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">${reading.amount_due?.toFixed(2)}</p>
                        {reading.usage_amount && (
                          <p className="text-sm text-muted-foreground">
                            {reading.usage_amount} {reading.usage_unit}
                          </p>
                        )}
                        {reading.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {reading.due_date}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts?.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      alert.severity === "critical" ? "border-destructive bg-destructive/5" : 
                      alert.severity === "warning" ? "border-amber-500 bg-amber-500/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <AlertTriangle 
                        className={`h-5 w-5 ${
                          alert.severity === "critical" ? "text-destructive" : 
                          alert.severity === "warning" ? "text-amber-500" : "text-muted-foreground"
                        }`} 
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{alert.properties?.name}</p>
                          <Badge 
                            variant={alert.severity === "critical" ? "destructive" : "outline"}
                            className={alert.severity === "warning" ? "bg-amber-500 text-white" : ""}
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleResolveAlert(alert.id)}
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
                {(!alerts || alerts.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No active alerts. Your utilities are looking good!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
