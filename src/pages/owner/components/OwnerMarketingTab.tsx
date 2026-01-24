import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { 
  Megaphone, 
  TrendingUp, 
  TrendingDown,
  Eye, 
  MousePointerClick, 
  MessageSquare,
  Calendar,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Share2,
  Mail,
  Home,
  CheckCircle,
  Info,
  User,
  Lightbulb,
  BarChart3,
  Star,
  ArrowUpRight,
  Clock,
  Users,
  Baby,
  PawPrint,
  BookOpen,
  QrCode,
  Globe,
  Package,
  Repeat,
  Building2,
  Phone,
  FileText,
  UserCheck,
  Instagram,
  Facebook,
  MapPin,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { CorporateOutreachCard } from "./CorporateOutreachCard";
import { AudioPropertySummary } from "./AudioPropertySummary";
import { OwnerValueRealized } from "./OwnerValueRealized";

interface GuestInfo {
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children: number | null;
  pets: number | null;
}

interface MarketingActivity {
  id: string;
  property_id: string;
  activity_type: string;
  platform: string | null;
  title: string;
  description: string | null;
  metrics: Record<string, number> | null;
  activity_url: string | null;
  activity_date: string;
  synced_at: string;
  guest_info?: GuestInfo | null;
  guest_name?: string | null;
  booking_id?: string | null;
  stay_dates?: {
    check_in?: string;
    check_out?: string;
  } | null;
}

interface MarketingStats {
  id: string;
  property_id: string;
  report_month: string;
  social_media: {
    instagram_posts?: number;
    instagram_stories?: number;
    facebook_posts?: number;
    gmb_posts?: number;
    total_reach?: number;
    total_engagement?: number;
    engagement_rate?: number;
  };
  outreach: {
    total_companies_contacted?: number;
    industries_targeted?: string[];
    emails_sent?: number;
    calls_made?: number;
    hotsheets_distributed?: number;
    decision_makers_identified?: number;
  };
  visibility: {
    marketing_active?: boolean;
    included_in_hotsheets?: boolean;
  };
  executive_summary?: string;
  synced_at: string;
}

interface OwnerMarketingTabProps {
  propertyId: string;
  propertyName: string;
  directBookingUrl?: string | null;
  guidebookUrl?: string | null;
  qrCodeUrl?: string | null;
  marketingStats?: MarketingStats[];
}

// Activity type metadata with context, industry insights, and rebooking impact
const activityMetadata: Record<string, {
  icon: React.ReactNode;
  color: string;
  purpose: string;
  industryInsight: string;
  impactMetric?: string;
  rebookingImpact?: string;
}> = {
  email_blast: {
    icon: <Mail className="w-5 h-5" />,
    color: "bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300",
    purpose: "Pre-arrival communication ensures your guest has check-in instructions, house rules, and local recommendations for a smooth arrival and 5-star experience.",
    industryInsight: "Properties with automated pre-arrival emails see 23% higher review scores and 40% fewer guest questions.",
    impactMetric: "23% higher reviews",
    rebookingImpact: "Guests receiving pre-arrival emails are 35% more likely to book directly next time",
  },
  listing_created: {
    icon: <Home className="w-5 h-5" />,
    color: "bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300",
    purpose: "Your property is now live and visible to potential guests on our booking platforms, maximizing exposure and booking opportunities.",
    industryInsight: "New listings receive 40% higher visibility in search results during their first 2 weeks of publication.",
    impactMetric: "40% more visibility",
    rebookingImpact: "More exposure means more first-time guests who can become repeat bookers",
  },
  listing_updated: {
    icon: <RefreshCw className="w-5 h-5" />,
    color: "bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700 dark:from-blue-900/40 dark:to-cyan-900/40 dark:text-blue-300",
    purpose: "We've optimized your listing with updated photos, descriptions, or pricing to improve conversion and attract more bookings.",
    industryInsight: "Listings updated monthly convert 28% better than stale listings. Fresh content signals an active, well-maintained property.",
    impactMetric: "28% better conversion",
    rebookingImpact: "Updated listings attract quality guests who are more likely to return",
  },
  campaign_launched: {
    icon: <Megaphone className="w-5 h-5" />,
    color: "bg-gradient-to-br from-purple-100 to-violet-100 text-purple-700 dark:from-purple-900/40 dark:to-violet-900/40 dark:text-purple-300",
    purpose: "A targeted marketing campaign is running to promote your property to ideal guests based on their travel preferences and history.",
    industryInsight: "Targeted campaigns generate 3x more qualified leads than general advertising, reducing vacancy and maximizing revenue.",
    impactMetric: "3x more leads",
    rebookingImpact: "Targeted guests are 2x more likely to become repeat customers",
  },
  social_post: {
    icon: <Share2 className="w-5 h-5" />,
    color: "bg-gradient-to-br from-pink-100 to-rose-100 text-pink-700 dark:from-pink-900/40 dark:to-rose-900/40 dark:text-pink-300",
    purpose: "Your property was featured on our social media channels to attract new guests and build brand awareness.",
    industryInsight: "Social media exposure drives 15% of direct booking inquiries. Visual content increases engagement by 65%.",
    impactMetric: "15% direct bookings",
    rebookingImpact: "Social followers often become loyal repeat bookers",
  },
  inquiry_received: {
    icon: <MessageSquare className="w-5 h-5" />,
    color: "bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-700 dark:from-amber-900/40 dark:to-yellow-900/40 dark:text-amber-300",
    purpose: "A potential guest has expressed interest in your property. Our team responded promptly to convert this inquiry into a booking.",
    industryInsight: "Inquiries responded to within 1 hour have a 45% higher conversion rate. Speed matters in hospitality.",
    impactMetric: "45% higher conversion",
  },
  listing_view: {
    icon: <Eye className="w-5 h-5" />,
    color: "bg-gradient-to-br from-cyan-100 to-sky-100 text-cyan-700 dark:from-cyan-900/40 dark:to-sky-900/40 dark:text-cyan-300",
    purpose: "Your listing is attracting views from potential guests browsing our platform for their next stay.",
    industryInsight: "High view counts indicate strong listing appeal. Properties with optimized photos get 2x more views.",
    impactMetric: "2x more views",
  },
  booking_inquiry: {
    icon: <Calendar className="w-5 h-5" />,
    color: "bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 dark:from-emerald-900/40 dark:to-teal-900/40 dark:text-emerald-300",
    purpose: "A guest has inquired about booking specific dates at your property. This is a high-intent lead.",
    industryInsight: "Booking inquiries convert at 35% when followed up within 30 minutes. Time-sensitive response is key.",
    impactMetric: "35% conversion",
  },
  guest_welcome: {
    icon: <Star className="w-5 h-5" />,
    color: "bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700 dark:from-indigo-900/40 dark:to-blue-900/40 dark:text-indigo-300",
    purpose: "Welcome communication sent to prepare your guest for an amazing stay with personalized recommendations and essential information.",
    industryInsight: "Personalized welcome messages increase 5-star review probability by 31% and reduce support requests by 25%.",
    impactMetric: "31% more 5-star reviews",
    rebookingImpact: "A great first impression leads to 40% more repeat bookings",
  },
  post_stay_thankyou: {
    icon: <Mail className="w-5 h-5" />,
    color: "bg-gradient-to-br from-rose-100 to-pink-100 text-rose-700 dark:from-rose-900/40 dark:to-pink-900/40 dark:text-rose-300",
    purpose: "Sent 24 hours after checkout thanking the guest for their stay and gently requesting a review.",
    industryInsight: "Post-stay thank you emails increase public reviews by 60%. More reviews = higher ranking = more bookings.",
    impactMetric: "60% more reviews",
    rebookingImpact: "Thank you emails with discount codes see 28% rebooking rate",
  },
  direct_booking_invite: {
    icon: <Repeat className="w-5 h-5" />,
    color: "bg-gradient-to-br from-emerald-100 to-green-100 text-emerald-700 dark:from-emerald-900/40 dark:to-green-900/40 dark:text-emerald-300",
    purpose: "Sent 30 days post-stay with a special offer for direct booking on your property website, saving OTA fees.",
    industryInsight: "Direct bookings save 15-20% in OTA fees and build a loyal guest database for your property.",
    impactMetric: "15-20% fee savings",
    rebookingImpact: "Direct booking invites convert at 12% for repeat stays",
  },
};

const defaultMetadata = {
  icon: <CheckCircle className="w-5 h-5" />,
  color: "bg-gradient-to-br from-gray-100 to-slate-100 text-gray-700 dark:from-gray-900/40 dark:to-slate-900/40 dark:text-gray-300",
  purpose: "Marketing activity to promote your property and attract guests.",
  industryInsight: "Consistent marketing efforts increase bookings by 20% on average.",
  impactMetric: "20% more bookings",
};

export const OwnerMarketingTab = ({ propertyId, propertyName, directBookingUrl, guidebookUrl, qrCodeUrl, marketingStats = [] }: OwnerMarketingTabProps) => {
  const [activities, setActivities] = useState<MarketingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [aggregateMetrics, setAggregateMetrics] = useState({
    totalViews: 0,
    totalClicks: 0,
    totalInquiries: 0,
    activePlatforms: 0,
    totalActivities: 0,
  });

  // Process marketing stats - current and previous month for trends
  const currentStats = marketingStats[0] || null;
  const previousStats = marketingStats[1] || null;
  
  // Calculate aggregated marketing actions from stats
  const totalSocialPosts = (currentStats?.social_media?.instagram_posts || 0) + 
    (currentStats?.social_media?.instagram_stories || 0) + 
    (currentStats?.social_media?.facebook_posts || 0) + 
    (currentStats?.social_media?.gmb_posts || 0);
  
  const totalOutreachActions = (currentStats?.outreach?.emails_sent || 0) + 
    (currentStats?.outreach?.calls_made || 0) + 
    (currentStats?.outreach?.hotsheets_distributed || 0);
  
  const totalMarketingActions = totalSocialPosts + totalOutreachActions;

  // Decision makers reached (corporate outreach)
  const decisionMakersReached = currentStats?.outreach?.decision_makers_identified || 0;
  
  // Platforms count (active marketing channels)
  const platformsCount = [
    currentStats?.social_media?.instagram_posts || currentStats?.social_media?.instagram_stories,
    currentStats?.social_media?.facebook_posts,
    currentStats?.social_media?.gmb_posts,
    currentStats?.outreach?.hotsheets_distributed,
  ].filter(Boolean).length || 0;

  // Calculate trends (percentage change)
  const calculateTrend = (current?: number, previous?: number) => {
    if (!current || !previous || previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };
  
  const reachTrend = calculateTrend(currentStats?.social_media?.total_reach, previousStats?.social_media?.total_reach);
  const engagementTrend = calculateTrend(currentStats?.social_media?.total_engagement, previousStats?.social_media?.total_engagement);
  const outreachTrend = calculateTrend(
    (currentStats?.outreach?.emails_sent || 0) + (currentStats?.outreach?.calls_made || 0),
    (previousStats?.outreach?.emails_sent || 0) + (previousStats?.outreach?.calls_made || 0)
  );

  const formatNumber = (num?: number) => {
    if (!num) return "0";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Demo property ID - skip DB fetch for demo
  const DEMO_PROPERTY_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
  const isDemo = propertyId === DEMO_PROPERTY_ID;

  useEffect(() => {
    // For demo, skip DB fetch - we already have mock data from marketingStats prop
    if (isDemo) {
      setLoading(false);
      return;
    }
    loadMarketingData();
  }, [propertyId, isDemo]);

  const loadMarketingData = async () => {
    if (isDemo) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Fetch marketing activities
      const { data: activitiesData, error } = await supabase
        .from("owner_marketing_activities")
        .select("*")
        .eq("property_id", propertyId)
        .order("activity_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch bookings for this property to match guest info
      const { data: bookingsData } = await supabase
        .from("ownerrez_bookings")
        .select("guest_name, check_in, check_out, adults, children, pets")
        .eq("property_id", propertyId)
        .order("check_in", { ascending: false });

      // Match activities with guest info from bookings
      const enrichedActivities = (activitiesData || []).map(activity => {
        const activityDate = new Date(activity.activity_date);
        
        // Find a booking that matches the activity date (email sent ~7 days before check-in)
        const matchedBooking = bookingsData?.find(booking => {
          if (!booking.check_in || !booking.guest_name) return false;
          const checkIn = new Date(booking.check_in);
          const checkOut = booking.check_out ? new Date(booking.check_out) : null;
          const daysBefore = differenceInDays(checkIn, activityDate);
          // Match if activity is 0-14 days before check-in OR during the stay
          return (daysBefore >= 0 && daysBefore <= 14) || 
                 (checkOut && activityDate >= checkIn && activityDate <= checkOut);
        });

        return {
          ...activity,
          metrics: (activity.metrics as Record<string, number>) || {},
          guest_info: matchedBooking ? {
            guest_name: matchedBooking.guest_name,
            check_in: matchedBooking.check_in,
            check_out: matchedBooking.check_out,
            adults: matchedBooking.adults,
            children: matchedBooking.children,
            pets: matchedBooking.pets,
          } : null,
        };
      });

      setActivities(enrichedActivities);

      // Calculate aggregate metrics
      const metrics = enrichedActivities.reduce(
        (acc, activity) => {
          const m = activity.metrics as Record<string, number> || {};
          return {
            totalViews: acc.totalViews + (m.views || 0),
            totalClicks: acc.totalClicks + (m.clicks || 0),
            totalInquiries: acc.totalInquiries + (m.inquiries || 0),
            activePlatforms: acc.activePlatforms,
            totalActivities: acc.totalActivities + 1,
          };
        },
        { totalViews: 0, totalClicks: 0, totalInquiries: 0, activePlatforms: 0, totalActivities: 0 }
      );

      // Count unique platforms
      const uniquePlatforms = new Set(
        (activitiesData || [])
          .filter(a => a.platform)
          .map(a => a.platform)
      );
      metrics.activePlatforms = uniquePlatforms.size;

      setAggregateMetrics(metrics);
    } catch (error) {
      console.error("Error loading marketing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityMeta = (activityType: string) => {
    return activityMetadata[activityType] || defaultMetadata;
  };

  const formatActivityTitle = (activity: MarketingActivity) => {
    // If we have guest context, personalize the title with guest name and stay info
    const guestName = activity.guest_info?.guest_name || activity.guest_name;
    const stayContext = getStayContext(activity);
    
    if (guestName) {
      if (activity.activity_type === "email_blast" || activity.activity_type === "guest_welcome") {
        // Include reservation dates for clarity
        if (stayContext) {
          return `Welcome Email to ${guestName} (${stayContext.formatted})`;
        }
        return `Welcome Email to ${guestName}`;
      }
      // For other activity types, still show guest name if available
      if (activity.title.toLowerCase().includes("email") || activity.title.toLowerCase().includes("message")) {
        if (stayContext) {
          return `${activity.title} - ${guestName} (${stayContext.formatted})`;
        }
        return `${activity.title} - ${guestName}`;
      }
    }
    return activity.title;
  };

  const getStayContext = (activity: MarketingActivity) => {
    // Use guest_info first, then fall back to stay_dates
    const checkIn = activity.guest_info?.check_in || activity.stay_dates?.check_in;
    const checkOut = activity.guest_info?.check_out || activity.stay_dates?.check_out;
    
    if (checkIn && checkOut) {
      try {
        const inDate = new Date(checkIn);
        const outDate = new Date(checkOut);
        const nights = differenceInDays(outDate, inDate);
        return {
          formatted: `${format(inDate, "MMM d")} - ${format(outDate, "MMM d, yyyy")}`,
          nights: nights > 0 ? nights : null,
        };
      } catch {
        return null;
      }
    }
    return null;
  };

  const getGuestPartyInfo = (activity: MarketingActivity) => {
    const info = activity.guest_info;
    if (!info) return null;
    
    const parts: string[] = [];
    if (info.adults && info.adults > 0) {
      parts.push(`${info.adults} adult${info.adults > 1 ? 's' : ''}`);
    }
    if (info.children && info.children > 0) {
      parts.push(`${info.children} child${info.children > 1 ? 'ren' : ''}`);
    }
    if (info.pets && info.pets > 0) {
      parts.push(`${info.pets} pet${info.pets > 1 ? 's' : ''}`);
    }
    return parts.length > 0 ? parts.join(', ') : null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  // Generate default stats for demo when no stats are passed
  const effectiveStats = currentStats || (isDemo ? {
    id: "demo-stats",
    property_id: propertyId,
    report_month: new Date().toISOString().substring(0, 7),
    social_media: {
      instagram_posts: 12,
      instagram_stories: 28,
      facebook_posts: 8,
      gmb_posts: 6,
      total_reach: 45200,
      total_engagement: 2840,
      engagement_rate: 6.3,
    },
    outreach: {
      total_companies_contacted: 24,
      industries_targeted: ["Healthcare", "Tech", "Consulting", "Relocation"],
      emails_sent: 48,
      calls_made: 12,
      hotsheets_distributed: 6,
      decision_makers_identified: 18,
    },
    visibility: {
      marketing_active: true,
      included_in_hotsheets: true,
    },
    executive_summary: "Strong month! Your property was featured in 6 industry hotsheets sent to corporate housing coordinators. We made direct contact with 12 relocation managers at Delta, Coca-Cola, and Home Depot. Social media engagement is up 23% from last month.",
    synced_at: new Date().toISOString(),
  } : null);
  
  // Recalculate with effective stats
  const effectiveTotalSocialPosts = (effectiveStats?.social_media?.instagram_posts || 0) + 
    (effectiveStats?.social_media?.instagram_stories || 0) + 
    (effectiveStats?.social_media?.facebook_posts || 0) + 
    (effectiveStats?.social_media?.gmb_posts || 0);
  
  const effectiveTotalOutreachActions = (effectiveStats?.outreach?.emails_sent || 0) + 
    (effectiveStats?.outreach?.calls_made || 0) + 
    (effectiveStats?.outreach?.hotsheets_distributed || 0);
  
  const effectiveTotalMarketingActions = effectiveTotalSocialPosts + effectiveTotalOutreachActions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Marketing Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Track all marketing efforts for {propertyName}
          </p>
        </div>
        {!isDemo && (
          <Button variant="outline" size="sm" onClick={loadMarketingData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>

      {/* Marketing Stats from Marketing Hub */}
      {effectiveStats && (
        <>
          {/* Marketing Activity Summary */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Marketing Activity Summary
              </CardTitle>
              <CardDescription>
                {effectiveStats.report_month ? `Report for ${format(new Date(effectiveStats.report_month + '-01'), 'MMMM yyyy')}` : 'Current Period'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <p className="text-5xl font-bold text-primary">
                  {effectiveTotalMarketingActions}
                </p>
                <p className="text-muted-foreground">Total marketing actions this month</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center">
                <div className="p-3 bg-background rounded-xl">
                  <p className="text-2xl font-semibold">{effectiveTotalSocialPosts}</p>
                  <p className="text-xs text-muted-foreground">Social Posts</p>
                </div>
                <div className="p-3 bg-background rounded-xl">
                  <p className="text-2xl font-semibold">{effectiveStats.outreach?.emails_sent || 0}</p>
                  <p className="text-xs text-muted-foreground">Emails</p>
                </div>
                <div className="p-3 bg-background rounded-xl">
                  <p className="text-2xl font-semibold">{effectiveStats.outreach?.calls_made || 0}</p>
                  <p className="text-xs text-muted-foreground">Calls</p>
                </div>
                <div className="p-3 bg-background rounded-xl">
                  <p className="text-2xl font-semibold">{effectiveStats.outreach?.hotsheets_distributed || 0}</p>
                  <p className="text-xs text-muted-foreground">Hotsheets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Social Media Performance */}
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-primary" />
                  Social Media Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{effectiveStats.social_media?.instagram_posts || 0}</p>
                      <p className="text-xs text-muted-foreground">IG Posts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{effectiveStats.social_media?.instagram_stories || 0}</p>
                      <p className="text-xs text-muted-foreground">IG Stories</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                      <Facebook className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{effectiveStats.social_media?.facebook_posts || 0}</p>
                      <p className="text-xs text-muted-foreground">FB Posts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{effectiveStats.social_media?.gmb_posts || 0}</p>
                      <p className="text-xs text-muted-foreground">GMB Posts</p>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatNumber(effectiveStats.social_media?.total_reach)}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      Total Reach 
                      {reachTrend !== 0 && (
                        reachTrend > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatNumber(effectiveStats.social_media?.total_engagement)}</p>
                    <p className="text-xs text-muted-foreground">Total Engagement</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-accent">{effectiveStats.social_media?.engagement_rate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Engagement Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Corporate Outreach - Enhanced with value explanation */}
            <CorporateOutreachCard 
              outreach={effectiveStats.outreach} 
              reportMonth={effectiveStats.report_month}
            />
          </div>

          {/* Executive Summary */}
          {effectiveStats.executive_summary && (
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    {effectiveStats.executive_summary}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Month-over-Month Trends */}
          {previousStats && (
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  Month-over-Month Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {reachTrend >= 0 ? (
                        <TrendingUp className="w-6 h-6 text-accent" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-destructive" />
                      )}
                      <span className={`text-2xl font-bold ${reachTrend >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {reachTrend >= 0 ? '+' : ''}{reachTrend}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Reach</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {engagementTrend >= 0 ? (
                        <TrendingUp className="w-6 h-6 text-accent" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-destructive" />
                      )}
                      <span className={`text-2xl font-bold ${engagementTrend >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {engagementTrend >= 0 ? '+' : ''}{engagementTrend}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Engagement</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {outreachTrend >= 0 ? (
                        <TrendingUp className="w-6 h-6 text-accent" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-destructive" />
                      )}
                      <span className={`text-2xl font-bold ${outreachTrend >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {outreachTrend >= 0 ? '+' : ''}{outreachTrend}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Outreach Volume</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Audio Summary & Value Realized Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Audio Property Summary */}
            <AudioPropertySummary 
              propertyName={propertyName}
              marketingStats={effectiveStats}
              listingHealth={null}
              revenueData={null}
            />

            {/* Value Realized */}
            <OwnerValueRealized 
              propertyName={propertyName}
              metrics={{
                guestCommunicationsHandled: activities.filter(a => 
                  a.activity_type?.includes('email') || a.activity_type?.includes('message')
                ).length,
                maintenanceIssuesCoordinated: 0,
                bookingInquiriesManaged: activities.filter(a => 
                  a.activity_type?.includes('inquiry')
                ).length,
                gapNightsFilled: 0,
                dynamicPricingAdjustments: 0,
              }}
            />
          </div>
        </>
      )}

      {/* Marketing Toolkit Section */}
      {(directBookingUrl || guidebookUrl || qrCodeUrl) && (
        <Card className="border-none shadow-lg bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Your Marketing Toolkit
            </CardTitle>
            <CardDescription>
              Tools we use to attract and delight your guests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {guidebookUrl && (
                <div className="p-4 bg-background rounded-xl border">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-1">Digital Guidebook</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Interactive guide with check-in instructions, WiFi info, house rules, and local recommendations.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={guidebookUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Guidebook
                    </a>
                  </Button>
                </div>
              )}

              {qrCodeUrl && (
                <div className="p-4 bg-background rounded-xl border">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                    <QrCode className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold mb-1">Property QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Guests scan this to access WiFi, guidebook, and emergency contacts instantly.
                  </p>
                  <img src={qrCodeUrl} alt="Property QR Code" className="w-20 h-20 mx-auto" />
                </div>
              )}

              {directBookingUrl && (
                <div className="p-4 bg-background rounded-xl border">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                    <Globe className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-semibold mb-1">Direct Booking Website</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Your branded booking page - saves 15-20% vs OTA fees!
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={directBookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Visit Site
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Industry Context Banner */}
      <Card className="border-none shadow-md bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm">
              <span className="font-medium">We handle your marketing so you don't have to.</span>
              <span className="text-muted-foreground"> Every activity below is designed to maximize your property's visibility and revenue.</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards - Show stats-based metrics or fallback to activity-based */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-none shadow-lg dark:from-cyan-950/30 dark:to-cyan-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSocialPosts || aggregateMetrics.totalViews}</p>
                <p className="text-xs text-muted-foreground">Social Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalOutreachActions || aggregateMetrics.totalClicks}</p>
                <p className="text-xs text-muted-foreground">Outreach</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(decisionMakersReached)}</p>
                <p className="text-xs text-muted-foreground">Leads Reached</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-none shadow-lg dark:from-purple-950/30 dark:to-purple-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{platformsCount || aggregateMetrics.activePlatforms}</p>
                <p className="text-xs text-muted-foreground">Channels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-none shadow-lg dark:from-emerald-950/30 dark:to-emerald-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMarketingActions || aggregateMetrics.totalActivities}</p>
                <p className="text-xs text-muted-foreground">Total Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-background border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Marketing Activity Timeline
          </CardTitle>
          <CardDescription>
            Every action we take to promote your property and maximize bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {activities.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                <Megaphone className="w-8 h-8 text-muted-foreground/50" />
              </div>
              {currentStats ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">Marketing Summary for This Month</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    {currentStats.executive_summary || 
                      `We've completed ${totalMarketingActions} marketing actions for your property this month, including ${totalSocialPosts} social media posts and ${totalOutreachActions} corporate outreach efforts.`}
                  </p>
                  <Badge variant="secondary" className="text-sm">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Marketing Active
                  </Badge>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold mb-2">No Marketing Activities Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Marketing data will appear here once we begin promoting your property. Stay tuned!
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

              <div className="divide-y">
                {activities.map((activity) => {
                  const meta = getActivityMeta(activity.activity_type);
                  const stayContext = getStayContext(activity);
                  const isExpanded = expandedActivity === activity.id;
                  
                  return (
                    <div 
                      key={activity.id} 
                      className="relative pl-14 pr-6 py-6 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-3 top-6 w-7 h-7 rounded-full flex items-center justify-center ${meta.color}`}>
                        {meta.icon}
                      </div>

                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-semibold text-base">{formatActivityTitle(activity)}</span>
                              {activity.platform && (
                                <Badge variant="secondary" className="text-xs">
                                  {activity.platform}
                                </Badge>
                              )}
                              {meta.impactMetric && (
                                <Badge className="bg-primary/10 text-primary text-xs">
                                  <ArrowUpRight className="w-3 h-3 mr-1" />
                                  {meta.impactMetric}
                                </Badge>
                              )}
                            </div>

                            {/* Guest and stay context */}
                            {(activity.guest_info || stayContext) && (
                              <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-3 mb-2">
                                <div className="flex items-center gap-4 flex-wrap text-sm">
                                  {activity.guest_info?.guest_name && (
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                        <User className="w-4 h-4 text-primary" />
                                      </div>
                                      <div>
                                        <span className="font-semibold text-foreground">{activity.guest_info.guest_name}</span>
                                        {getGuestPartyInfo(activity) && (
                                          <span className="text-muted-foreground text-xs ml-2">
                                            ({getGuestPartyInfo(activity)})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {stayContext && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <Calendar className="w-4 h-4" />
                                      <span>{stayContext.formatted}</span>
                                      {stayContext.nights && (
                                        <Badge variant="secondary" className="text-xs">
                                          {stayContext.nights} night{stayContext.nights > 1 ? 's' : ''}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  {activity.guest_info?.adults && activity.guest_info.adults > 0 && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Users className="w-3.5 h-3.5" />
                                      <span className="text-xs">{activity.guest_info.adults} adults</span>
                                    </div>
                                  )}
                                  {activity.guest_info?.children && activity.guest_info.children > 0 && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Baby className="w-3.5 h-3.5" />
                                      <span className="text-xs">{activity.guest_info.children} children</span>
                                    </div>
                                  )}
                                  {activity.guest_info?.pets && activity.guest_info.pets > 0 && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <PawPrint className="w-3.5 h-3.5" />
                                      <span className="text-xs">{activity.guest_info.pets} pets</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(activity.activity_date), { addSuffix: true })}
                            </span>
                            {activity.activity_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(activity.activity_url!, "_blank");
                                }}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Why we sent this - expanded content */}
                        <div className={`space-y-3 ${isExpanded ? 'block' : 'hidden md:block'}`}>
                          {/* Purpose */}
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Info className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Why We Sent This
                                </p>
                                <p className="text-sm">
                                  {activity.description || meta.purpose}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Industry Insight */}
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                                  Industry Insight
                                </p>
                                <p className="text-sm text-amber-900 dark:text-amber-200">
                                  {meta.industryInsight}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Metrics if available */}
                        {Object.keys(activity.metrics || {}).length > 0 && (
                          <div className="flex items-center gap-4 text-sm">
                            {activity.metrics?.views !== undefined && (
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Eye className="w-4 h-4" />
                                <span className="font-medium">{activity.metrics.views.toLocaleString()}</span> views
                              </span>
                            )}
                            {activity.metrics?.clicks !== undefined && (
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <MousePointerClick className="w-4 h-4" />
                                <span className="font-medium">{activity.metrics.clicks.toLocaleString()}</span> clicks
                              </span>
                            )}
                            {activity.metrics?.inquiries !== undefined && (
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <MessageSquare className="w-4 h-4" />
                                <span className="font-medium">{activity.metrics.inquiries}</span> inquiries
                              </span>
                            )}
                          </div>
                        )}

                        {/* Expand hint on mobile */}
                        <p className="text-xs text-muted-foreground md:hidden">
                          {isExpanded ? "Tap to collapse" : "Tap for details"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trust Footer */}
      {activities.length > 0 && (
        <Card className="border-none shadow-sm bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Professionally Managed Marketing</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Data-Driven Strategy</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span>Maximizing Your Revenue</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
