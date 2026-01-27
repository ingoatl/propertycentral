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

  useEffect(() => {
    if (!isLoaded || !containerRef.current || !imageRef.current) return;

    const containerHeight = containerRef.current.clientHeight;
    const imageHeight = imageRef.current.clientHeight;
    
    // Calculate how much we need to scroll (image height - container height)
    const overflow = Math.max(0, imageHeight - containerHeight);
    setScrollAmount(overflow);
  }, [isLoaded]);

  return (
    <div 
      ref={containerRef}
      className="rounded-xl overflow-hidden shadow-2xl border border-white/10 max-h-[60vh] relative"
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
          repeatDelay: 1.5
        } : undefined}
      />
    </div>
  );
}
