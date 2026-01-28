import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Home, Volume2, VolumeX, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useStoredPresentationAudio } from "@/hooks/useStoredPresentationAudio";

// Import slides
import { DesignerTitleSlide } from "@/components/presentation/designer-slides/DesignerTitleSlide";
import { MeetIlanaSlide } from "@/components/presentation/designer-slides/MeetIlanaSlide";
import { WhyDesignMattersSlide } from "@/components/presentation/designer-slides/WhyDesignMattersSlide";
import { TransformationProcessSlide } from "@/components/presentation/designer-slides/TransformationProcessSlide";
import { BeforeAfterSlide } from "@/components/presentation/designer-slides/BeforeAfterSlide";
import { InvestmentGuideSlide } from "@/components/presentation/designer-slides/InvestmentGuideSlide";
import { DesignerFAQSlide } from "@/components/presentation/designer-slides/DesignerFAQSlide";
import { DesignerClosingSlide } from "@/components/presentation/designer-slides/DesignerClosingSlide";

// Slide narration scripts for ElevenLabs TTS
const SLIDE_SCRIPTS: Record<string, string> = {
  "title": "Welcome. PeachHaus has partnered with Handy Honey to offer you something special: professional design and staging services that transform your property into a booking magnet.",
  "meet-ilana": "Meet Ilana Weismark, the creative force behind Handy Honey. With 15 years of home staging experience, Ilana specializes in transforming rental properties into stunning spaces that command premium rates. Her motto? Sweet fixes without the nagging. She handles everything from design to installation, so you don't have to lift a finger.",
  "why-design": "In today's competitive rental market, first impressions are everything. Properties with professional staging command 20 to 40 percent higher nightly rates and receive three times more listing clicks. Design isn't an expense. It's an investment with measurable returns.",
  "process": "Ilana's process is simple and stress-free. It starts with a consultation walkthrough, followed by a custom design plan with budget options. She handles all sourcing, coordinates installation, and delivers your property photo-ready. Average timeline is 2 to 6 weeks depending on scope.",
  "case-whitehurst": "Take a look at Whitehurst in Marietta. This property received a complete transformation with an investment of 30 to 40 thousand dollars. The result? A stunning, modern space that photographs beautifully and attracts premium guests. You can verify this listing live on Airbnb.",
  "case-southvale": "Southvale started as an empty shell. With a 25 thousand dollar investment in 2025, Ilana transformed it into a cohesive, guest-focused retreat. Notice the modern aesthetic, the coordinated furnishings, and the attention to detail that makes guests feel at home.",
  "case-justice": "Justice is a perfect example of high-impact design on a modest budget. Just 23 thousand dollars in 2024 created this warm, inviting living space. The stone fireplace becomes a stunning focal point, and the color coordination throughout creates a memorable guest experience.",
  "case-lakewood": "Lakewood shows what's possible with smart design choices. An investment of 23 thousand dollars in 2024 turned empty rooms into warm, cozy spaces with a functional layout. Twin beds maximize flexibility for different guest configurations.",
  "case-brushy": "Brushy underwent a complete renovation, transforming from a construction zone into an elegant home. For 23 thousand dollars in 2024, Ilana created photo-ready spaces with natural elements and inviting atmospheres that photograph beautifully.",
  "case-tolani": "To Lani proves that thoughtful design doesn't require a massive budget. With just 20 thousand dollars in 2023, Ilana created this stunning bedroom with a signature accent wall, curated artwork, and cohesive styling that consistently earns five-star reviews.",
  "investment": "Investment levels range from 5 thousand for a room refresh, to 10 thousand for full staging from scratch, up to 20 to 40 thousand for a premium overhaul. Design fees cover consultation, sourcing, project management, and installation. Furniture is purchased separately at cost with no markups.",
  "faq": "Common questions: Projects typically take 2 to 6 weeks. You don't need to be present during installation. Ilana can work with your existing furniture or recommend replacements. And most owners recoup their investment within 6 to 12 months.",
  "closing": "Ready to transform your property? Schedule a free consultation with Ilana to discuss your vision. She handles everything, coordinating directly with PeachHaus. Call 770-312-6723 or visit handyhoney.net. Design is not just an expense. It's an investment with measurable ROI.",
};

const SLIDES = [
  { id: "title", component: DesignerTitleSlide, label: "Welcome" },
  { id: "meet-ilana", component: MeetIlanaSlide, label: "Ilana" },
  { id: "why-design", component: WhyDesignMattersSlide, label: "Impact" },
  { id: "process", component: TransformationProcessSlide, label: "Process" },
  { id: "case-whitehurst", component: () => <BeforeAfterSlide propertyKey="whitehurst" />, label: "Whitehurst" },
  { id: "case-southvale", component: () => <BeforeAfterSlide propertyKey="southvale" />, label: "Southvale" },
  { id: "case-justice", component: () => <BeforeAfterSlide propertyKey="justice" />, label: "Justice" },
  { id: "case-lakewood", component: () => <BeforeAfterSlide propertyKey="lakewood" />, label: "Lakewood" },
  { id: "case-brushy", component: () => <BeforeAfterSlide propertyKey="brushy" />, label: "Brushy" },
  { id: "case-tolani", component: () => <BeforeAfterSlide propertyKey="tolani" />, label: "To Lani" },
  { id: "investment", component: InvestmentGuideSlide, label: "Pricing" },
  { id: "faq", component: DesignerFAQSlide, label: "FAQ" },
  { id: "closing", component: DesignerClosingSlide, label: "Contact" },
];

