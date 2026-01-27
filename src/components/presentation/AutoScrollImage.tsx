import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AutoScrollImageProps {
  src: string;
  alt: string;
  className?: string;
  scrollDuration?: number;
}

export function AutoScrollImage({ 
  src, 
  alt, 
  className = "",
  scrollDuration = 8 
}: AutoScrollImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scrollAmount, setScrollAmount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate container height on mount and window resize
  useEffect(() => {
    const updateContainerHeight = () => {
      if (containerRef.current) {
        // Get the computed max height (60vh)
        const maxHeight = window.innerHeight * 0.6;
        setContainerHeight(maxHeight);
      }
    };

    updateContainerHeight();
    window.addEventListener("resize", updateContainerHeight);
    return () => window.removeEventListener("resize", updateContainerHeight);
  }, []);

  // Calculate scroll amount when image loads
  useEffect(() => {
    if (!isLoaded || !imageRef.current || containerHeight === 0) return;

    const imageHeight = imageRef.current.naturalHeight;
    const imageWidth = imageRef.current.naturalWidth;
    
    // Calculate rendered image height based on container width
    const containerWidth = containerRef.current?.clientWidth || 0;
    const renderedHeight = (containerWidth / imageWidth) * imageHeight;
    
    // Calculate how much we need to scroll
    const overflow = Math.max(0, renderedHeight - containerHeight);
    setScrollAmount(overflow);
  }, [isLoaded, containerHeight]);

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 relative"
      style={{ height: `${containerHeight}px`, maxHeight: "60vh" }}
    >
      <motion.img 
        ref={imageRef}
        src={src}
        alt={alt}
        className={`w-full h-auto ${className}`}
        onLoad={() => setIsLoaded(true)}
        initial={{ y: 0 }}
        animate={scrollAmount > 0 ? { 
          y: [0, -scrollAmount, 0] 
        } : { y: 0 }}
        transition={scrollAmount > 0 ? { 
          duration: scrollDuration, 
          ease: "easeInOut", 
          repeat: Infinity, 
          repeatDelay: 2
        } : undefined}
      />
    </div>
  );
}
