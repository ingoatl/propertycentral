import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Zap, Flame, Droplets, Trash2, Wifi, AlertTriangle, TrendingUp, RefreshCw, Building2, CheckCircle, Info, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

const UTILITY_LABELS: Record<string, string> = {
  electric: "Electric",
  gas: "Gas",
  water: "Water",
  trash: "Trash",
  internet: "Internet",
  sewer: "Sewer",
};

export default function Utilities() {
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [isScanning, setIsScanning] = useState(false);
  const [alertInfoOpen, setAlertInfoOpen] = useState(false);

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
    queryKey: ["utility-readings"],
    queryFn: async () => {
      const { data, error } = await supabase
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

      if (error) throw error;
      return data;
    },
  });

  const { data: utilityAccounts } = useQuery({
    queryKey: ["utility-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utility_accounts")
        .select(`
          *,
          properties:property_id (
            id,
            name
          )
        `)
        .eq("is_active", true);
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

  // Group readings by property
  const getPropertyUtilityData = () => {
    const propertyData: Record<string, {
      property: { id: string; name: string; address: string } | null;
      readings: typeof readings;
      totalSpend: number;
      utilities: Record<string, { latest: any; history: any[] }>;
    }> = {};

    // Initialize with all managed properties
    properties?.forEach(prop => {
      propertyData[prop.id] = {
        property: prop,
        readings: [],
        totalSpend: 0,
        utilities: {},
      };
    });

    // Add unassigned bucket
    propertyData["unassigned"] = {
      property: null,
      readings: [],
      totalSpend: 0,
      utilities: {},
    };

    // Distribute readings to properties
    readings?.forEach(reading => {
      const propId = reading.property_id || "unassigned";
      if (!propertyData[propId]) {
        propertyData[propId] = {
          property: reading.properties as any,
          readings: [],
          totalSpend: 0,
          utilities: {},
        };
      }

      propertyData[propId].readings?.push(reading);
      propertyData[propId].totalSpend += reading.amount_due || 0;

      // Track by utility type
      const uType = reading.utility_type;
      if (!propertyData[propId].utilities[uType]) {
        propertyData[propId].utilities[uType] = { latest: null, history: [] };
      }
      propertyData[propId].utilities[uType].history.push(reading);
      if (!propertyData[propId].utilities[uType].latest || 
          reading.bill_date > propertyData[propId].utilities[uType].latest.bill_date) {
        propertyData[propId].utilities[uType].latest = reading;
      }
    });

    return propertyData;
  };

  const propertyUtilityData = getPropertyUtilityData();

  // Filter properties based on selection
  const filteredProperties = selectedProperty === "all" 
    ? Object.entries(propertyUtilityData)
    : Object.entries(propertyUtilityData).filter(([id]) => id === selectedProperty);

  // Calculate summary stats
  const totalSpend = readings?.reduce((sum, r) => sum + (r.amount_due || 0), 0) || 0;
  const avgMonthlySpend = readings?.length ? totalSpend / Math.max(1, new Set(readings.map(r => r.bill_date?.substring(0, 7))).size) : 0;
  const criticalAlerts = alerts?.filter(a => a.severity === "critical").length || 0;
  const warningAlerts = alerts?.filter(a => a.severity === "warning").length || 0;
  const unassignedCount = propertyUtilityData["unassigned"]?.readings?.length || 0;

  // Get utility breakdown for pie chart
  const getUtilityBreakdown = () => {
    const breakdown: Record<string, number> = {};
    readings?.forEach(r => {
      breakdown[r.utility_type] = (breakdown[r.utility_type] || 0) + (r.amount_due || 0);
    });
    return Object.entries(breakdown).map(([type, amount]) => ({
      name: UTILITY_LABELS[type] || type,
      value: amount,
      fill: UTILITY_COLORS[type] || "#6b7280",
    }));
  };

  // Get monthly trends across all utilities
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setAlertInfoOpen(true)}>
            <Info className="h-4 w-4 mr-2" />
            How Alerts Work
          </Button>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">${totalSpend.toFixed(0)}</p>
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
                <p className="text-2xl font-bold">${avgMonthlySpend.toFixed(0)}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-2xl font-bold text-orange-500">{unassignedCount}</p>
              </div>
              <MapPin className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties">By Property</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {(criticalAlerts + warningAlerts) > 0 && (
              <Badge variant="destructive" className="ml-2">{criticalAlerts + warningAlerts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="accounts">Utility Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-6">
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
                <SelectItem value="unassigned">⚠️ Unassigned Bills</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Property Cards with Utility Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProperties.map(([propId, data]) => {
              if (propId === "unassigned" && data.readings?.length === 0) return null;
              if (propId !== "unassigned" && Object.keys(data.utilities).length === 0) return null;

              const utilityTypes = Object.keys(data.utilities);
              const pieData = utilityTypes.map(uType => ({
                name: UTILITY_LABELS[uType] || uType,
                value: data.utilities[uType].history.reduce((sum, r) => sum + (r.amount_due || 0), 0),
                fill: UTILITY_COLORS[uType] || "#6b7280",
              }));

              return (
                <Card key={propId} className={propId === "unassigned" ? "border-orange-500" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {propId === "unassigned" ? (
                            <>
                              <MapPin className="h-5 w-5 text-orange-500" />
                              Unassigned Bills
                            </>
                          ) : (
                            data.property?.name || "Unknown Property"
                          )}
                        </CardTitle>
                        {data.property?.address && (
                          <CardDescription>{data.property.address}</CardDescription>
                        )}
                      </div>
                      <Badge variant={propId === "unassigned" ? "destructive" : "secondary"}>
                        ${data.totalSpend.toFixed(0)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Utility Icons with Latest Values */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {["electric", "gas", "water", "internet", "trash", "sewer"].map(uType => {
                        const Icon = UTILITY_ICONS[uType];
                        const utilityData = data.utilities[uType];
                        const hasData = !!utilityData;
                        
                        return (
                          <div 
                            key={uType}
                            className={`flex flex-col items-center p-2 rounded-lg ${
                              hasData ? "bg-muted" : "bg-muted/30 opacity-50"
                            }`}
                          >
                            <Icon 
                              className="h-5 w-5 mb-1" 
                              style={{ color: hasData ? UTILITY_COLORS[uType] : "#9ca3af" }}
                            />
                            <span className="text-xs font-medium">
                              {hasData ? `$${utilityData.latest.amount_due?.toFixed(0)}` : "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {UTILITY_LABELS[uType]}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mini Pie Chart for this property */}
                    {pieData.length > 0 && (
                      <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={60}
                              paddingAngle={2}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Cost"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Recent Bills List */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {data.readings?.slice(0, 5).map(reading => {
                        const Icon = UTILITY_ICONS[reading.utility_type] || Zap;
                        return (
                          <div key={reading.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" style={{ color: UTILITY_COLORS[reading.utility_type] }} />
                              <span>{reading.provider}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-medium">${reading.amount_due?.toFixed(2)}</span>
                              <span className="text-muted-foreground ml-2 text-xs">
                                {reading.bill_date}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredProperties.every(([id, data]) => 
            id === "unassigned" ? data.readings?.length === 0 : Object.keys(data.utilities).length === 0
          ) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No utility readings yet. Click "Scan Inbox" to import from utilities@peachhausgroup.com</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Utility Type */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Distribution by Utility</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getUtilityBreakdown()}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {getUtilityBreakdown().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Cost"]} />
                  </PieChart>
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
                    <Line type="monotone" dataKey="electric" name="Electric" stroke={UTILITY_COLORS.electric} strokeWidth={2} />
                    <Line type="monotone" dataKey="gas" name="Gas" stroke={UTILITY_COLORS.gas} strokeWidth={2} />
                    <Line type="monotone" dataKey="water" name="Water" stroke={UTILITY_COLORS.water} strokeWidth={2} />
                    <Line type="monotone" dataKey="internet" name="Internet" stroke={UTILITY_COLORS.internet} strokeWidth={2} />
                    <Line type="monotone" dataKey="trash" name="Trash" stroke={UTILITY_COLORS.trash} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Property Cost Comparison Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart 
                  data={Object.entries(propertyUtilityData)
                    .filter(([id, d]) => id !== "unassigned" && d.totalSpend > 0)
                    .map(([id, d]) => ({
                      name: d.property?.name?.split(" ").slice(0, 2).join(" ") || "Unknown",
                      total: d.totalSpend,
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10)
                  }
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Total Cost"]} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                Anomalies detected by the system that require attention
              </CardDescription>
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
                          <p className="font-medium">{alert.properties?.name || "Unknown Property"}</p>
                          <Badge variant="outline">{alert.alert_type}</Badge>
                          <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(alert.created_at), "PPp")}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleResolveAlert(alert.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve
                    </Button>
                  </div>
                ))}
                {(!alerts || alerts.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No active alerts. System is monitoring for anomalies.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Utility Accounts by Property</CardTitle>
              <CardDescription>
                Track which utilities are set up for each property
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {properties?.map(prop => {
                  const propAccounts = utilityAccounts?.filter(a => a.property_id === prop.id) || [];
                  return (
                    <div key={prop.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-medium">{prop.name}</p>
                          <p className="text-sm text-muted-foreground">{prop.address}</p>
                        </div>
                        <Badge variant="outline">{propAccounts.length} accounts</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["electric", "gas", "water", "internet", "trash", "sewer"].map(uType => {
                          const account = propAccounts.find(a => a.utility_type === uType);
                          const Icon = UTILITY_ICONS[uType];
                          return (
                            <div
                              key={uType}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                account ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {UTILITY_LABELS[uType]}
                              {account && <CheckCircle className="h-3 w-3" />}
                            </div>
                          );
                        })}
                      </div>
                      {propAccounts.length > 0 && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          {propAccounts.map(a => (
                            <span key={a.id} className="mr-3">
                              {a.provider}: {a.account_number}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alert Info Dialog */}
      <Dialog open={alertInfoOpen} onOpenChange={setAlertInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How Alerts Work</DialogTitle>
            <DialogDescription>
              The system automatically monitors utility consumption and flags anomalies
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="font-medium text-destructive mb-1">🔴 Critical Alerts</p>
              <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Usage spike &gt;50% vs previous month</li>
                <li>Cost spike &gt;75% vs same month last year</li>
                <li>High usage during confirmed vacancy (potential leak)</li>
              </ul>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <p className="font-medium text-amber-600 mb-1">🟡 Warning Alerts</p>
              <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Usage spike 30-50% vs previous month</li>
                <li>Cost spike 40-75% vs same month last year</li>
                <li>Missing bill &gt;45 days since last bill</li>
                <li>Zero usage during occupied period</li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">📧 Email Notifications</p>
              <p className="text-muted-foreground">
                When anomalies are detected, an email is automatically sent to <strong>info@peachhausgroup.com</strong> with:
              </p>
              <ul className="text-muted-foreground space-y-1 ml-4 list-disc mt-2">
                <li>Property name and address</li>
                <li>Utility type and provider</li>
                <li>Current vs expected values</li>
                <li>Recommended action</li>
              </ul>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">⏰ Detection Schedule</p>
              <p className="text-muted-foreground">
                Run manually via "Run Detection" button, or schedule a daily cron job for automatic monitoring.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}