export default function DesignerPresentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const touchStartX = useRef<number | null>(null);
  
  // Audio hook for narration
  const {
    playAudioForSlide,
    stopAudio,
    isMuted,
    toggleMute,
    isPlaying,
    isLoading,
    initAudioContext,
  } = useStoredPresentationAudio({ presentation: "designer" });

  const goToSlide = useCallback((index: number, autoAdvance = false) => {
    if (index >= 0 && index < SLIDES.length && !isTransitioning) {
      setIsTransitioning(true);
      stopAudio();
      setCurrentSlide(index);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [isTransitioning, stopAudio]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  // Play audio for current slide when it changes (if started and not muted)
  useEffect(() => {
    if (hasStarted && !isTransitioning && isAutoPlaying) {
      const slideId = SLIDES[currentSlide].id;
      const script = SLIDE_SCRIPTS[slideId] || "";
      
      const timer = setTimeout(() => {
        playAudioForSlide(slideId, script, () => {
          // Add 2 second pause before auto-advancing to next slide
          setTimeout(() => {
            if (currentSlide < SLIDES.length - 1 && isAutoPlaying) {
              goToSlide(currentSlide + 1, true);
            }
          }, 2000);
        });
      }, 600); // Wait for slide transition
      
      return () => clearTimeout(timer);
    }
  }, [currentSlide, hasStarted, isTransitioning, isAutoPlaying, playAudioForSlide, goToSlide]);

  // Handle presentation start
  const handleStart = useCallback(() => {
    initAudioContext();
    setHasStarted(true);
  }, [initAudioContext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "Enter":
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
        case "Backspace":
          e.preventDefault();
          prevSlide();
          break;
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen?.();
          }
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        default:
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            goToSlide(num - 1);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, isFullscreen, toggleMute]);

  // Touch swipe support
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
      touchStartX.current = null;
    };
    
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [nextSlide, prevSlide]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const CurrentSlideComponent = SLIDES[currentSlide].component;

  // Start overlay
  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-[#0a0a1a] flex items-center justify-center z-50">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Designer <span className="text-amber-400">Showcase</span>
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
            Discover how professional staging transforms rental properties into booking magnets
          </p>
          <Button
            onClick={handleStart}
            className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white px-8 py-6 text-lg rounded-full"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Presentation
          </Button>
          <p className="text-white/40 text-sm mt-4">
            Click to enable audio narration
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a1a] overflow-hidden">
      {/* Slide Content */}
      <div
        className={cn(
          "w-full h-full transition-all duration-500 ease-out",
          isTransitioning ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
        )}
      >
        <CurrentSlideComponent />
      </div>

      {/* Navigation Controls */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
        {/* Previous Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-30 backdrop-blur-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Slide Indicators */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentSlide
                  ? "w-6 bg-gradient-to-r from-amber-400 to-orange-500"
                  : "bg-white/30 hover:bg-white/50"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Next Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={nextSlide}
          disabled={currentSlide === SLIDES.length - 1}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-30 backdrop-blur-sm"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Top Controls */}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-2">
        <Link to="/">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
          >
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        
        {/* Mute/Unmute */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        
        {/* Auto-play toggle - also controls audio */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const newState = !isAutoPlaying;
            setIsAutoPlaying(newState);
            // If pausing, also stop any playing audio
            if (!newState) {
              stopAudio();
            }
          }}
          className={cn(
            "h-9 w-9 rounded-full border backdrop-blur-sm",
            isAutoPlaying 
              ? "bg-amber-400/20 hover:bg-amber-400/30 text-amber-400 border-amber-400/30" 
              : "bg-white/10 hover:bg-white/20 text-white border-white/20"
          )}
        >
          {isAutoPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        
        {/* Loading/Playing indicator */}
        {(isLoading || isPlaying) && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/30">
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="flex items-center gap-0.5">
                {[1,2,3].map(i => (
                  <div 
                    key={i} 
                    className="w-1 bg-amber-400 rounded-full animate-pulse"
                    style={{ 
                      height: `${8 + (i * 4)}px`,
                      animationDelay: `${i * 0.15}s`
                    }}
                  />
                ))}
              </div>
            )}
            <span className="text-amber-400 text-xs font-medium">
              {isLoading ? "Loading..." : "Playing"}
            </span>
          </div>
        )}
      </div>

      <div className="fixed top-6 right-6 flex items-center gap-3 z-50">
        <span className="text-white/60 text-sm font-medium">
          {currentSlide + 1} / {SLIDES.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Keyboard Hints */}
      <div className="fixed bottom-6 right-6 text-white/40 text-xs z-50 hidden md:block">
        <span>← → Navigate</span>
        <span className="mx-2">•</span>
        <span>M Mute</span>
        <span className="mx-2">•</span>
        <span>F Fullscreen</span>
      </div>
    </div>
  );
}
