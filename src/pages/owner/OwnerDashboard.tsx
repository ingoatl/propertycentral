import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Receipt,
  FileText,
  Download,
  Home,
  LogOut,
  RefreshCw,
  Key,
  Wifi,
  Lock,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  BarChart3,
  Users,
  Sparkles,
  Star,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { OwnerReceiptsTab } from "./components/OwnerReceiptsTab";
import { OwnerBookingsTab } from "./components/OwnerBookingsTab";
import { OwnerPerformanceCharts } from "./components/OwnerPerformanceCharts";
import { OwnerPerformanceOverview } from "./components/OwnerPerformanceOverview";
import { OwnerReviewsCard } from "./components/OwnerReviewsCard";
import { OwnerMarketInsightsEnhanced } from "./components/OwnerMarketInsightsEnhanced";

interface OwnerSession {
  ownerId: string;
  ownerName: string;
  email: string;
  propertyId?: string;
  propertyName?: string;
}

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  status: string;
  short_term_revenue?: number;
  mid_term_revenue?: number;
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  purpose: string | null;
  vendor: string | null;
  category: string | null;
  file_path: string | null;
  original_receipt_path: string | null;
  email_screenshot_path: string | null;
}

interface PropertyData {
  id: string;
  name: string;
  address: string;
  rental_type: string | null;
  image_path: string | null;
}

interface Credential {
  id: string;
  service_name: string;
  username: string | null;
  password: string | null;
  url: string | null;
  notes: string | null;
}

interface Review {
  id: string;
  guestName: string | null;
  rating: number;
  text: string;
  date: string;
  source: string;
}

interface PerformanceMetrics {
  totalRevenue: number;
  strRevenue: number;
  mtrRevenue: number;
  totalBookings: number;
  strBookings: number;
  mtrBookings: number;
  occupancyRate: number;
  averageRating: number | null;
  reviewCount: number;
}

interface MarketInsightsData {
  property: any;
  performance: PerformanceMetrics;
  reviews: Review[];
  monthlyRevenue: any[];
  aiInsights: {
    comparableProperties: any[];
    marketMetrics: {
      areaOccupancy: number;
      avgNightlyRate: number;
      yoyGrowth: number;
      marketTrend: "rising" | "stable" | "declining";
    };
    futureOpportunities: any[];
    demandDrivers: any[];
    strengthsForArea: string[];
  };
  generatedAt: string;
}

