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
  CheckCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

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
}

interface OwnerMarketingTabProps {
  propertyId: string;
  propertyName: string;
}

const activityIcons: Record<string, React.ReactNode> = {
  listing_created: <Home className="w-4 h-4" />,
  listing_updated: <RefreshCw className="w-4 h-4" />,
  campaign_launched: <Megaphone className="w-4 h-4" />,
  social_post: <Share2 className="w-4 h-4" />,
  email_blast: <Mail className="w-4 h-4" />,
  inquiry_received: <MessageSquare className="w-4 h-4" />,
  listing_view: <Eye className="w-4 h-4" />,
  booking_inquiry: <Calendar className="w-4 h-4" />,
};

const activityColors: Record<string, string> = {
  listing_created: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  listing_updated: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  campaign_launched: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  social_post: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  email_blast: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  inquiry_received: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  listing_view: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  booking_inquiry: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export const OwnerMarketingTab = ({ propertyId, propertyName }: OwnerMarketingTabProps) => {
  const [activities, setActivities] = useState<MarketingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregateMetrics, setAggregateMetrics] = useState({
    totalViews: 0,
    totalClicks: 0,
    totalInquiries: 0,
    activePlatforms: 0,
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

      const typedActivities = (activitiesData || []).map(a => ({
        ...a,
        metrics: (a.metrics as Record<string, number>) || {},
      }));
      setActivities(typedActivities);

      // Calculate aggregate metrics
      const metrics = typedActivities.reduce(
        (acc, activity) => {
          const m = activity.metrics as Record<string, number> || {};
          return {
            totalViews: acc.totalViews + (m.views || 0),
            totalClicks: acc.totalClicks + (m.clicks || 0),
            totalInquiries: acc.totalInquiries + (m.inquiries || 0),
            activePlatforms: acc.activePlatforms,
          };
        },
        { totalViews: 0, totalClicks: 0, totalInquiries: 0, activePlatforms: 0 }
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

  const formatActivityType = (type: string) => {
    return type
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <Eye className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.totalViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MousePointerClick className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.totalClicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Clicks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.totalInquiries}</p>
                <p className="text-xs text-muted-foreground">Inquiries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{aggregateMetrics.activePlatforms}</p>
                <p className="text-xs text-muted-foreground">Active Platforms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Marketing Activity Timeline</CardTitle>
          <CardDescription>
            Recent marketing efforts and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No marketing activities yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Marketing data will appear here once synced from our marketing platform.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 top-2 w-5 h-5 rounded-full flex items-center justify-center ${activityColors[activity.activity_type] || "bg-muted text-muted-foreground"}`}>
                      {activityIcons[activity.activity_type] || <CheckCircle className="w-3 h-3" />}
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{activity.title}</span>
                            {activity.platform && (
                              <Badge variant="secondary" className="text-xs">
                                {activity.platform}
                              </Badge>
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {activity.description}
                            </p>
                          )}

                          {/* Metrics */}
                          {Object.keys(activity.metrics || {}).length > 0 && (
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {activity.metrics.views !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {activity.metrics.views.toLocaleString()} views
                                </span>
                              )}
                              {activity.metrics.clicks !== undefined && (
                                <span className="flex items-center gap-1">
                                  <MousePointerClick className="w-3 h-3" />
                                  {activity.metrics.clicks.toLocaleString()} clicks
                                </span>
                              )}
                              {activity.metrics.inquiries !== undefined && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {activity.metrics.inquiries} inquiries
                                </span>
                              )}
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
                              className="h-6 w-6"
                              onClick={() => window.open(activity.activity_url!, "_blank")}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
