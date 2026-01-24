import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Play, X, ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

interface WorkOrderPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
}

interface WorkOrderBeforeAfterComparisonProps {
  beforePhotos: WorkOrderPhoto[];
  afterPhotos: WorkOrderPhoto[];
  onViewAll?: () => void;
}

const isVideoFile = (url: string, mediaType: string | null): boolean => {
  if (mediaType === 'video') return true;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v', '.MOV', '.MP4'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext.toLowerCase()));
};

export function WorkOrderBeforeAfterComparison({
  beforePhotos,
  afterPhotos,
  onViewAll,
}: WorkOrderBeforeAfterComparisonProps) {
  const [selectedMedia, setSelectedMedia] = useState<WorkOrderPhoto | null>(null);
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);

  const hasBefore = beforePhotos.length > 0;
  const hasAfter = afterPhotos.length > 0;
  const hasAnyMedia = hasBefore || hasAfter;

  const currentBefore = beforePhotos[beforeIndex];
  const currentAfter = afterPhotos[afterIndex];

  const navigateBefore = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setBeforeIndex((prev) => (prev - 1 + beforePhotos.length) % beforePhotos.length);
    } else {
      setBeforeIndex((prev) => (prev + 1) % beforePhotos.length);
    }
  };

  const navigateAfter = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setAfterIndex((prev) => (prev - 1 + afterPhotos.length) % afterPhotos.length);
    } else {
      setAfterIndex((prev) => (prev + 1) % afterPhotos.length);
    }
  };

  const renderMediaHero = (
    media: WorkOrderPhoto | undefined,
    type: 'before' | 'after',
    count: number,
    onNavigate: (dir: 'prev' | 'next') => void,
    index: number
  ) => {
    const isVideo = media ? isVideoFile(media.photo_url, media.media_type) : false;
    const colors = type === 'before' 
      ? { bg: 'from-orange-500/20 to-red-500/20', border: 'border-orange-500/30', badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300' }
      : { bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300' };

    if (!media) {
      return (
        <div className={`flex-1 relative rounded-xl overflow-hidden bg-gradient-to-br ${colors.bg} ${colors.border} border-2 border-dashed`}>
          <div className="aspect-[16/10] flex flex-col items-center justify-center text-muted-foreground">
            <Camera className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium capitalize">No {type} photos</p>
            <p className="text-xs opacity-70 mt-1">Awaiting upload</p>
          </div>
          <Badge className={`absolute top-3 left-3 ${colors.badge}`}>
            {type === 'before' ? 'BEFORE' : 'AFTER'}
          </Badge>
        </div>
      );
    }

    return (
      <div 
        className={`flex-1 relative rounded-xl overflow-hidden ${colors.border} border group cursor-pointer`}
        onClick={() => setSelectedMedia(media)}
      >
        <div className="aspect-[16/10] bg-muted">
          {isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="h-8 w-8 text-white ml-1" fill="currentColor" />
              </div>
            </div>
          ) : (
            <img
              src={media.photo_url}
              alt={`${type} photo`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Type badge */}
        <Badge className={`absolute top-3 left-3 ${colors.badge} uppercase text-xs font-semibold`}>
          {type}
        </Badge>
        
        {/* Count badge */}
        {count > 1 && (
          <Badge className="absolute top-3 right-3 bg-black/60 text-white border-white/20">
            {index + 1} / {count}
          </Badge>
        )}
        
        {/* Navigation arrows */}
        {count > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onNavigate('prev'); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); onNavigate('next'); }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
        
        {/* Timestamp footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-xs text-white/80">
            {format(new Date(media.created_at), "MMM d, h:mm a")}
          </p>
        </div>
      </div>
    );
  };

  if (!hasAnyMedia) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No photos uploaded yet</p>
          <p className="text-sm opacity-70 mt-1">Before and after photos will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Before & After Comparison
              </span>
            </div>
            {onViewAll && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={onViewAll}>
                View All Media →
              </Button>
            )}
          </div>
          
          <div className="flex gap-4">
            {renderMediaHero(currentBefore, 'before', beforePhotos.length, navigateBefore, beforeIndex)}
            {renderMediaHero(currentAfter, 'after', afterPhotos.length, navigateAfter, afterIndex)}
          </div>
          
          {/* Photo counts */}
          <div className="flex justify-between mt-3 text-xs text-muted-foreground">
            <span>{beforePhotos.length} before photo{beforePhotos.length !== 1 ? 's' : ''}</span>
            <span>{afterPhotos.length} after photo{afterPhotos.length !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          {selectedMedia && (
            <div className="relative">
              {isVideoFile(selectedMedia.photo_url, selectedMedia.media_type) ? (
                <video
                  src={selectedMedia.photo_url}
                  controls
                  autoPlay
                  className="w-full max-h-[80vh] object-contain"
                />
              ) : (
                <img
                  src={selectedMedia.photo_url}
                  alt={selectedMedia.caption || "Work order media"}
                  className="w-full max-h-[80vh] object-contain"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <Badge className="bg-white/20 text-white border-white/30 capitalize mb-1">
                      {selectedMedia.photo_type}
                    </Badge>
                    {selectedMedia.caption && (
                      <p className="text-sm text-white/80">{selectedMedia.caption}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-white/60">
                    <p>{selectedMedia.uploaded_by || 'Vendor'}</p>
                    <p>{format(new Date(selectedMedia.created_at), "MMM d, h:mm a")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
