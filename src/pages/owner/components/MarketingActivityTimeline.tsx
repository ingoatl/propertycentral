import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Megaphone, 
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
  Star,
  ArrowUpRight,
  Clock,
  Users,
  Baby,
  PawPrint,
  Calendar,
  Eye,
  MousePointerClick,
  MessageSquare,
  Play,
  Instagram,
  Facebook,
  MapPin,
  Linkedin,
  Video,
  Repeat,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

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
    tiktok_posts?: number;
    linkedin_posts?: number;
    nextdoor_posts?: number;
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

interface MarketingActivityTimelineProps {
  activities: MarketingActivity[];
  currentStats: MarketingStats | null;
  propertyName: string;
}

// Activity type metadata
const activityMetadata: Record<string, {
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  purpose: string;
  industryInsight: string;
  impactMetric?: string;
  rebookingImpact?: string;
}> = {
  email_blast: {
    icon: <Mail className="w-4 h-4" />,
    color: "text-orange-600 dark:text-orange-400",
    bgGradient: "bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent",
    purpose: "Pre-arrival communication ensures your guest has check-in instructions, house rules, and local recommendations.",
    industryInsight: "Properties with automated pre-arrival emails see 23% higher review scores.",
    impactMetric: "+23% Reviews",
    rebookingImpact: "35% more likely to book directly next time",
  },
  listing_created: {
    icon: <Home className="w-4 h-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bgGradient: "bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent",
    purpose: "Your property is now live and visible to potential guests on our booking platforms.",
    industryInsight: "New listings receive 40% higher visibility in search results during their first 2 weeks.",
    impactMetric: "+40% Visibility",
  },
  listing_updated: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: "text-blue-600 dark:text-blue-400",
    bgGradient: "bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent",
    purpose: "We've optimized your listing with updated photos, descriptions, or pricing.",
    industryInsight: "Listings updated monthly convert 28% better than stale listings.",
    impactMetric: "+28% Conversion",
  },
  campaign_launched: {
    icon: <Megaphone className="w-4 h-4" />,
    color: "text-purple-600 dark:text-purple-400",
    bgGradient: "bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-transparent",
    purpose: "A targeted marketing campaign is running to promote your property to ideal guests.",
    industryInsight: "Targeted campaigns generate 3x more qualified leads than general advertising.",
    impactMetric: "3x More Leads",
  },
  social_post: {
    icon: <Share2 className="w-4 h-4" />,
    color: "text-pink-600 dark:text-pink-400",
    bgGradient: "bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent",
    purpose: "Your property was featured on our social media channels.",
    industryInsight: "Social media exposure drives 15% of direct booking inquiries.",
    impactMetric: "+15% Bookings",
  },
  guest_welcome: {
    icon: <Star className="w-4 h-4" />,
    color: "text-indigo-600 dark:text-indigo-400",
    bgGradient: "bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent",
    purpose: "Welcome communication sent with personalized recommendations and essential information.",
    industryInsight: "Personalized welcome messages increase 5-star review probability by 31%.",
    impactMetric: "+31% 5-Star",
    rebookingImpact: "40% more repeat bookings",
  },
  post_stay_thankyou: {
    icon: <Mail className="w-4 h-4" />,
    color: "text-rose-600 dark:text-rose-400",
    bgGradient: "bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent",
    purpose: "Sent 24 hours after checkout thanking the guest and requesting a review.",
    industryInsight: "Post-stay thank you emails increase public reviews by 60%.",
    impactMetric: "+60% Reviews",
  },
  direct_booking_invite: {
    icon: <Repeat className="w-4 h-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    bgGradient: "bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent",
    purpose: "Sent 30 days post-stay with a special offer for direct booking.",
    industryInsight: "Direct bookings save 15-20% in OTA fees and build a loyal guest database.",
    impactMetric: "-20% Fees",
    rebookingImpact: "12% conversion for repeat stays",
  },
};

const defaultMetadata = {
  icon: <CheckCircle className="w-4 h-4" />,
  color: "text-slate-600 dark:text-slate-400",
  bgGradient: "bg-gradient-to-br from-slate-500/10 via-gray-500/5 to-transparent",
  purpose: "Marketing activity to promote your property and attract guests.",
  industryInsight: "Consistent marketing efforts increase bookings by 20% on average.",
  impactMetric: "+20% Bookings",
};

