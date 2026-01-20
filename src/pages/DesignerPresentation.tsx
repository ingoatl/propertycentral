import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

// Import slides
import { DesignerTitleSlide } from "@/components/presentation/designer-slides/DesignerTitleSlide";
import { MeetIlanaSlide } from "@/components/presentation/designer-slides/MeetIlanaSlide";
import { WhyDesignMattersSlide } from "@/components/presentation/designer-slides/WhyDesignMattersSlide";
import { TransformationProcessSlide } from "@/components/presentation/designer-slides/TransformationProcessSlide";
import { BeforeAfterSlide } from "@/components/presentation/designer-slides/BeforeAfterSlide";
import { InvestmentGuideSlide } from "@/components/presentation/designer-slides/InvestmentGuideSlide";
import { DesignerFAQSlide } from "@/components/presentation/designer-slides/DesignerFAQSlide";
import { DesignerClosingSlide } from "@/components/presentation/designer-slides/DesignerClosingSlide";

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

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < SLIDES.length && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentSlide(index);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [isTransitioning]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

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
        default:
          // Number keys 1-9 for quick navigation
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            goToSlide(num - 1);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, goToSlide, isFullscreen]);

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
      <div className="fixed top-6 left-6 z-50">
        <Link to="/">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm"
          >
            <Home className="h-4 w-4" />
          </Button>
        </Link>
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
        <span>F Fullscreen</span>
      </div>
    </div>
  );
}
