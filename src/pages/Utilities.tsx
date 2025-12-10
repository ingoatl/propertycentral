import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Zap, Flame, Droplets, Trash2, Wifi, AlertTriangle, TrendingUp, RefreshCw, Building2, CheckCircle, Info, MapPin, Lightbulb, Clock, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, Area, AreaChart } from "recharts";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
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
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzingProviders, setIsAnalyzingProviders] = useState(false);
  const [alertInfoOpen, setAlertInfoOpen] = useState(false);

  // Fetch ALL Company-Owned properties
  const { data: companyProperties } = useQuery({
    queryKey: ["company-owned-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .eq("property_type", "Company-Owned")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: readings, refetch: refetchReadings, isLoading } = useQuery({
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

  const { data: recommendations, refetch: refetchRecommendations } = useQuery({
    queryKey: ["utility-recommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utility_provider_recommendations")
        .select(`
          *,
          properties:property_id (
            id,
            name,
            address
          )
        `)
        .eq("status", "pending")
        .order("estimated_savings", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleScanInbox = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-utilities-inbox", {
        body: { months: 6 }
      });
      if (error) throw error;
      
      const newReadings = data.newReadings || 0;
      const skipped = data.skippedDuplicates || 0;
      const properties = data.properties || [];
      
      if (newReadings > 0) {
        toast.success(`Scan complete: ${newReadings} new bills added from ${properties.length} properties`);
      } else if (skipped > 0) {
        toast.info(`No new bills found (${skipped} already imported)`);
      } else {
        toast.info("Scan complete. No new bills found.");
      }
      refetchReadings();
    } catch (error: any) {
      console.error("Scan error:", error);
      toast.error("Failed to scan inbox: " + (error.message || "Unknown error"));
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

  const handleAnalyzeProviders = async () => {
    setIsAnalyzingProviders(true);
    try {
      const { data, error } = await supabase.functions.invoke("utility-provider-recommendations");
      if (error) throw error;
      toast.success(`Analysis complete: ${data.recommendationsFound} savings opportunities found`);
      refetchRecommendations();
    } catch (error: any) {
      toast.error("Failed to analyze providers: " + error.message);
    } finally {
      setIsAnalyzingProviders(false);
    }
  };

  const handleDismissRecommendation = async (id: string) => {
    const { error } = await supabase
      .from("utility_provider_recommendations")
      .update({ status: "dismissed" })
      .eq("id", id);
    if (error) {
      toast.error("Failed to dismiss");
    } else {
      toast.success("Recommendation dismissed");
      refetchRecommendations();
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

  // Group readings by property - include ALL Company-Owned properties
  const getPropertiesWithReadings = () => {
    const propertyData: Record<string, {
      property: { id: string; name: string; address: string };
      readings: typeof readings;
      totalSpend: number;
      utilities: Record<string, { latest: any; history: any[] }>;
      monthlyData: Record<string, Record<string, number>>;
    }> = {};

    // Initialize ALL Company-Owned properties first (so they all show even without readings)
    companyProperties?.forEach(prop => {
      propertyData[prop.id] = {
        property: prop,
        readings: [],
        totalSpend: 0,
        utilities: {},
        monthlyData: {},
      };
    });

    // Group readings by property
    readings?.forEach(reading => {
      const propId = reading.property_id || "unassigned";
      
      if (!propertyData[propId]) {
        propertyData[propId] = {
          property: reading.property_id 
            ? (reading.properties as any) 
            : { id: "unassigned", name: "Unassigned Bills", address: "Properties not yet matched" },
          readings: [],
          totalSpend: 0,
          utilities: {},
          monthlyData: {},
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

      // Track monthly data for charts
      const month = reading.bill_date?.substring(0, 7);
      if (month) {
        if (!propertyData[propId].monthlyData[month]) {
          propertyData[propId].monthlyData[month] = {};
        }
        propertyData[propId].monthlyData[month][uType] = 
          (propertyData[propId].monthlyData[month][uType] || 0) + (reading.amount_due || 0);
      }
    });

    return propertyData;
  };

  const propertiesWithReadings = getPropertiesWithReadings();
  
  // Separate assigned and unassigned
  const assignedProperties = Object.entries(propertiesWithReadings).filter(([id]) => id !== "unassigned");
  const unassignedData = propertiesWithReadings["unassigned"];

  // Calculate summary stats
  const totalSpend = readings?.reduce((sum, r) => sum + (r.amount_due || 0), 0) || 0;
  const avgMonthlySpend = readings?.length ? totalSpend / Math.max(1, new Set(readings.map(r => r.bill_date?.substring(0, 7))).size) : 0;
  const criticalAlerts = alerts?.filter(a => a.severity === "critical").length || 0;
  const warningAlerts = alerts?.filter(a => a.severity === "warning").length || 0;
  const unassignedCount = unassignedData?.readings?.length || 0;
  const recommendationsCount = recommendations?.length || 0;
  const totalSavings = recommendations?.reduce((sum, r) => sum + (Number(r.estimated_savings) || 0), 0) || 0;

  // Get chart data for a property
  const getPropertyChartData = (monthlyData: Record<string, Record<string, number>>) => {
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        ...data,
        total: Object.values(data).reduce((sum, val) => sum + val, 0),
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
          <Button variant="outline" onClick={handleAnalyzeProviders} disabled={isAnalyzingProviders}>
            <Lightbulb className={`h-4 w-4 mr-2 ${isAnalyzingProviders ? "animate-pulse" : ""}`} />
            {isAnalyzingProviders ? "Analyzing..." : "Find Savings"}
          </Button>
          <Button variant="outline" onClick={handleRunAnomalyDetection}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Run Detection
          </Button>
          <Button onClick={handleScanInbox} disabled={isScanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning 6 months..." : "Scan Inbox (6 months)"}
          </Button>
        </div>
      </div>

      {/* Automation Status Banner */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Automatic Monitoring Active</p>
                <p className="text-sm text-muted-foreground">
                  Scans run on the 1st and 15th of each month • Anomaly detection • Provider analysis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3" /> 2x/month
                </Badge>
              </div>
              {recommendationsCount > 0 && (
                <Badge variant="default" className="gap-1 bg-green-600">
                  <DollarSign className="h-3 w-3" /> ${totalSavings.toFixed(0)}/mo savings available
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
                <p className="text-sm text-muted-foreground">Properties</p>
                <p className="text-2xl font-bold">{assignedProperties.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alerts</p>
                <p className="text-2xl font-bold text-destructive">{criticalAlerts + warningAlerts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className={unassignedCount > 0 ? "border-orange-500" : ""}>
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
          <TabsTrigger value="properties">Properties ({assignedProperties.length})</TabsTrigger>
          {unassignedCount > 0 && (
            <TabsTrigger value="unassigned">
              Unassigned
              <Badge variant="destructive" className="ml-2">{unassignedCount}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="alerts">
            Alerts
            {(criticalAlerts + warningAlerts) > 0 && (
              <Badge variant="destructive" className="ml-2">{criticalAlerts + warningAlerts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="savings">
            Savings
            {recommendationsCount > 0 && (
              <Badge className="ml-2 bg-green-600">{recommendationsCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading utility data...</div>
          ) : assignedProperties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Utility Data Found</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Scan Inbox (12 months)" to analyze utility bills from the last 12 months.
                </p>
                <Button onClick={handleScanInbox} disabled={isScanning}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
                  {isScanning ? "Scanning..." : "Scan Inbox Now"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Properties with missing utility data warning */}
              {assignedProperties.filter(([, data]) => Object.keys(data.utilities).length === 0).length > 0 && (
                <Card className="border-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          {assignedProperties.filter(([, data]) => Object.keys(data.utilities).length === 0).length} properties have no utility data
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {assignedProperties.filter(([, data]) => Object.keys(data.utilities).length === 0).map(([, d]) => d.property?.name).join(", ")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {assignedProperties.map(([propId, data]) => {
                const chartData = getPropertyChartData(data.monthlyData);
                const utilityTypes = Object.keys(data.utilities);
                const hasNoData = utilityTypes.length === 0;

                return (
                  <Card key={propId} className={hasNoData ? "border-amber-400 opacity-70" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {data.property?.name || "Unknown Property"}
                            {hasNoData && (
                              <Badge variant="outline" className="text-amber-600 border-amber-400">
                                No Data
                              </Badge>
                            )}
                          </CardTitle>
                          {data.property?.address && (
                            <CardDescription>{data.property.address}</CardDescription>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            ${data.totalSpend.toFixed(0)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">Total Spend</p>
                        </div>
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

                      {/* Monthly Cost Chart */}
                      {chartData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="month" className="text-xs" />
                              <YAxis tickFormatter={(v) => `$${v}`} className="text-xs" />
                              <Tooltip 
                                formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, UTILITY_LABELS[name] || name]}
                                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                              <Legend />
                              {utilityTypes.map(uType => (
                                <Area
                                  key={uType}
                                  type="monotone"
                                  dataKey={uType}
                                  name={UTILITY_LABELS[uType]}
                                  stackId="1"
                                  stroke={UTILITY_COLORS[uType]}
                                  fill={UTILITY_COLORS[uType]}
                                  fillOpacity={0.6}
                                />
                              ))}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[100px] flex items-center justify-center border rounded-lg bg-muted/30">
                          <p className="text-sm text-muted-foreground">No utility bills scanned yet for this property</p>
                        </div>
                      )}

                      {/* Recent Bills */}
                      {data.readings && data.readings.length > 0 && (
                        <div className="border-t pt-4">
                          <h4 className="text-sm font-medium mb-2">Recent Bills</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto">
                            {data.readings?.slice(0, 6).map(reading => {
                              const Icon = UTILITY_ICONS[reading.utility_type];
                              return (
                                <div key={reading.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                                  <Icon className="h-4 w-4" style={{ color: UTILITY_COLORS[reading.utility_type] }} />
                                  <span className="flex-1 truncate">{reading.provider}</span>
                                  <span className="font-medium">${reading.amount_due?.toFixed(0)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {reading.bill_date ? format(new Date(reading.bill_date), "MMM d") : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="unassigned" className="space-y-4">
          {unassignedData && unassignedData.readings && unassignedData.readings.length > 0 ? (
            <Card className="border-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <MapPin className="h-5 w-5" />
                  Unassigned Bills ({unassignedData.readings.length})
                </CardTitle>
                <CardDescription>
                  These utility bills could not be matched to a property. Review and manually assign them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {unassignedData.readings.map(reading => {
                    const Icon = UTILITY_ICONS[reading.utility_type];
                    return (
                      <div key={reading.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                        <Icon className="h-5 w-5" style={{ color: UTILITY_COLORS[reading.utility_type] }} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{reading.provider}</span>
                            <Badge variant="outline">{UTILITY_LABELS[reading.utility_type]}</Badge>
                          </div>
                          {reading.account_number && (
                            <p className="text-xs text-muted-foreground">Account: {reading.account_number}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${reading.amount_due?.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {reading.bill_date ? format(new Date(reading.bill_date), "MMM d, yyyy") : "Unknown date"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All Bills Assigned</h3>
                <p className="text-muted-foreground">Every utility bill has been matched to a property.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          {recommendations && recommendations.length > 0 ? (
            recommendations.map((rec: any) => (
              <Card key={rec.id} className="border-green-500">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 mt-0.5 text-green-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{rec.properties?.name || "Property"}</span>
                          <Badge variant="outline">{rec.utility_type?.toUpperCase()}</Badge>
                          <Badge className="bg-green-600">${Number(rec.estimated_savings).toFixed(0)}/mo savings</Badge>
                        </div>
                        <p className="text-sm mt-1">
                          Switch from <span className="font-medium">{rec.current_provider}</span> to{" "}
                          <span className="font-medium text-green-600">{rec.recommended_provider}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDismissRecommendation(rec.id)}>
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">No Savings Opportunities</h3>
                <p className="text-muted-foreground mb-4">Click "Find Savings" to analyze your utility providers.</p>
                <Button onClick={handleAnalyzeProviders} disabled={isAnalyzingProviders}>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  {isAnalyzingProviders ? "Analyzing..." : "Find Savings"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts && alerts.length > 0 ? (
            alerts.map(alert => (
              <Card key={alert.id} className={alert.severity === "critical" ? "border-destructive" : "border-amber-500"}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === "critical" ? "text-destructive" : "text-amber-500"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{alert.properties?.name || "Unknown Property"}</span>
                        <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline">{alert.alert_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.created_at ? format(new Date(alert.created_at), "MMM d, yyyy h:mm a") : ""}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleResolveAlert(alert.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">No Active Alerts</h3>
                <p className="text-muted-foreground">All utility readings are within normal ranges.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Alert Info Dialog */}
      <Dialog open={alertInfoOpen} onOpenChange={setAlertInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How Utility Alerts Work</DialogTitle>
            <DialogDescription>
              The anomaly detection system monitors your utility bills for unusual patterns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Critical Alerts
              </h4>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Usage spike &gt;50% vs previous month</li>
                <li>Cost spike &gt;60% vs same month last year</li>
                <li>Zero usage during occupied period (&gt;14 days)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-amber-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Warning Alerts
              </h4>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Usage spike &gt;30% vs previous month</li>
                <li>Cost spike &gt;40% vs same month last year</li>
                <li>High usage during confirmed vacancy</li>
                <li>Missing bills &gt;45 days since last bill</li>
              </ul>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm">
                <strong>Email Notifications:</strong> When anomalies are detected, an email is sent to{" "}
                <span className="font-mono text-xs">info@peachhausgroup.com</span> with details about the property, 
                utility type, and specific anomaly reason.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