export default function OwnerDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    totalRevenue: 0,
    strRevenue: 0,
    mtrRevenue: 0,
    totalBookings: 0,
    strBookings: 0,
    mtrBookings: 0,
    occupancyRate: 0,
    averageRating: null,
    reviewCount: 0,
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [marketInsights, setMarketInsights] = useState<MarketInsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsProgress, setInsightsProgress] = useState(0);
  const [insightsStep, setInsightsStep] = useState("Initializing...");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setSessionToken(token);
      loadAllDataWithToken(token);
    } else {
      const storedSession = localStorage.getItem("owner_session");
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          const expiresAt = new Date(parsed.expiresAt);
          if (expiresAt > new Date()) {
            setSession(parsed);
            setSessionToken(parsed.token || null);
            loadAllData(parsed.ownerId, parsed.propertyId);
          } else {
            localStorage.removeItem("owner_session");
            setLoading(false);
          }
        } catch {
          localStorage.removeItem("owner_session");
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [searchParams]);

  const loadAllDataWithToken = async (token: string) => {
    try {
      console.log("Loading all data with token...");
      
      const { data, error } = await supabase.functions.invoke("owner-portal-data", {
        body: { token },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Invalid or expired link. Please request a new one.");
        setLoading(false);
        return;
      }

      if (data.error) {
        console.error("Data error:", data.error);
        toast.error(data.error);
        setLoading(false);
        return;
      }

      console.log("Owner portal data loaded:", data);

      // Set all the state from the response
      const ownerSession: OwnerSession = {
        ownerId: data.owner.id,
        ownerName: data.owner.name,
        email: data.owner.email,
        propertyId: data.property?.id,
        propertyName: data.property?.name,
      };

      const sessionData = {
        ...ownerSession,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      localStorage.setItem("owner_session", JSON.stringify(sessionData));
      
      setSession(ownerSession);
      setProperty(data.property);
      setStatements(data.statements || []);
      setExpenses(data.expenses || []);
      setCredentials(data.credentials || []);
      setReviews(data.reviews || []);
      setPerformanceMetrics(data.performance || {
        totalRevenue: 0,
        strRevenue: 0,
        mtrRevenue: 0,
        totalBookings: 0,
        strBookings: 0,
        mtrBookings: 0,
        occupancyRate: 0,
        averageRating: null,
        reviewCount: 0,
      });

      navigate("/owner", { replace: true });
      toast.success("Welcome to your owner portal!");

      // Load AI market insights separately
      if (data.property?.id) {
        loadMarketInsights(data.property.id);
      }
    } catch (err) {
      console.error("Error loading data with token:", err);
      toast.error("Failed to load your data");
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (ownerId: string, propertyId?: string) => {
    try {
      console.log("Loading all data for owner:", ownerId, "property:", propertyId);
      
      const { data, error } = await supabase.functions.invoke("owner-portal-data", {
        body: { ownerId, propertyId },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Failed to load your data");
        setLoading(false);
        return;
      }

      if (data.error) {
        console.error("Data error:", data.error);
        toast.error(data.error);
        setLoading(false);
        return;
      }

      console.log("Owner portal data loaded:", data);

      setProperty(data.property);
      setStatements(data.statements || []);
      setExpenses(data.expenses || []);
      setCredentials(data.credentials || []);
      setReviews(data.reviews || []);
      setPerformanceMetrics(data.performance || {
        totalRevenue: 0,
        strRevenue: 0,
        mtrRevenue: 0,
        totalBookings: 0,
        strBookings: 0,
        mtrBookings: 0,
        occupancyRate: 0,
        averageRating: null,
        reviewCount: 0,
      });

      // Load AI market insights separately
      if (data.property?.id) {
        loadMarketInsights(data.property.id);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Failed to load your data");
    } finally {
      setLoading(false);
    }
  };

  const loadMarketInsights = async (propertyId: string) => {
    setLoadingInsights(true);
    setInsightsProgress(0);
    setInsightsStep("Analyzing market data...");
    
    // Simulate progress steps
    const progressInterval = setInterval(() => {
      setInsightsProgress(prev => {
        if (prev >= 90) return prev;
        const step = prev < 30 ? 30 : prev < 60 ? 60 : 80;
        if (prev < 30) setInsightsStep("Generating comparables...");
        else if (prev < 60) setInsightsStep("Analyzing demand drivers...");
        else setInsightsStep("Creating insights...");
        return step;
      });
    }, 800);

    try {
      const { data, error } = await supabase.functions.invoke("generate-market-insights", {
        body: { propertyId },
      });

      if (error) {
        console.error("Error loading market insights:", error);
        return;
      }

      setInsightsProgress(100);
      setInsightsStep("Complete!");
      setMarketInsights(data);
    } catch (err) {
      console.error("Error loading market insights:", err);
    } finally {
      clearInterval(progressInterval);
      setLoadingInsights(false);
    }
  };

  const downloadStatement = async (statement: Statement) => {
    setDownloadingPdf(statement.id);
    try {
      // Use edge function to bypass RLS
      const { data, error } = await supabase.functions.invoke("owner-statement-pdf", {
        body: { reconciliationId: statement.id, token: sessionToken },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      window.open(data.signedUrl, "_blank");
      toast.success("Statement opened");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download statement");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("owner_session");
    setSession(null);
    toast.success("Logged out successfully");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Get property image URL
  const getPropertyImageUrl = () => {
    if (!property?.image_path) return null;
    
    // If it's already a full URL, use it directly
    if (property.image_path.startsWith('http')) {
      return property.image_path;
    }
    
    // Otherwise, get from Supabase storage
    const { data } = supabase.storage
      .from("property-images")
      .getPublicUrl(property.image_path);
    
    return data?.publicUrl;
  };

  const propertyImageUrl = getPropertyImageUrl();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Home className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Owner Portal</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Access your property dashboard through the secure link in your monthly statement email.
            </p>
            <p className="text-sm text-muted-foreground">
              Don't have a link? Contact us at{" "}
              <a href="mailto:info@peachhausgroup.com" className="text-primary underline font-medium">
                info@peachhausgroup.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestStatement = statements[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Hero Header with Property Image */}
      <header className="relative">
        {propertyImageUrl && (
          <div className="absolute inset-0 h-64 md:h-80">
            <img
              src={propertyImageUrl}
              alt={property?.name || "Property"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
          </div>
        )}
        
        <div className={`relative ${propertyImageUrl ? 'pt-8 pb-32 md:pb-40' : 'py-6'} bg-gradient-to-br from-primary/10 to-primary/5`}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/90 dark:bg-background/90 backdrop-blur flex items-center justify-center shadow-lg">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className={propertyImageUrl ? 'text-white' : ''}>
                  <h1 className="font-bold text-2xl md:text-3xl">{property?.name || "Your Property"}</h1>
                  <div className="flex items-center gap-2 text-sm opacity-90">
                    <MapPin className="h-4 w-4" />
                    {property?.address}
                  </div>
                </div>
              </div>
              <Button 
                variant={propertyImageUrl ? "secondary" : "ghost"} 
                size="sm" 
                onClick={handleLogout} 
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
            
            <div className={`mt-4 ${propertyImageUrl ? 'text-white/90' : 'text-muted-foreground'}`}>
              <p className="text-lg">Welcome back, {session.ownerName}</p>
              {performanceMetrics.averageRating && (
                <div className="flex items-center gap-2 mt-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{performanceMetrics.averageRating.toFixed(1)}</span>
                  <span className="text-sm">({performanceMetrics.reviewCount} reviews)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 -mt-16 md:-mt-20 relative z-10">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-background/95 backdrop-blur shadow-lg border p-1 h-auto flex-wrap">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Market Insights</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="statements" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Statements</span>
            </TabsTrigger>
            <TabsTrigger value="receipts" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Receipts</span>
            </TabsTrigger>
            <TabsTrigger value="property" className="gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Property</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-8">
              {/* Performance Overview */}
              <OwnerPerformanceOverview 
                metrics={performanceMetrics}
                propertyName={property?.name}
              />

              {/* Performance Charts */}
              <OwnerPerformanceCharts statements={statements} propertyName={property?.name} />

              {/* Reviews Section */}
              {reviews.length > 0 && (
                <OwnerReviewsCard
                  reviews={reviews}
                  averageRating={performanceMetrics.averageRating}
                  reviewCount={performanceMetrics.reviewCount}
                  propertyName={property?.name}
                />
              )}

              {/* Latest Statement Quick View */}
              {latestStatement && (
                <Card className="border-none shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      Latest Statement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                      <div>
                        <p className="text-xl font-bold">
                          {format(new Date(latestStatement.reconciliation_month), "MMMM yyyy")}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Revenue: {formatCurrency(latestStatement.total_revenue || 0)}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-medium">
                            Net: {formatCurrency(latestStatement.net_to_owner || 0)}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => downloadStatement(latestStatement)}
                        disabled={downloadingPdf === latestStatement.id}
                        className="gap-2"
                      >
                        {downloadingPdf === latestStatement.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="insights">
            {loadingInsights ? (
              <OwnerMarketInsightsEnhanced
                propertyName={property?.name || "Your Property"}
                propertyBeds={5}
                propertyBaths={3}
                currentOccupancy={0}
                avgMonthlyRevenue={0}
                comparables={[]}
                marketMetrics={{ areaOccupancy: 0, avgNightlyRate: 0, yoyGrowth: 0, marketTrend: "stable" }}
                opportunities={[]}
                demandDrivers={[]}
                strengthsForArea={[]}
                generatedAt=""
                isLoading={true}
                loadingProgress={insightsProgress}
                loadingStep={insightsStep}
              />
            ) : marketInsights?.aiInsights ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Market Research & Insights</h2>
                    <p className="text-sm text-muted-foreground">
                      AI-powered analysis • Last updated: {marketInsights.generatedAt ? format(new Date(marketInsights.generatedAt), "MMM d, yyyy h:mm a") : "Just now"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => property && loadMarketInsights(property.id)}
                    disabled={loadingInsights}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingInsights ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                <OwnerMarketInsightsEnhanced
                  propertyName={property?.name || "Your Property"}
                  propertyBeds={marketInsights.property?.bedrooms || 5}
                  propertyBaths={marketInsights.property?.bathrooms || 3}
                  currentNightlyRate={property?.rental_type === 'hybrid' ? 280 : undefined}
                  currentOccupancy={performanceMetrics.occupancyRate}
                  avgMonthlyRevenue={marketInsights.monthlyRevenue.length > 0 
                    ? marketInsights.monthlyRevenue.reduce((sum: number, m: any) => sum + (m.total || m.revenue || 0), 0) / marketInsights.monthlyRevenue.length
                    : 0}
                  comparables={marketInsights.aiInsights.comparableProperties || []}
                  marketMetrics={marketInsights.aiInsights.marketMetrics || {
                    areaOccupancy: 75,
                    avgNightlyRate: 280,
                    yoyGrowth: 5,
                    marketTrend: "stable"
                  }}
                  opportunities={marketInsights.aiInsights.futureOpportunities || []}
                  demandDrivers={marketInsights.aiInsights.demandDrivers || []}
                  strengthsForArea={marketInsights.aiInsights.strengthsForArea || []}
                  generatedAt={marketInsights.generatedAt}
                  isLoading={false}
                  loadingProgress={100}
                  loadingStep=""
                />
              </div>
            ) : (
              <Card className="border-none shadow-lg">
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Market insights not available</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => property && loadMarketInsights(property.id)}
                  >
                    Generate Insights
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="bookings">
            {property && <OwnerBookingsTab propertyId={property.id} />}
          </TabsContent>

          <TabsContent value="statements">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Statement History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statements.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No statements available yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {statements.map((statement) => (
                      <div
                        key={statement.id}
                        className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-semibold">
                              {format(new Date(statement.reconciliation_month), "MMMM yyyy")}
                            </p>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span>Revenue: {formatCurrency(statement.total_revenue || 0)}</span>
                              <span>•</span>
                              <span className="text-emerald-600">Net: {formatCurrency(statement.net_to_owner || 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="capitalize">
                            {statement.status.replace(/_/g, " ")}
                          </Badge>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => downloadStatement(statement)}
                            disabled={downloadingPdf === statement.id}
                          >
                            {downloadingPdf === statement.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts">
            {property && <OwnerReceiptsTab expenses={expenses} propertyId={property.id} />}
          </TabsContent>

          <TabsContent value="property">
            <div className="grid gap-6">
              {/* Property Address Card */}
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/30 rounded-xl">
                      <p className="text-sm text-muted-foreground mb-1">Address</p>
                      <p className="font-semibold text-lg">{property?.address}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <p className="text-sm text-muted-foreground mb-1">Property Name</p>
                        <p className="font-semibold">{property?.name}</p>
                      </div>
                      {property?.rental_type && (
                        <div className="p-4 bg-muted/30 rounded-xl">
                          <p className="text-sm text-muted-foreground mb-1">Rental Type</p>
                          <Badge variant="secondary" className="mt-1">
                            {property.rental_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credentials Card */}
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Access & Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {credentials.length === 0 ? (
                    <div className="py-12 text-center">
                      <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">
                        No credentials on file. Contact your property manager to add WiFi, lock codes, and other access information.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {credentials.map((cred) => (
                        <div key={cred.id} className="border rounded-xl p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                cred.service_name.toLowerCase().includes('wifi') 
                                  ? 'bg-blue-100 text-blue-600' 
                                  : cred.service_name.toLowerCase().includes('lock') || 
                                    cred.service_name.toLowerCase().includes('door') ||
                                    cred.service_name.toLowerCase().includes('gate')
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'bg-muted text-muted-foreground'
                              }`}>
                                {cred.service_name.toLowerCase().includes('wifi') ? (
                                  <Wifi className="h-5 w-5" />
                                ) : cred.service_name.toLowerCase().includes('lock') || 
                                   cred.service_name.toLowerCase().includes('door') ||
                                   cred.service_name.toLowerCase().includes('gate') ? (
                                  <Lock className="h-5 w-5" />
                                ) : (
                                  <Key className="h-5 w-5" />
                                )}
                              </div>
                              <span className="font-semibold">{cred.service_name}</span>
                            </div>
                            {cred.url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(cred.url!, '_blank')}
                                className="gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid gap-3">
                            {cred.username && (
                              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-0.5">Username / Network</p>
                                  <p className="font-mono font-medium">{cred.username}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => copyToClipboard(cred.username!, 'Username')}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            
                            {cred.password && (
                              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-0.5">Password / Code</p>
                                  <p className="font-mono font-medium">
                                    {visiblePasswords.has(cred.id) ? cred.password : '••••••••'}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => togglePasswordVisibility(cred.id)}
                                  >
                                    {visiblePasswords.has(cred.id) ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => copyToClipboard(cred.password!, 'Password')}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {cred.notes && (
                              <p className="text-sm text-muted-foreground px-1">{cred.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            PeachHaus Group LLC • Questions? Email{" "}
            <a href="mailto:info@peachhausgroup.com" className="text-primary underline font-medium">
              info@peachhausgroup.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
