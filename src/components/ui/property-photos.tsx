import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, Loader2, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PropertyPhotosProps {
  address: string;
  className?: string;
  height?: string;
}

export function PropertyPhotos({
  address,
  className = "",
  height = "200px",
}: PropertyPhotosProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      setError("No address provided");
      return;
    }

    const fetchPhotos = async () => {
      setLoading(true);
      setError(null);
      setImageLoadError(false);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "get-property-photos",
          { body: { address } }
        );

        if (fnError) throw fnError;

        if (data?.photos && data.photos.length > 0) {
          setPhotos(data.photos);
        } else {
          setError("No photos found");
        }
      } catch (err) {
        console.error("[PropertyPhotos] Error:", err);
        setError("Could not load photos");
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [address]);

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setImageLoadError(false);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setImageLoadError(false);
  };

  const handleImageError = () => {
    // If this photo fails, try the next one
    if (photos.length > 1 && currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setImageLoadError(true);
    }
  };

  if (loading) {
    return (
      <div
        className={`bg-muted rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading property photos...</span>
        </div>
      </div>
    );
  }

  // Show fallback if no photos or all images failed to load
  if (error || photos.length === 0 || imageLoadError) {
    // Generate a static map as visual fallback
    const staticMapUrl = address 
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=17&size=600x400&maptype=hybrid&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`
      : null;

    return (
      <div
        className={`relative bg-gradient-to-br from-muted to-muted/50 rounded-lg overflow-hidden border ${className}`}
        style={{ height }}
      >
        {staticMapUrl ? (
          <>
            <img 
              src={staticMapUrl} 
              alt="Property location"
              className="w-full h-full object-cover opacity-60"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
              <MapPin className="h-8 w-8 text-white drop-shadow-lg" />
              <p className="text-sm text-white font-medium mt-2 drop-shadow-lg text-center px-4">
                Satellite View
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center px-4">
              {error || "No property photos available"}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`} style={{ height }}>
      <img
        src={photos[currentIndex]}
        alt={`Property photo ${currentIndex + 1}`}
        className="w-full h-full object-cover rounded-lg"
        onError={handleImageError}
      />

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Photo counter */}
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 6 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {photos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setImageLoadError(false);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                idx === currentIndex ? "bg-white" : "bg-white/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
