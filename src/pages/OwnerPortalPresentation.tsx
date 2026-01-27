import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  Home, 
  Maximize, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OwnerPortalIntroSlide } from "@/components/presentation/owner-portal-slides/OwnerPortalIntroSlide";
import { OverviewSlide } from "@/components/presentation/owner-portal-slides/OverviewSlide";
import { InsightsSlide } from "@/components/presentation/owner-portal-slides/InsightsSlide";
import { BookingsSlide } from "@/components/presentation/owner-portal-slides/BookingsSlide";
import { StatementsSlide } from "@/components/presentation/owner-portal-slides/StatementsSlide";
import { ExpensesSlide } from "@/components/presentation/owner-portal-slides/ExpensesSlide";
import { MessagesSlide } from "@/components/presentation/owner-portal-slides/MessagesSlide";
import { RepairsSlide } from "@/components/presentation/owner-portal-slides/RepairsSlide";
import { ScreeningsSlide } from "@/components/presentation/owner-portal-slides/ScreeningsSlide";
import { MarketingSlide } from "@/components/presentation/owner-portal-slides/MarketingSlide";
import { OwnerPortalClosingSlide } from "@/components/presentation/owner-portal-slides/OwnerPortalClosingSlide";

const SLIDES = [
  { id: "intro", label: "Intro", duration: 5000 },
  { id: "overview", label: "Overview", duration: 10000 },
  { id: "insights", label: "Insights", duration: 8000 },
  { id: "bookings", label: "Bookings", duration: 6000 },
  { id: "statements", label: "Statements", duration: 5000 },
  { id: "expenses", label: "Expenses", duration: 7000 },
  { id: "messages", label: "Messages", duration: 10000 },
  { id: "repairs", label: "Repairs", duration: 7000 },
  { id: "screenings", label: "Screenings", duration: 7000 },
  { id: "marketing", label: "Marketing", duration: 6000 },
  { id: "closing", label: "CTA", duration: 5000 },
];

export default function OwnerPortalPresentation() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance slides
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      if (currentSlide < SLIDES.length - 1) {
        setCurrentSlide((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, SLIDES[currentSlide].duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentSlide, isPlaying]);

  // Scroll to current slide
  useEffect(() => {
    const slideEl = slideRefs.current[currentSlide];
    if (slideEl) {
      slideEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentSlide]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (currentSlide < SLIDES.length - 1) {
          setCurrentSlide((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentSlide > 0) {
          setCurrentSlide((prev) => prev - 1);
        }
      } else if (e.key === "Escape") {
        setIsPlaying(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPlaying(false);
  };

  const restart = () => {
    setCurrentSlide(0);
    setIsPlaying(true);
  };

  const progress = ((currentSlide + 1) / SLIDES.length) * 100;

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-[#0a0a1a] overflow-y-auto scroll-smooth"
    >
      {/* Slides */}
      {SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          ref={(el) => (slideRefs.current[index] = el)}
          className="min-h-screen"
        >
          {slide.id === "intro" && <OwnerPortalIntroSlide />}
          {slide.id === "overview" && <OverviewSlide isActive={currentSlide === index} />}
          {slide.id === "insights" && <InsightsSlide />}
          {slide.id === "bookings" && <BookingsSlide />}
          {slide.id === "statements" && <StatementsSlide />}
          {slide.id === "expenses" && <ExpensesSlide />}
          {slide.id === "messages" && <MessagesSlide />}
          {slide.id === "repairs" && <RepairsSlide />}
          {slide.id === "screenings" && <ScreeningsSlide />}
          {slide.id === "marketing" && <MarketingSlide />}
          {slide.id === "closing" && <OwnerPortalClosingSlide />}
        </div>
      ))}

      {/* Fixed Navigation Bar */}
      <motion.div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="bg-black/80 backdrop-blur-lg border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 shadow-2xl">
          {/* Home */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/")}
          >
            <Home className="h-4 w-4" />
          </Button>

          {/* Prev */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            disabled={currentSlide === 0}
            onClick={() => setCurrentSlide((prev) => prev - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-white hover:bg-white/10 bg-[#fae052]/20"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 text-[#fae052]" />
            ) : (
              <Play className="h-5 w-5 text-[#fae052] ml-0.5" />
            )}
          </Button>

          {/* Next */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            disabled={currentSlide === SLIDES.length - 1}
            onClick={() => setCurrentSlide((prev) => prev + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Progress Dots */}
          <div className="flex items-center gap-1 px-2 border-l border-white/10 ml-1">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "bg-[#fae052] w-4"
                    : index < currentSlide
                    ? "bg-white/50"
                    : "bg-white/20"
                }`}
                title={slide.label}
              />
            ))}
          </div>

          {/* Restart */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 border-l border-white/10 ml-1"
            onClick={restart}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            onClick={toggleFullscreen}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <motion.div
          className="h-full bg-[#fae052]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Slide Counter */}
      <div className="fixed top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white/70 text-sm z-50">
        {currentSlide + 1} / {SLIDES.length}
      </div>
    </div>
  );
}
