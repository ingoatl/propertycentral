import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  Megaphone, 
  TrendingUp, 
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
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";

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
  // Guest info from joined booking data
  guest_info?: GuestInfo | null;
  // Extended fields for guest context
  guest_name?: string | null;
  booking_id?: string | null;
  stay_dates?: {
    check_in?: string;
    check_out?: string;
  } | null;
}

interface OwnerMarketingTabProps {
  propertyId: string;
  propertyName: string;
}

// Activity type metadata with context and industry insights
const activityMetadata: Record<string, {
  icon: React.ReactNode;
  color: string;
  purpose: string;
  industryInsight: string;
  impactMetric?: string;
}> = {
  email_blast: {
    icon: <Mail className="w-5 h-5" />,
    color: "bg-gradient-to-br from-orange-100 to-amber-100 text-orange-700 dark:from-orange-900/40 dark:to-amber-900/40 dark:text-orange-300",
    purpose: "Pre-arrival communication ensures your guest has check-in instructions, house rules, and local recommendations for a smooth arrival and 5-star experience.",
    industryInsight: "Properties with automated pre-arrival emails see 23% higher review scores and 40% fewer guest questions.",
    impactMetric: "23% higher reviews",
  },
  listing_created: {
    icon: <Home className="w-5 h-5" />,
    color: "bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300",
    purpose: "Your property is now live and visible to potential guests on our booking platforms, maximizing exposure and booking opportunities.",
    industryInsight: "New listings receive 40% higher visibility in search results during their first 2 weeks of publication.",
    impactMetric: "40% more visibility",
  },
  listing_updated: {
    icon: <RefreshCw className="w-5 h-5" />,
    color: "bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700 dark:from-blue-900/40 dark:to-cyan-900/40 dark:text-blue-300",
    purpose: "We've optimized your listing with updated photos, descriptions, or pricing to improve conversion and attract more bookings.",
    industryInsight: "Listings updated monthly convert 28% better than stale listings. Fresh content signals an active, well-maintained property.",
    impactMetric: "28% better conversion",
  },
  campaign_launched: {
    icon: <Megaphone className="w-5 h-5" />,
    color: "bg-gradient-to-br from-purple-100 to-violet-100 text-purple-700 dark:from-purple-900/40 dark:to-violet-900/40 dark:text-purple-300",
    purpose: "A targeted marketing campaign is running to promote your property to ideal guests based on their travel preferences and history.",
    industryInsight: "Targeted campaigns generate 3x more qualified leads than general advertising, reducing vacancy and maximizing revenue.",
    impactMetric: "3x more leads",
  },
  social_post: {
    icon: <Share2 className="w-5 h-5" />,
    color: "bg-gradient-to-br from-pink-100 to-rose-100 text-pink-700 dark:from-pink-900/40 dark:to-rose-900/40 dark:text-pink-300",
    purpose: "Your property was featured on our social media channels to attract new guests and build brand awareness.",
    industryInsight: "Social media exposure drives 15% of direct booking inquiries. Visual content increases engagement by 65%.",
    impactMetric: "15% direct bookings",
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
  },
};

const defaultMetadata = {
  icon: <CheckCircle className="w-5 h-5" />,
  color: "bg-gradient-to-br from-gray-100 to-slate-100 text-gray-700 dark:from-gray-900/40 dark:to-slate-900/40 dark:text-gray-300",
  purpose: "Marketing activity to promote your property and attract guests.",
  industryInsight: "Consistent marketing efforts increase bookings by 20% on average.",
  impactMetric: "20% more bookings",
};

export const OwnerMarketingTab = ({ propertyId, propertyName }: OwnerMarketingTabProps) => {
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

  useEffect(() => {
    loadMarketingData();
  }, [propertyId]);

  const loadMarketingData = async () => {
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
    // If we have guest context, personalize the title
    const guestName = activity.guest_info?.guest_name || activity.guest_name;
    if (guestName) {
      if (activity.activity_type === "email_blast" || activity.activity_type === "guest_welcome") {
        return `Welcome Email to ${guestName}`;
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
        <Button variant="outline" size="sm" onClick={loadMarketingData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

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

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-none shadow-lg dark:from-cyan-950/30 dark:to-cyan-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.totalViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-none shadow-lg dark:from-blue-950/30 dark:to-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <MousePointerClick className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.totalClicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-none shadow-lg dark:from-amber-950/30 dark:to-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.totalInquiries}</p>
                <p className="text-xs text-muted-foreground">Inquiries</p>
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
                <p className="text-2xl font-bold">{aggregateMetrics.activePlatforms}</p>
                <p className="text-xs text-muted-foreground">Platforms</p>
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
                <p className="text-2xl font-bold">{aggregateMetrics.totalActivities}</p>
                <p className="text-xs text-muted-foreground">Activities</p>
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
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center mb-6">
                <Megaphone className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Marketing Activities Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Marketing data will appear here once we begin promoting your property. Stay tuned!
              </p>
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
