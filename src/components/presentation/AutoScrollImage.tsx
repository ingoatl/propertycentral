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
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Use ResizeObserver for reliable dimension tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.min(entry.contentRect.height, window.innerHeight * 0.55);
        setContainerHeight(height);
        setContainerWidth(entry.contentRect.width);
      }
    });

    // Initial measurement
    const rect = container.getBoundingClientRect();
    setContainerHeight(Math.min(rect.height, window.innerHeight * 0.55));
    setContainerWidth(rect.width);

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate scroll amount when image loads or container changes
  useEffect(() => {
    if (!isLoaded || !imageRef.current || containerHeight === 0 || containerWidth === 0) return;

    const img = imageRef.current;
    const naturalHeight = img.naturalHeight;
    const naturalWidth = img.naturalWidth;
    
    if (naturalWidth === 0 || naturalHeight === 0) return;
    
    // Calculate how tall the image will be when rendered at container width
    const aspectRatio = naturalWidth / naturalHeight;
    const renderedHeight = containerWidth / aspectRatio;
    
    // Calculate how much we need to scroll (with some padding)
    const overflow = Math.max(0, renderedHeight - containerHeight);
    
    console.log('AutoScrollImage calc:', { 
      src, 
      naturalHeight, 
      naturalWidth, 
      containerHeight, 
      containerWidth,
      renderedHeight,
      overflow 
    });
    
    setScrollAmount(overflow);
  }, [isLoaded, containerHeight, containerWidth, src]);

  const handleImageLoad = () => {
    setIsLoaded(true);
    // Force recalculation after a small delay to ensure dimensions are ready
    setTimeout(() => {
      if (imageRef.current && containerRef.current) {
        const img = imageRef.current;
        const container = containerRef.current;
        const naturalHeight = img.naturalHeight;
        const naturalWidth = img.naturalWidth;
        const cWidth = container.clientWidth;
        const cHeight = Math.min(container.clientHeight, window.innerHeight * 0.55);
        
        if (naturalWidth > 0 && naturalHeight > 0 && cWidth > 0) {
          const aspectRatio = naturalWidth / naturalHeight;
          const renderedHeight = cWidth / aspectRatio;
          const overflow = Math.max(0, renderedHeight - cHeight);
          setScrollAmount(overflow);
        }
      }
    }, 100);
  };

  // Reset when src changes
  useEffect(() => {
    setIsLoaded(false);
    setScrollAmount(0);
  }, [src]);

  const shouldAnimate = scrollAmount > 10 && isActive && isLoaded;

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 relative w-full"
      style={{ height: containerHeight > 0 ? `${containerHeight}px` : "55vh", maxHeight: "55vh" }}
    >
      <motion.img 
        key={src}
        ref={imageRef}
        src={src}
        alt={alt}
        className={`w-full h-auto ${className}`}
        onLoad={handleImageLoad}
        initial={{ y: 0 }}
        animate={shouldAnimate ? { 
          y: [0, -scrollAmount, 0] 
        } : { y: 0 }}
        transition={shouldAnimate ? { 
          duration: scrollDuration, 
          ease: "easeInOut", 
          repeat: Infinity, 
          repeatDelay: 1.5
        } : undefined}
      />
    </div>
  );
}
