import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Wrench,
  Shield,
  Megaphone,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { OwnerReceiptsTab } from "./components/OwnerReceiptsTab";
import { OwnerBookingsTab } from "./components/OwnerBookingsTab";
import { OwnerPerformanceCharts } from "./components/OwnerPerformanceCharts";
import { OwnerPerformanceOverview } from "./components/OwnerPerformanceOverview";
import { OwnerReviewsCard } from "./components/OwnerReviewsCard";
import { OwnerMarketInsightsEnhanced } from "./components/OwnerMarketInsightsEnhanced";
import { OwnerPropertyTab } from "./components/OwnerPropertyTab";
import { OwnerRevenueForecast } from "./components/OwnerRevenueForecast";
import { EnhancedEventsTimeline } from "./components/EnhancedEventsTimeline";
import { StatementViewer } from "./components/StatementViewer";
import { OwnerOnboardingTimeline } from "./components/OwnerOnboardingTimeline";
import { GenerateDashboardPdfButton } from "./components/GenerateDashboardPdfButton";
import { OwnerMessagesTab } from "./components/OwnerMessagesTab";
import { OwnerMaintenanceTab } from "./components/OwnerMaintenanceTab";
import { OwnerGuestScreeningsTab } from "./components/OwnerGuestScreeningsTab";
import { OwnerMarketingTab } from "./components/OwnerMarketingTab";
import { ScheduleOwnerCallModal } from "./components/ScheduleOwnerCallModal";
import { ContactPeachHausDropdown } from "./components/ContactPeachHausDropdown";
import { AudioPropertySummary } from "./components/AudioPropertySummary";
import demoPropertyImage from "@/assets/demo-property-rita-way.jpg";

