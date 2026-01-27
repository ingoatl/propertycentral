import { useRef, useEffect, useState, useCallback } from "react";
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
  scrollDuration = 12,
  isActive = true
}: AutoScrollImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Only animate if image is significantly taller than container (>80px overflow)
  const SCROLL_THRESHOLD = 80;

  // Calculate scroll amount based on actual rendered dimensions
  const calculateScroll = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    
    if (!img || !container || !img.complete || img.naturalWidth === 0) return;
    
    const containerRect = container.getBoundingClientRect();
    const containerH = containerRect.height;
    const containerW = containerRect.width;
    
    // Calculate the actual rendered height based on container width and image aspect ratio
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const renderedHeight = containerW / aspectRatio;
    
    // Calculate overflow - only scroll if significantly taller
    const overflow = Math.max(0, renderedHeight - containerH);
    
    if (overflow > SCROLL_THRESHOLD) {
      setScrollAmount(overflow);
    } else {
      setScrollAmount(0);
    }
  }, []);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      calculateScroll();
    });
  }, [calculateScroll]);

  // Reset when src changes
  useEffect(() => {
    setIsLoaded(false);
    setScrollAmount(0);
  }, [src]);

  // Recalculate on resize
  useEffect(() => {
    if (!isLoaded) return;
    
    const handleResize = () => {
      calculateScroll();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoaded, calculateScroll]);

  const shouldAnimate = scrollAmount > 0 && isActive && isLoaded;

  // Container uses a calculated fixed height for consistency
  // This leaves room for header (~120px), callout (~60px), nav (~80px), padding (~20px)
  const containerStyle = {
    height: "calc(100vh - 280px)",
    maxHeight: "55vh",
    minHeight: "200px"
  };

  return (
    <div 
      ref={containerRef}
      className={`rounded-xl overflow-hidden shadow-2xl border border-white/10 relative w-full ${className}`}
      style={containerStyle}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/10 animate-pulse rounded-xl" />
      )}
      
      {shouldAnimate ? (
        // Animated scrolling image for tall content
        <motion.img 
          key={`${src}-animated`}
          ref={imageRef}
          src={src}
          alt={alt}
          className="w-full h-auto"
          style={{ willChange: "transform" }}
          onLoad={handleImageLoad}
          initial={{ y: 0, opacity: 0 }}
          animate={{ 
            y: [0, -scrollAmount, 0],
            opacity: 1
          }}
          transition={{ 
            y: {
              duration: scrollDuration, 
              ease: "easeInOut", 
              repeat: Infinity, 
              repeatDelay: 3
            },
            opacity: {
              duration: 0.5
            }
          }}
        />
      ) : (
        // Static image that fits within container
        <img 
          ref={imageRef}
          src={src}
          alt={alt}
          className={`w-full h-full object-contain object-top transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleImageLoad}
        />
      )}
    </div>
  );
}
