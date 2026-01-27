import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  Play, 
  Eye, 
  Heart, 
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  MapPin,
  Home,
  Video,
  Share2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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

interface SocialPostCardProps {
  post: SocialPost;
}

const platformConfig: Record<string, {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}> = {
  tiktok: {
    icon: <Video className="w-4 h-4" />,
    label: "TikTok",
    color: "text-slate-800 dark:text-slate-200",
    bgColor: "bg-gradient-to-br from-slate-100 to-teal-100 dark:from-slate-800/60 dark:to-teal-900/40",
  },
  instagram: {
    icon: <Instagram className="w-4 h-4" />,
    label: "Instagram",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/40 dark:to-purple-900/40",
  },
  facebook: {
    icon: <Facebook className="w-4 h-4" />,
    label: "Facebook",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
  },
  linkedin: {
    icon: <Linkedin className="w-4 h-4" />,
    label: "LinkedIn",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
  },
  google: {
    icon: <MapPin className="w-4 h-4" />,
    label: "Google",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  gmb: {
    icon: <MapPin className="w-4 h-4" />,
    label: "Google",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  nextdoor: {
    icon: <Home className="w-4 h-4" />,
    label: "Nextdoor",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/40",
  },
};

const formatNumber = (num?: number): string => {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const SocialPostCard = ({ post }: SocialPostCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const config = platformConfig[post.platform?.toLowerCase()] || {
    icon: <Share2 className="w-4 h-4" />,
    label: post.platform || "Social",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };

  const isVideo = post.media_type === "video";
  const isTikTok = post.platform?.toLowerCase() === "tiktok";
  const thumbnailUrl = post.thumbnail_url || post.media_url;
  const hasMedia = thumbnailUrl && !imageError;
  const truncatedCaption = post.caption && post.caption.length > 100 
    ? post.caption.slice(0, 100) + "..." 
    : post.caption;

  // Extract TikTok video ID from post URL
  const getTikTokVideoId = (): string | null => {
    if (!post.post_url) return null;
    const match = post.post_url.match(/video\/(\d+)/);
    return match ? match[1] : null;
  };

  const tiktokVideoId = getTikTokVideoId();

  const handleViewPost = () => {
    if (post.post_url) {
      window.open(post.post_url, "_blank", "noopener,noreferrer");
    }
  };

  const handlePlayVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.post_url) {
      // Open in new tab for TikTok since embedding is restricted
      window.open(post.post_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group border-border/50 bg-gradient-to-br from-background to-muted/20">
      {/* Media Preview */}
      <div className="relative aspect-[9/16] md:aspect-square bg-muted overflow-hidden">
        {isTikTok && tiktokVideoId ? (
          // TikTok video preview with thumbnail and play overlay
          <div 
            className="w-full h-full cursor-pointer relative"
            onClick={handlePlayVideo}
          >
            {post.thumbnail_url ? (
              <img
                src={post.thumbnail_url}
                alt={post.caption || "TikTok video"}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : post.media_url ? (
              <video
                src={post.media_url}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                muted
                playsInline
                preload="metadata"
                poster=""
                onError={() => setImageError(true)}
              />
            ) : (
              <div className={cn("w-full h-full flex items-center justify-center", config.bgColor)}>
                <Video className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
            
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-black/20 to-transparent group-hover:from-black/70">
              <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl transform transition-all duration-300 group-hover:scale-110 group-hover:bg-white">
                <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
              </div>
            </div>

            {/* TikTok branding */}
            <div className="absolute bottom-3 left-3 right-3">
              <div className="flex items-center gap-2 text-white text-sm">
                <Video className="w-4 h-4" />
                <span className="font-medium">Watch on TikTok</span>
              </div>
            </div>
          </div>
        ) : isVideo && post.media_url && !post.thumbnail_url ? (
          // Generic video preview
          <div className="w-full h-full relative" onClick={handlePlayVideo}>
            <video
              src={post.media_url}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              muted
              playsInline
              preload="metadata"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <Play className="w-7 h-7 text-primary ml-1" fill="currentColor" />
              </div>
            </div>
          </div>
        ) : hasMedia ? (
          <>
            <img
              src={thumbnailUrl}
              alt={post.caption || "Social post"}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer" onClick={handlePlayVideo}>
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play className="w-7 h-7 text-primary ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={cn("w-full h-full flex items-center justify-center", config.bgColor)}>
            <div className={cn("scale-[3] opacity-20", config.color)}>
              {config.icon}
            </div>
          </div>
        )}
        
        {/* Platform Badge */}
        <div className="absolute top-3 left-3">
          <Badge 
            variant="secondary" 
            className={cn(
              "gap-1.5 shadow-lg backdrop-blur-md bg-background/95 border-0",
              config.color
            )}
          >
            {config.icon}
            <span className="text-xs font-medium">{config.label}</span>
          </Badge>
        </div>

        {/* Metrics Overlay */}
        {(post.views || post.likes) && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 flex-wrap">
            {post.views ? (
              <div className="flex items-center gap-1 text-white text-sm font-medium bg-black/70 px-2.5 py-1.5 rounded-full backdrop-blur-sm">
                <Eye className="w-3.5 h-3.5" />
                <span>{formatNumber(post.views)}</span>
              </div>
            ) : null}
            {post.likes ? (
              <div className="flex items-center gap-1 text-white text-sm font-medium bg-black/70 px-2.5 py-1.5 rounded-full backdrop-blur-sm">
                <Heart className="w-3.5 h-3.5" />
                <span>{formatNumber(post.likes)}</span>
              </div>
            ) : null}
            {post.comments ? (
              <div className="flex items-center gap-1 text-white text-sm font-medium bg-black/70 px-2.5 py-1.5 rounded-full backdrop-blur-sm">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{formatNumber(post.comments)}</span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Caption */}
        {post.caption && (
          <p 
            className={cn(
              "text-sm text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors",
              !showFullCaption && "line-clamp-2"
            )}
            onClick={() => setShowFullCaption(!showFullCaption)}
          >
            {showFullCaption ? post.caption : truncatedCaption}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {post.published_at 
              ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true })
              : "Recently"
            }
          </span>
          
          {post.post_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs hover:bg-primary/10 hover:text-primary"
              onClick={handleViewPost}
            >
              {isVideo ? "Watch" : "View"} Post
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
