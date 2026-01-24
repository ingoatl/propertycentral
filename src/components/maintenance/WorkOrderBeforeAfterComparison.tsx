import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Video, ChevronLeft, ChevronRight, Calendar, User, X, Play, Maximize2 } from "lucide-react";
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
  if (mediaType?.startsWith("video/")) return true;
  const ext = url.split(".").pop()?.toLowerCase();
  return ["mp4", "mov", "webm", "avi", "mkv"].includes(ext || "");
};

export function WorkOrderBeforeAfterComparison({
  beforePhotos,
  afterPhotos,
  onViewAll,
}: WorkOrderBeforeAfterComparisonProps) {
  const [selectedMedia, setSelectedMedia] = useState<WorkOrderPhoto | null>(null);
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);

  const navigateBefore = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setBeforeIndex((i) => (i > 0 ? i - 1 : beforePhotos.length - 1));
    } else {
      setBeforeIndex((i) => (i < beforePhotos.length - 1 ? i + 1 : 0));
    }
  };

  const navigateAfter = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setAfterIndex((i) => (i > 0 ? i - 1 : afterPhotos.length - 1));
    } else {
      setAfterIndex((i) => (i < afterPhotos.length - 1 ? i + 1 : 0));
    }
  };

  const currentBefore = beforePhotos[beforeIndex];
  const currentAfter = afterPhotos[afterIndex];
  const hasBeforeMedia = beforePhotos.length > 0;
  const hasAfterMedia = afterPhotos.length > 0;

  // Render a single media hero card
  const renderMediaHero = (
    photo: WorkOrderPhoto | undefined,
    photos: WorkOrderPhoto[],
    currentIndex: number,
    navigate: (dir: "prev" | "next") => void,
    label: "Before" | "After"
  ) => {
    const isEmpty = !photo;
    const isVideo = photo ? isVideoFile(photo.photo_url, photo.media_type) : false;
    const hasMultiple = photos.length > 1;

    if (isEmpty) {
      return (
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            {label}
          </div>
          <div className="aspect-[16/10] rounded-xl bg-muted/50 border-2 border-dashed flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No {label.toLowerCase()} photos</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />
            {label}
          </span>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {currentIndex + 1}/{photos.length}
          </Badge>
        </div>
        <div
          className="relative aspect-[16/10] rounded-xl overflow-hidden bg-muted group cursor-pointer"
          onClick={() => setSelectedMedia(photo)}
        >
          {isVideo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <video
                src={photo.photo_url}
                className="h-full w-full object-cover"
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <div className="h-14 w-14 rounded-full bg-background/90 flex items-center justify-center shadow-lg">
                  <Play className="h-6 w-6 text-foreground ml-1" />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={photo.photo_url}
              alt={`${label} photo`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
          
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-2 right-2">
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation arrows */}
          {hasMultiple && (
            <>
              <Button
                size="icon"
                variant="secondary"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); navigate("prev"); }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); navigate("next"); }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Video badge */}
          {isVideo && (
            <Badge className="absolute top-2 left-2 gap-1 text-[10px]">
              <Video className="h-3 w-3" />
              Video
            </Badge>
          )}
        </div>
        
        {/* Timestamp */}
        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(photo.created_at), "MMM d, h:mm a")}
        </p>
      </div>
    );
  };

  // If no media at all
  if (!hasBeforeMedia && !hasAfterMedia) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Camera className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No photos or videos uploaded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Media will appear here once the vendor uploads documentation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Side-by-side comparison */}
        <div className="flex gap-4">
          {renderMediaHero(currentBefore, beforePhotos, beforeIndex, navigateBefore, "Before")}
          {renderMediaHero(currentAfter, afterPhotos, afterIndex, navigateAfter, "After")}
        </div>

        {/* View all link */}
        {onViewAll && (beforePhotos.length + afterPhotos.length) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={onViewAll}
          >
            View All Media →
          </Button>
        )}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedMedia?.photo_type === "before" ? "Before" : "After"}
                </Badge>
                {selectedMedia && isVideoFile(selectedMedia.photo_url, selectedMedia.media_type) && (
                  <Badge variant="secondary" className="gap-1">
                    <Video className="h-3 w-3" />
                    Video
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-muted aspect-video">
            {selectedMedia && isVideoFile(selectedMedia.photo_url, selectedMedia.media_type) ? (
              <video
                src={selectedMedia.photo_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : selectedMedia ? (
              <img
                src={selectedMedia.photo_url}
                alt="Media"
                className="w-full h-full object-contain"
              />
            ) : null}
          </div>
          
          {selectedMedia && (
            <div className="p-4 space-y-2 border-t">
              {selectedMedia.caption && (
                <p className="text-sm">{selectedMedia.caption}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {selectedMedia.uploaded_by && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {selectedMedia.uploaded_by}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(selectedMedia.created_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
