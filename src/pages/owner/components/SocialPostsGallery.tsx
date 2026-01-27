import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { SocialPostCard } from "./SocialPostCard";
import { 
  Share2, 
  Instagram, 
  Facebook, 
  Linkedin, 
  MapPin, 
  Home,
  Video,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialPost {
  id: string;
  platform: string;
  post_type: string;
  caption?: string;
  media_url?: string;
  media_type?: string;
  thumbnail_url?: string;
  post_url?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  published_at?: string;
  status?: string;
}

interface SocialPostsGalleryProps {
  propertyId: string;
  propertyName: string;
}

const platformFilters = [
  { key: "all", label: "All", icon: <Share2 className="w-4 h-4" /> },
  { key: "tiktok", label: "TikTok", icon: <Video className="w-4 h-4" /> },
  { key: "instagram", label: "Instagram", icon: <Instagram className="w-4 h-4" /> },
  { key: "facebook", label: "Facebook", icon: <Facebook className="w-4 h-4" /> },
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4" /> },
  { key: "gmb", label: "Google", icon: <MapPin className="w-4 h-4" /> },
  { key: "nextdoor", label: "Nextdoor", icon: <Home className="w-4 h-4" /> },
];

export const SocialPostsGallery = ({ propertyId, propertyName }: SocialPostsGalleryProps) => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadPosts();
  }, [propertyId]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("social_media_posts")
        .select("*")
        .eq("property_id", propertyId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setPosts(data || []);
      
      // Calculate platform counts
      const counts: Record<string, number> = {};
      (data || []).forEach(post => {
        const platform = post.platform?.toLowerCase() || "unknown";
        counts[platform] = (counts[platform] || 0) + 1;
      });
      setPlatformCounts(counts);
    } catch (error) {
      console.error("[SocialPostsGallery] Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("ghl-sync-social-posts", {
        body: { daysBack: 90 },
      });

      if (error) throw error;
      
      // Reload posts after sync
      await loadPosts();
    } catch (error) {
      console.error("[SocialPostsGallery] Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  const filteredPosts = activeFilter === "all" 
    ? posts 
    : posts.filter(p => p.platform?.toLowerCase() === activeFilter);

  const availablePlatforms = platformFilters.filter(
    pf => pf.key === "all" || platformCounts[pf.key] > 0
  );

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Share2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No Social Posts Yet</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
            Social media posts featuring your property will appear here once they're published.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={triggerSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Check for Posts"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-5 h-5 text-primary" />
              Social Media Posts
            </CardTitle>
            <CardDescription className="mt-1">
              {posts.length} posts featuring {propertyName}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={triggerSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Platform Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {availablePlatforms.map(platform => (
            <Button
              key={platform.key}
              variant={activeFilter === platform.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(platform.key)}
              className={cn(
                "gap-1.5 shrink-0 rounded-full",
                activeFilter === platform.key 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted"
              )}
            >
              {platform.icon}
              <span>{platform.label}</span>
              {platform.key !== "all" && platformCounts[platform.key] && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-1 h-5 px-1.5 text-xs",
                    activeFilter === platform.key && "bg-primary-foreground/20 text-primary-foreground"
                  )}
                >
                  {platformCounts[platform.key]}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPosts.map(post => (
            <SocialPostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Show more link */}
        {filteredPosts.length >= 12 && (
          <div className="text-center pt-4">
            <Button variant="ghost" className="gap-2">
              View All Posts
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