export const MarketingActivityTimeline = ({ 
  activities, 
  currentStats, 
  propertyName 
}: MarketingActivityTimelineProps) => {
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  
  const getActivityMeta = (activityType: string) => {
    return activityMetadata[activityType] || defaultMetadata;
  };

  const formatActivityTitle = (activity: MarketingActivity): string => {
    if (activity.title) return activity.title;
    
    const typeMap: Record<string, string> = {
      email_blast: "Email Campaign Sent",
      listing_created: "Listing Published",
      listing_updated: "Listing Optimized",
      campaign_launched: "Marketing Campaign Launched",
      social_post: "Social Media Post",
      guest_welcome: "Guest Welcome Message",
      post_stay_thankyou: "Post-Stay Thank You",
      direct_booking_invite: "Direct Booking Invitation",
    };
    
    return typeMap[activity.activity_type] || "Marketing Activity";
  };

  const getStayContext = (activity: MarketingActivity) => {
    const dates = activity.stay_dates || {
      check_in: activity.guest_info?.check_in,
      check_out: activity.guest_info?.check_out,
    };
    
    if (!dates.check_in) return null;
    
    const checkIn = new Date(dates.check_in);
    const checkOut = dates.check_out ? new Date(dates.check_out) : null;
    const nights = checkOut ? differenceInDays(checkOut, checkIn) : null;
    
    return {
      formatted: `${format(checkIn, "MMM d")}${checkOut ? ` - ${format(checkOut, "MMM d")}` : ""}`,
      nights,
    };
  };

  const getGuestPartyInfo = (activity: MarketingActivity): string | null => {
    const info = activity.guest_info;
    if (!info) return null;
    
    const parts: string[] = [];
    if (info.adults && info.adults > 0) parts.push(`${info.adults} adult${info.adults > 1 ? "s" : ""}`);
    if (info.children && info.children > 0) parts.push(`${info.children} child${info.children > 1 ? "ren" : ""}`);
    if (info.pets && info.pets > 0) parts.push(`${info.pets} pet${info.pets > 1 ? "s" : ""}`);
    
    return parts.length > 0 ? parts.join(", ") : null;
  };

  // Calculate totals from stats
  const totalSocialPosts = (currentStats?.social_media?.instagram_posts || 0) + 
    (currentStats?.social_media?.instagram_stories || 0) + 
    (currentStats?.social_media?.facebook_posts || 0) + 
    (currentStats?.social_media?.gmb_posts || 0) +
    (currentStats?.social_media?.tiktok_posts || 0);
  
  const totalOutreachActions = (currentStats?.outreach?.emails_sent || 0) + 
    (currentStats?.outreach?.calls_made || 0) + 
    (currentStats?.outreach?.hotsheets_distributed || 0);

  const totalMarketingActions = totalSocialPosts + totalOutreachActions;

  // Empty state with executive summary
  if (activities.length === 0) {
    return (
      <Card className="border-0 shadow-xl bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Marketing Activity Timeline</CardTitle>
              <CardDescription>Every action we take to promote your property</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-12">
          <div className="max-w-2xl mx-auto text-center">
            {/* Decorative elements */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl" />
              </div>
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mx-auto flex items-center justify-center shadow-lg">
                <Megaphone className="w-10 h-10 text-primary" />
              </div>
            </div>
            
            {currentStats ? (
              <>
                <h3 className="text-xl font-semibold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Marketing Summary for {propertyName}
                </h3>
                
                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-500/5 border border-pink-500/10">
                    <Instagram className="w-5 h-5 text-pink-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{currentStats.social_media?.instagram_posts || 0}</p>
                    <p className="text-xs text-muted-foreground">Instagram</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/10">
                    <Facebook className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{currentStats.social_media?.facebook_posts || 0}</p>
                    <p className="text-xs text-muted-foreground">Facebook</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-500/10 to-teal-500/5 border border-slate-500/10">
                    <Video className="w-5 h-5 text-slate-700 dark:text-slate-300 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{currentStats.social_media?.tiktok_posts || 0}</p>
                    <p className="text-xs text-muted-foreground">TikTok</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/10">
                    <MapPin className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{currentStats.social_media?.gmb_posts || 0}</p>
                    <p className="text-xs text-muted-foreground">Google</p>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6 leading-relaxed max-w-xl mx-auto">
                  {currentStats.executive_summary || 
                    `This month we've completed ${totalMarketingActions} marketing actions for your property, including ${totalSocialPosts} social media posts and ${totalOutreachActions} corporate outreach efforts.`}
                </p>
                
                <Badge className="bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 px-4 py-2">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marketing Active
                </Badge>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-4">No Marketing Activities Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Marketing data will appear here once we begin promoting your property. Stay tuned!
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Timeline with activities
  return (
    <Card className="border-0 shadow-xl bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Marketing Activity Timeline</CardTitle>
              <CardDescription>Every action we take to promote your property</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="hidden md:flex gap-1.5">
            <Sparkles className="w-3 h-3" />
            {activities.length} Activities
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-border to-border" />

          <div className="divide-y divide-border/50">
            {activities.map((activity, index) => {
              const meta = getActivityMeta(activity.activity_type);
              const stayContext = getStayContext(activity);
              const isExpanded = expandedActivity === activity.id;
              const isFirst = index === 0;
              
              return (
                <div 
                  key={activity.id} 
                  className={cn(
                    "relative pl-16 pr-6 py-6 transition-all duration-300 cursor-pointer",
                    "hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent",
                    isFirst && "bg-gradient-to-r from-primary/5 to-transparent"
                  )}
                  onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}
                >
                  {/* Timeline node */}
                  <div className={cn(
                    "absolute left-5 top-6 w-7 h-7 rounded-full flex items-center justify-center",
                    "ring-4 ring-background shadow-lg transition-transform duration-300",
                    meta.bgGradient,
                    isExpanded && "scale-110"
                  )}>
                    <div className={meta.color}>
                      {meta.icon}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-base">{formatActivityTitle(activity)}</span>
                          {activity.platform && (
                            <Badge variant="outline" className="text-xs border-border/50">
                              {activity.platform}
                            </Badge>
                          )}
                          {meta.impactMetric && (
                            <Badge className="bg-gradient-to-r from-primary/20 to-primary/10 text-primary border-0 text-xs">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                              {meta.impactMetric}
                            </Badge>
                          )}
                        </div>

                        {/* Guest context card */}
                        {(activity.guest_info || stayContext) && (
                          <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-transparent rounded-xl p-3 mb-2 border border-border/30">
                            <div className="flex items-center gap-4 flex-wrap text-sm">
                              {activity.guest_info?.guest_name && (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <span className="font-medium">{activity.guest_info.guest_name}</span>
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
                                      {stayContext.nights} nights
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                          {formatDistanceToNow(new Date(activity.activity_date), { addSuffix: true })}
                        </span>
                        {activity.activity_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(activity.activity_url!, "_blank");
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    <div className={cn(
                      "space-y-3 transition-all duration-300",
                      isExpanded ? "opacity-100 max-h-96" : "opacity-0 max-h-0 overflow-hidden md:opacity-100 md:max-h-96"
                    )}>
                      {/* Purpose */}
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Info className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              Why This Matters
                            </p>
                            <p className="text-sm text-foreground/80">
                              {activity.description || meta.purpose}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Industry Insight */}
                      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent rounded-xl p-4 border border-amber-500/10">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                              Industry Insight
                            </p>
                            <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
                              {meta.industryInsight}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    {Object.keys(activity.metrics || {}).length > 0 && (
                      <div className="flex items-center gap-4 text-sm pt-2">
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
                      </div>
                    )}

                    {/* Mobile expand hint */}
                    <p className="text-xs text-muted-foreground md:hidden">
                      {isExpanded ? "Tap to collapse" : "Tap for details"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      {/* Trust footer */}
      <div className="border-t bg-muted/20 px-6 py-4">
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Professionally Managed</span>
          </div>
          <Separator orientation="vertical" className="h-4 hidden md:block" />
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            <span>Data-Driven Strategy</span>
          </div>
          <Separator orientation="vertical" className="h-4 hidden md:block" />
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span>Maximizing Revenue</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
