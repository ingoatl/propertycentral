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
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Only animate if image is significantly taller than container (>100px overflow)
  const SCROLL_THRESHOLD = 100;

  // Calculate scroll amount when image loads
  const handleImageLoad = () => {
    const img = imageRef.current;
    const container = containerRef.current;
    
    if (!img || !container) return;
    
    // Get the rendered dimensions
    const containerRect = container.getBoundingClientRect();
    const containerH = containerRect.height;
    
    // Calculate rendered image height based on container width and aspect ratio
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const aspectRatio = naturalWidth / naturalHeight;
    const renderedHeight = containerRect.width / aspectRatio;
    
    // Only scroll if the image is significantly taller than the container
    const overflow = Math.max(0, renderedHeight - containerH);
    
    if (overflow > SCROLL_THRESHOLD) {
      setScrollAmount(overflow);
    } else {
      setScrollAmount(0);
    }
    
    setIsLoaded(true);
  };

  // Reset when src changes
  useEffect(() => {
    setIsLoaded(false);
    setScrollAmount(0);
  }, [src]);

  // Recalculate on resize
  useEffect(() => {
    if (!isLoaded) return;
    
    const handleResize = () => {
      handleImageLoad();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoaded]);

  const shouldAnimate = scrollAmount > 0 && isActive && isLoaded;

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 relative w-full max-h-[55vh]"
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
        // Static image that fits
        <img 
          ref={imageRef}
          src={src}
          alt={alt}
          className={`w-full h-auto max-h-[55vh] object-contain object-top ${className}`}
          onLoad={handleImageLoad}
        />
      )}
    </div>
  );
}