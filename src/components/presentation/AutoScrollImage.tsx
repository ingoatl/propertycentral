import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AutoScrollImageProps {
  src: string;
  alt: string;
  className?: string;
  scrollDuration?: number;
  isActive?: boolean;
}

export function AutoScrollImage({ 
  src, 
  alt, 
  className = "",
  scrollDuration = 8,
  isActive = true
}: AutoScrollImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const staticImageRef = useRef<HTMLImageElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fixed container height for consistency
  const CONTAINER_HEIGHT = "50vh";
  const SCROLL_THRESHOLD = 50; // Only animate if overflow > 50px

  // Calculate scroll amount when image loads
  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    const calculateOverflow = () => {
      const container = containerRef.current;
      const img = imageRef.current || staticImageRef.current;
      if (!img || !container) return;

      const naturalHeight = img.naturalHeight;
      const naturalWidth = img.naturalWidth;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      if (naturalWidth === 0 || naturalHeight === 0 || containerWidth === 0) return;
      
      // Calculate how tall the image will be when rendered at container width
      const aspectRatio = naturalWidth / naturalHeight;
      const renderedHeight = containerWidth / aspectRatio;
      
      // Calculate overflow (how much taller the image is than the container)
      const overflow = Math.max(0, renderedHeight - containerHeight);
      
      console.log('AutoScrollImage calc:', { 
        src, 
        naturalHeight, 
        naturalWidth, 
        containerHeight, 
        containerWidth,
        renderedHeight,
        overflow,
        willAnimate: overflow > SCROLL_THRESHOLD
      });
      
      setScrollAmount(overflow);
    };

    // Calculate after a small delay to ensure container is sized
    const timer = setTimeout(calculateOverflow, 100);
    
    // Also recalculate on resize
    const resizeObserver = new ResizeObserver(calculateOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [isLoaded, src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  // Reset when src changes
  useEffect(() => {
    setIsLoaded(false);
    setScrollAmount(0);
  }, [src]);

  const shouldAnimate = scrollAmount > SCROLL_THRESHOLD && isActive && isLoaded;

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 relative w-full"
      style={{ height: CONTAINER_HEIGHT }}
    >
      {shouldAnimate ? (
        // Animated scrolling image for tall content
        <motion.img 
          key={`${src}-animated`}
          ref={imageRef}
          src={src}
          alt={alt}
          className={`w-full h-auto ${className}`}
          onLoad={handleImageLoad}
          initial={{ y: 0 }}
          animate={{ y: [0, -scrollAmount, 0] }}
          transition={{ 
            duration: scrollDuration, 
            ease: "easeInOut", 
            repeat: Infinity, 
            repeatDelay: 2
          }}
        />
      ) : (
        // Static centered image for content that fits
        <img 
          ref={staticImageRef}
          src={src}
          alt={alt}
          className={`w-full h-full object-contain object-top ${className}`}
          onLoad={handleImageLoad}
        />
      )}
    </div>
  );
}