interface OwnerSession {
  ownerId: string;
  ownerName: string;
  email: string;
  propertyId?: string;
  propertyName?: string;
  secondOwnerName?: string | null;
  secondOwnerEmail?: string | null;
}

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  actual_net_earnings?: number; // Calculated correctly based on service type
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
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  max_guests?: number;
  amenities?: string[];
  onboarding_stage?: string | null;
  website_url?: string | null;
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
  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [bookings, setBookings] = useState<{ str: any[]; mtr: any[] } | null>(null);
  const [guestScreenings, setGuestScreenings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<any[]>([]);
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
  const [viewingStatement, setViewingStatement] = useState<Statement | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [marketInsights, setMarketInsights] = useState<MarketInsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsProgress, setInsightsProgress] = useState(0);
  const [insightsStep, setInsightsStep] = useState("Initializing...");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [revenueBreakdown, setRevenueBreakdown] = useState<any>(null);
  const [showScheduleCallModal, setShowScheduleCallModal] = useState(false);
  const [marketingStats, setMarketingStats] = useState<any[]>([]);
  const [peachHausData, setPeachHausData] = useState<any>(null);
  
  // Session stability & refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [dataStale, setDataStale] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityRef = useRef(true);

  // Stale-while-revalidate: Keep showing data but indicate refresh is happening
  const refreshData = useCallback(async (showToast = false) => {
    if (!session?.ownerId) return;
    
    setIsRefreshing(true);
    console.log("Refreshing dashboard data...");
    
    try {
      const { data, error } = await supabase.functions.invoke("owner-portal-data", {
        body: { ownerId: session.ownerId, propertyId: session.propertyId },
      });

      if (error || data?.error) {
        console.error("Refresh error:", error || data?.error);
        // Don't clear data on error - stale-while-revalidate pattern
        setDataStale(true);
        return;
      }

      // Update all state with fresh data
      setProperty(data.property);
      setStatements(data.statements || []);
      setExpenses(data.expenses || []);
      setCredentials(data.credentials || []);
      setBookings(data.bookings || null);
      setGuestScreenings(data.guestScreenings || []);
      setReviews(data.reviews || []);
      setMonthlyRevenueData(data.monthlyRevenue || []);
      setPerformanceMetrics(data.performance || performanceMetrics);
      setRevenueBreakdown(data.revenueBreakdown || null);
      setMarketingStats(data.marketingStats || []);
      setPeachHausData(data.peachHausData || null);
      setLastRefresh(new Date());
      setDataStale(false);
      
      if (showToast) {
        toast.success("Dashboard refreshed");
      }
    } catch (err) {
      console.error("Refresh failed:", err);
      setDataStale(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [session?.ownerId, session?.propertyId, performanceMetrics]);

  // Handle visibility changes - refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !visibilityRef.current) {
        console.log("Tab became visible, checking if refresh needed...");
        const timeSinceRefresh = Date.now() - lastRefresh.getTime();
        // If more than 5 minutes since last refresh, refresh data
        if (timeSinceRefresh > 5 * 60 * 1000) {
          refreshData();
        }
      }
      visibilityRef.current = document.visibilityState === 'visible';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lastRefresh, refreshData]);

  // Auto-refresh every 10 minutes while active
  useEffect(() => {
    if (session) {
      refreshIntervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refreshData();
        }
      }, 10 * 60 * 1000); // 10 minutes
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [session, refreshData]);

  useEffect(() => {
    const token = searchParams.get("token");
    const ownerIdParam = searchParams.get("owner");
    
    // Demo owner ID - always allow direct access without authentication
    const DEMO_OWNER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const DEMO_PROPERTY_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    
    // Check if this is the demo portal - set up session immediately for instant access
    const isDemo = ownerIdParam === DEMO_OWNER_ID;
    
    if (isDemo) {
      console.log("Demo portal detected - initializing immediately");
      // Set demo session and admin access immediately to prevent any flash of "no access"
      setIsAdminAccess(true);
      setSession({
        ownerId: DEMO_OWNER_ID,
        ownerName: "Sara Thompson",
        email: "sara.thompson@demo.com",
        propertyId: DEMO_PROPERTY_ID,
        propertyName: "3069 Rita Way Retreat",
        secondOwnerName: "Michael Thompson",
        secondOwnerEmail: "michael.thompson@demo.com",
      });
      // Load data in the background - don't block the UI
      loadAllData(DEMO_OWNER_ID, null).catch(err => {
        console.error("Demo data load error:", err);
        // For demo, we can still show the UI even if data load fails
        setLoading(false);
      });
    } else if (token) {
      setSessionToken(token);
      loadAllDataWithToken(token);
    } else if (ownerIdParam) {
      // Admin access - load data directly by owner ID (no token required)
      console.log("Admin access mode - loading owner:", ownerIdParam);
      setIsAdminAccess(true);
      loadAllData(ownerIdParam, null);
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
        secondOwnerName: data.owner.secondOwnerName,
        secondOwnerEmail: data.owner.secondOwnerEmail,
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
      setBookings(data.bookings || null);
      setGuestScreenings(data.guestScreenings || []);
      setReviews(data.reviews || []);
      setMonthlyRevenueData(data.monthlyRevenue || []);
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
      setRevenueBreakdown(data.revenueBreakdown || null);
      setMarketingStats(data.marketingStats || []);
      setPeachHausData(data.peachHausData || null);

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

  const loadAllData = async (ownerId: string, propertyId?: string | null) => {
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

      // Set session from data (for admin access mode)
      if (data.owner) {
        const ownerSession: OwnerSession = {
          ownerId: data.owner.id,
          ownerName: data.owner.name,
          email: data.owner.email,
          propertyId: data.property?.id,
          propertyName: data.property?.name,
          secondOwnerName: data.owner.secondOwnerName,
          secondOwnerEmail: data.owner.secondOwnerEmail,
        };
        setSession(ownerSession);
      }

      setProperty(data.property);
      setStatements(data.statements || []);
      setExpenses(data.expenses || []);
      setCredentials(data.credentials || []);
      setBookings(data.bookings || null);
      setGuestScreenings(data.guestScreenings || []);
      setReviews(data.reviews || []);
      setMonthlyRevenueData(data.monthlyRevenue || []);
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
      setRevenueBreakdown(data.revenueBreakdown || null);
      setMarketingStats(data.marketingStats || []);
      setPeachHausData(data.peachHausData || null);

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
    setInsightsStep("Connecting to market data sources...");
    
    // Get property rental type to customize loading steps
    const isMTR = property?.rental_type === 'mid_term';
    
    // Detailed progress steps with value descriptions - customized by property type
    const progressSteps = isMTR ? [
      { progress: 8, step: "Connecting to corporate housing databases...", detail: "Accessing relocation & travel nurse platforms" },
      { progress: 15, step: "Analyzing your property's performance...", detail: "Reviewing MTR booking history & revenue" },
      { progress: 22, step: "Scanning comparable furnished rentals...", detail: "Finding similar corporate housing in your area" },
      { progress: 30, step: "Evaluating Fortune 500 relocation trends...", detail: "Home Depot, Delta, Coca-Cola, UPS data" },
      { progress: 38, step: "Analyzing healthcare traveler demand...", detail: "Travel nurse placement data from 60+ Atlanta hospitals" },
      { progress: 45, step: "Reviewing insurance placement trends...", detail: "Storm season & family displacement housing" },
      { progress: 52, step: "Gathering corporate project timelines...", detail: "Major construction & consulting assignments" },
      { progress: 60, step: "Analyzing university rotation schedules...", detail: "Medical residency & internship housing demand" },
      { progress: 68, step: "Evaluating extended stay pricing...", detail: "Optimal monthly rates for your market" },
      { progress: 75, step: "Generating AI-powered insights...", detail: "Custom recommendations for corporate housing" },
      { progress: 82, step: "Preparing partnership strategies...", detail: "Relocation companies & insurance adjusters" },
      { progress: 88, step: "Finalizing your personalized report...", detail: "This corporate housing data is worth $500+" },
    ] : [
      { progress: 8, step: "Connecting to market data sources...", detail: "Accessing real-time rental market APIs" },
      { progress: 15, step: "Analyzing your property's performance...", detail: "Reviewing your revenue and booking history" },
      { progress: 22, step: "Scanning 50+ comparable rentals...", detail: "Finding properties similar to yours within 5 miles" },
      { progress: 30, step: "Gathering occupancy data from AirDNA...", detail: "Premium market intelligence data" },
      { progress: 38, step: "Analyzing seasonal rate trends...", detail: "Historical pricing patterns in your area" },
      { progress: 45, step: "Identifying major events & demand drivers...", detail: "Sports, concerts, festivals, corporate travel" },
      { progress: 52, step: "Researching World Cup 2026 impact...", detail: "Atlanta is a host city - massive demand expected" },
      { progress: 60, step: "Evaluating corporate housing demand...", detail: "Fortune 500 relocation & travel data" },
      { progress: 68, step: "Analyzing insurance placement trends...", detail: "Storm season & displacement housing needs" },
      { progress: 75, step: "Generating AI-powered insights...", detail: "Custom recommendations for your property" },
      { progress: 82, step: "Preparing revenue optimization tips...", detail: "Pricing strategies to maximize earnings" },
      { progress: 88, step: "Finalizing your personalized report...", detail: "This data is worth $500+ from market research firms" },
    ];
    
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setInsightsProgress(progressSteps[stepIndex].progress);
        setInsightsStep(progressSteps[stepIndex].step);
        stepIndex++;
      }
    }, 1800); // Slower 1.8 second intervals

    try {
      const { data, error } = await supabase.functions.invoke("generate-market-insights", {
        body: { propertyId },
      });

      clearInterval(progressInterval);

      if (error) {
        console.error("Error loading market insights:", error);
        setInsightsStep("Failed to generate insights");
        return;
      }

      // Smoothly complete to 100%
      setInsightsProgress(95);
      setInsightsStep("Almost there...");
      await new Promise(resolve => setTimeout(resolve, 500));
      setInsightsProgress(100);
      setInsightsStep("Complete! Your insights are ready.");
      await new Promise(resolve => setTimeout(resolve, 300));
      setMarketInsights(data);
    } catch (err) {
      console.error("Error loading market insights:", err);
      setInsightsStep("Failed to generate insights");
    } finally {
      clearInterval(progressInterval);
      setLoadingInsights(false);
    }
  };

  // Open statement in inline viewer instead of window.open (avoids ad blocker issues)
  const openStatementViewer = (statement: Statement) => {
    setViewingStatement(statement);
  };

  // Fetch statement PDF - returns data needed by StatementViewer
  const fetchStatementPdf = async (statementId: string) => {
    const { data, error } = await supabase.functions.invoke("owner-statement-pdf", {
      body: { reconciliationId: statementId, token: sessionToken },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return {
      signedUrl: data.signedUrl,
      pdfBase64: data.pdfBase64,
    };
  };

  // Legacy download function - still used for direct downloads
  const downloadStatement = async (statement: Statement) => {
    setDownloadingPdf(statement.id);
    try {
      const data = await fetchStatementPdf(statement.id);

      // Handle signed URL - fetch as blob to avoid browser blocking
      if (data.signedUrl) {
        try {
          const response = await fetch(data.signedUrl);
          if (!response.ok) throw new Error("Failed to fetch PDF");
          
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          // Create download link
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = `statement-${statement.reconciliation_month}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Cleanup after a delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          toast.success("Statement downloaded");
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          toast.error("Failed to download statement");
        }
        return;
      }

      // Handle base64 data fallback
      if (data.pdfBase64) {
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `statement-${statement.reconciliation_month}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Statement downloaded");
        return;
      }

      toast.error("No statement data received");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download statement");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem("owner_session");
    setSession(null);
    toast.success("Logged out successfully");
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }, []);

  const togglePasswordVisibility = useCallback((id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  // Memoize property image URL to prevent recalculation
  const propertyImageUrl = useMemo(() => {
    // Special case for demo property - use bundled image
    if (property?.id === 'b2c3d4e5-f6a7-8901-bcde-f12345678901') {
      return demoPropertyImage;
    }
    
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
  }, [property?.image_path, property?.id]);

  // For demo mode with session already set, don't block with loading screen - show dashboard with loading indicator
  const isDemoWithSession = isAdminAccess && session?.ownerId === "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  
  if (loading && !isDemoWithSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center p-8">
          {/* Animated Logo - wider display */}
          <div className="animate-fade-in">
            <img 
              src="/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="w-48 h-auto max-h-24 object-contain drop-shadow-lg"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">PeachHaus Owner Portal</h2>
            <div className="flex items-center gap-2 justify-center text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <p>Loading your dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session && !isAdminAccess) {
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

  // If still no session after loading in admin mode, show error
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl border-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-lg">
              <AlertCircle className="h-8 w-8 text-destructive-foreground" />
            </div>
            <CardTitle className="text-2xl">Owner Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Could not load data for this owner. The owner may not exist or may not have any active properties.
            </p>
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
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
              <div className="flex items-center gap-2 flex-wrap">
                {session && (
                  <ContactPeachHausDropdown
                    ownerId={session.ownerId}
                    ownerName={session.ownerName}
                    ownerEmail={session.email}
                    propertyId={property?.id}
                    propertyName={property?.name}
                    onScheduleCall={() => setShowScheduleCallModal(true)}
                    variant={propertyImageUrl ? "outline" : "outline"}
                  />
                )}
                {session && property && (
                  <GenerateDashboardPdfButton
                    ownerId={session.ownerId}
                    propertyId={property.id}
                    propertyName={property.name}
                    variant={propertyImageUrl ? "outline" : "outline"}
                    size="sm"
                    onBeforeGenerate={() => refreshData(false)}
                  />
                )}
                <Button 
                  variant={propertyImageUrl ? "secondary" : "outline"} 
                  size="sm" 
                  onClick={() => refreshData(true)}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </Button>
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
            </div>
            
            <div className={`mt-4 ${propertyImageUrl ? 'text-white/90' : 'text-muted-foreground'}`}>
              <p className="text-lg">
                Welcome back, {session.ownerName}
                {session.secondOwnerName && ` & ${session.secondOwnerName}`}
              </p>
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
        {/* Data Status Alert */}
        {(isRefreshing || dataStale) && (
          <Alert className={`mb-4 ${dataStale ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'}`}>
            <div className="flex items-center gap-2">
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Refreshing your dashboard data...
                  </AlertDescription>
                </>
              ) : dataStale ? (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    Data may be outdated. 
                    <Button variant="link" size="sm" className="h-auto p-0 text-amber-700" onClick={() => refreshData(true)}>
                      Click to refresh
                    </Button>
                  </AlertDescription>
                </>
              ) : null}
            </div>
          </Alert>
        )}
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-6 overflow-x-auto scrollbar-thin scrollbar-thumb-muted">
            <TabsList className="bg-background/95 backdrop-blur shadow-lg border p-1 h-auto inline-flex min-w-max">
              <TabsTrigger value="overview" className="gap-1.5 px-3">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5 px-3">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Insights</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="gap-1.5 px-3">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Bookings</span>
              </TabsTrigger>
              <TabsTrigger value="statements" className="gap-1.5 px-3">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Statements</span>
              </TabsTrigger>
              <TabsTrigger value="receipts" className="gap-1.5 px-3">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Expenses</span>
              </TabsTrigger>
              <TabsTrigger value="property" className="gap-1.5 px-3">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Property</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1.5 px-3">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="gap-1.5 px-3">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Repairs</span>
              </TabsTrigger>
              <TabsTrigger value="screenings" className="gap-1.5 px-3">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Screenings</span>
              </TabsTrigger>
              <TabsTrigger value="marketing" className="gap-1.5 px-3">
                <Megaphone className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Marketing</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Show onboarding timeline if property is in onboarding */}
          {property?.onboarding_stage && <OwnerOnboardingTimeline onboardingStage={property.onboarding_stage} />}

          <TabsContent value="overview">
            <div className="space-y-8">
              {/* Performance Overview */}
              <OwnerPerformanceOverview 
                metrics={performanceMetrics}
                propertyName={property?.name}
                revenueBreakdown={revenueBreakdown}
                rentalType={property?.rental_type}
                peachHausData={peachHausData}
              />

              {/* Voice Recap - Listen to Your Monthly Summary */}
              <AudioPropertySummary
                propertyName={property?.name || "Your Property"}
                ownerName={session?.ownerName}
                secondOwnerName={session?.secondOwnerName}
                rentalType={property?.rental_type as "hybrid" | "mid_term" | "long_term"}
                marketingStats={marketingStats?.[0]}
                listingHealth={peachHausData?.listingHealth}
                revenueData={{
                  thisMonthRevenue: performanceMetrics.totalRevenue,
                  lastMonthRevenue: statements[0]?.total_revenue,
                  occupancyRate: performanceMetrics.occupancyRate,
                  upcomingBookings: bookings?.str?.filter((b: any) => new Date(b.check_in) > new Date()).length || 0,
                  strRevenue: performanceMetrics.strRevenue,
                  mtrRevenue: performanceMetrics.mtrRevenue,
                }}
                peachHausData={{
                  maintenanceCompleted: peachHausData?.maintenanceCompleted || 0,
                  tenantPaymentStatus: peachHausData?.tenantPaymentStatus || "on_time",
                  marketComparison: peachHausData?.marketComparison,
                }}
                hasBookings={
                  (bookings?.str?.length || 0) > 0 || 
                  (bookings?.mtr?.length || 0) > 0
                }
                onboardingStage={property?.onboarding_stage}
              />

              {/* Performance Charts */}
              <OwnerPerformanceCharts 
                statements={statements} 
                monthlyRevenueData={monthlyRevenueData}
                propertyName={property?.name} 
              />

              {/* Revenue Forecast */}
              {bookings && (
                <OwnerRevenueForecast bookings={bookings} propertyName={property?.name} />
              )}

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
                            Net: {formatCurrency(latestStatement.actual_net_earnings ?? latestStatement.net_to_owner ?? 0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openStatementViewer(latestStatement)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
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
                          Download
                        </Button>
                      </div>
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
                propertyBeds={property?.bedrooms || 5}
                propertyBaths={property?.bathrooms || 3}
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
                rentalType={property?.rental_type as "hybrid" | "mid_term" | "long_term" | null}
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
                  propertyAddress={property?.address}
                  propertyCity={property?.address?.split(",")[1]?.trim()}
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
                  isSuperhost={performanceMetrics.averageRating !== null && performanceMetrics.averageRating >= 4.8 && performanceMetrics.reviewCount >= 10}
                  rentalType={property?.rental_type as "hybrid" | "mid_term" | "long_term" | null}
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
            {property && <OwnerBookingsTab propertyId={property.id} bookings={bookings || undefined} />}
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
                              <span className="text-emerald-600">Net: {formatCurrency(statement.actual_net_earnings ?? statement.net_to_owner ?? 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => downloadStatement(statement)}
                            disabled={downloadingPdf === statement.id}
                            title="Download Statement"
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
            {property && <OwnerReceiptsTab expenses={expenses} propertyId={property.id} token={sessionToken || undefined} />}
          </TabsContent>

          <TabsContent value="property">
            {property && session && (
              <OwnerPropertyTab 
                property={property}
                owner={{
                  name: session.ownerName,
                  email: session.email,
                  secondOwnerName: session.secondOwnerName,
                  secondOwnerEmail: session.secondOwnerEmail,
                }}
                peachHausData={peachHausData}
              />
            )}
          </TabsContent>

          <TabsContent value="messages">
            {session && <OwnerMessagesTab ownerId={session.ownerId} />}
          </TabsContent>

          <TabsContent value="maintenance">
            {session && (
              <OwnerMaintenanceTab 
                ownerId={session.ownerId} 
                propertyId={property?.id}
              />
            )}
          </TabsContent>

          <TabsContent value="screenings">
            {property && (
              <OwnerGuestScreeningsTab 
                propertyId={property.id} 
                screenings={guestScreenings}
              />
            )}
          </TabsContent>

          <TabsContent value="marketing">
            {property && (
              <OwnerMarketingTab 
                propertyId={property.id} 
                propertyName={property.name}
                directBookingUrl={property.website_url}
                marketingStats={marketingStats}
                ownerName={session?.ownerName}
                secondOwnerName={session?.secondOwnerName}
                rentalType={property.rental_type}
                revenueData={{
                  thisMonthRevenue: performanceMetrics.totalRevenue,
                  lastMonthRevenue: statements[0]?.total_revenue,
                  occupancyRate: performanceMetrics.occupancyRate,
                  upcomingBookings: bookings?.str?.filter((b: any) => new Date(b.check_in) > new Date()).length || 0,
                  strRevenue: performanceMetrics.strRevenue,
                  mtrRevenue: performanceMetrics.mtrRevenue,
                  averageRating: performanceMetrics.averageRating || undefined,
                  reviewCount: performanceMetrics.reviewCount,
                  strBookings: performanceMetrics.strBookings,
                  mtrBookings: performanceMetrics.mtrBookings,
                }}
                peachHausData={peachHausData ? {
                  listingHealth: peachHausData.listingHealth || peachHausData.listing_health,
                  maintenanceCompleted: peachHausData.maintenanceCompleted || 0,
                  tenantPaymentStatus: peachHausData.tenantPaymentStatus || "on_time",
                  guestCommunicationsHandled: peachHausData.guestCommunicationsHandled || 0,
                  marketComparison: peachHausData.marketComparison,
                } : undefined}
                hasBookings={
                  (bookings?.str?.length || 0) > 0 || 
                  (bookings?.mtr?.length || 0) > 0
                }
                onboardingStage={property?.onboarding_stage}
              />
            )}
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

      {/* Statement Viewer Modal */}
      <StatementViewer
        open={!!viewingStatement}
        onOpenChange={(open) => !open && setViewingStatement(null)}
        statement={viewingStatement}
        fetchPdf={fetchStatementPdf}
        propertyName={property?.name}
        ownerName={session?.ownerName}
        propertyAddress={property?.address}
      />

      {/* Schedule Call Modal */}
      {session && (
        <ScheduleOwnerCallModal
          open={showScheduleCallModal}
          onOpenChange={setShowScheduleCallModal}
          ownerEmail={session.email}
          ownerName={session.ownerName}
        />
      )}
    </div>
  );
}
