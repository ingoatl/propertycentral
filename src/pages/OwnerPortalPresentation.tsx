import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  Home, 
  Maximize, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePresentationAudio } from "@/hooks/usePresentationAudio";
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

// Slide configuration with narration scripts
const SLIDES = [
  { 
    id: "intro", 
    label: "Intro", 
    duration: 6000,
    script: "Welcome to PeachHaus. Your property. Complete visibility."
  },
  { 
    id: "overview", 
    label: "Overview", 
    duration: 14000,
    script: "See your complete property performance at a glance. Total revenue, occupancy rates, and guest ratings updated in real-time. Every month, you'll receive an AI-generated audio recap delivered directly to your phone."
  },
  { 
    id: "insights", 
    label: "Insights", 
    duration: 12000,
    script: "Know exactly how your property stacks up against the competition. Our market intelligence shows revenue opportunities, upcoming events that drive demand, and dynamic pricing powered by PriceLabs."
  },
  { 
    id: "bookings", 
    label: "Bookings", 
    duration: 10000,
    script: "Always know who's staying at your property. Our visual calendar shows every reservation with guest details and revenue forecasts for upcoming stays."
  },
  { 
    id: "statements", 
    label: "Statements", 
    duration: 9000,
    script: "Transparent financials you can access anytime. Download your monthly statements with gross and net earnings clearly shown."
  },
  { 
    id: "expenses", 
    label: "Expenses", 
    duration: 12000,
    script: "No hidden fees. Every dollar is documented. See itemized expenses with vendor names and receipt attachments. Filter by category to understand exactly where your money goes."
  },
  { 
    id: "messages", 
    label: "Messages", 
    duration: 12000,
    script: "Every conversation in one place. SMS, emails, voicemails, and video updates. Listen to recordings from your property manager and never miss an important update."
  },
  { 
    id: "repairs", 
    label: "Repairs", 
    duration: 12000,
    script: "Stay in control of maintenance. See work order status, approve or decline repairs directly, and view scheduled maintenance. All costs are visible upfront before any work begins."
  },
  { 
    id: "screenings", 
    label: "Screenings", 
    duration: 10000,
    script: "Know who's staying in your home. Every guest is ID verified with background checks and watchlist screening. Our verification process reduces property damage claims by 47 percent."
  },
  { 
    id: "marketing", 
    label: "Marketing", 
    duration: 10000,
    script: "See exactly how we're promoting your investment. View social media posts, platform distribution across Airbnb, VRBO, and corporate housing, and track our marketing activities in real-time."
  },
  { 
    id: "closing", 
    label: "CTA", 
    duration: 8000,
    script: "Ready to experience true transparency? Explore our demo portal or schedule a call with our team today."
  },
];

const slideVariants = {
  enter: { opacity: 0, scale: 0.98, y: 20 },
  center: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -20 }
};

export default function OwnerPortalPresentation() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioEndedRef = useRef(false);

  const { 
    playAudioForSlide, 
    stopAudio, 
    isMuted, 
    toggleMute, 
    isLoading: isAudioLoading,
  } = usePresentationAudio();

  // Advance to next slide
  const advanceSlide = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentSlide]);

  // Play audio and manage slide timing when slide changes
  useEffect(() => {
    if (!isPlaying) {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      stopAudio();
      return;
    }

    const slide = SLIDES[currentSlide];
    audioEndedRef.current = false;

    // Clear any existing timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    // Callback when audio ends
    const onAudioComplete = () => {
      if (audioEndedRef.current) return; // Prevent double-trigger
      audioEndedRef.current = true;
      
      // Clear fallback timer since audio completed
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      // Longer pause after audio ends before advancing (3 seconds)
      setTimeout(() => {
        if (isPlaying) {
          advanceSlide();
        }
      }, 3000);
    };

    // Play audio with callback for when it ends
    if (slide.script && !isMuted) {
      // Small delay before starting audio for smoother transitions
      setTimeout(() => {
        playAudioForSlide(slide.id, slide.script, onAudioComplete);
      }, 500);
    }

    // Fallback timer - only used if muted, with much longer durations
    if (isMuted) {
      // When muted, use the slide duration plus extra viewing time
      const mutedDuration = slide.duration + 4000;
      fallbackTimerRef.current = setTimeout(() => {
        if (!audioEndedRef.current) {
          advanceSlide();
        }
      }, mutedDuration);
    } else {
      // When audio is enabled, set a very long fallback (30 seconds) as safety net
      fallbackTimerRef.current = setTimeout(() => {
        if (!audioEndedRef.current) {
          console.log("Fallback timer triggered for slide:", slide.id);
          advanceSlide();
        }
      }, 30000);
    }

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [currentSlide, isPlaying, isMuted, playAudioForSlide, stopAudio, advanceSlide]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (currentSlide < SLIDES.length - 1) {
          setCurrentSlide(prev => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentSlide > 0) {
          setCurrentSlide(prev => prev - 1);
        }
      } else if (e.key === "Escape") {
        setIsPlaying(false);
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, toggleMute]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPlaying(false);
  };

  const restart = () => {
    setCurrentSlide(0);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!isPlaying) {
      // If at the end, restart
      if (currentSlide === SLIDES.length - 1) {
        restart();
      } else {
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(false);
      stopAudio();
    }
  };

  const progress = ((currentSlide + 1) / SLIDES.length) * 100;

  const renderSlide = (slideId: string, isActive: boolean) => {
    switch (slideId) {
      case "intro": return <OwnerPortalIntroSlide />;
      case "overview": return <OverviewSlide isActive={isActive} />;
      case "insights": return <InsightsSlide />;
      case "bookings": return <BookingsSlide />;
      case "statements": return <StatementsSlide />;
      case "expenses": return <ExpensesSlide />;
      case "messages": return <MessagesSlide />;
      case "repairs": return <RepairsSlide />;
      case "screenings": return <ScreeningsSlide />;
      case "marketing": return <MarketingSlide />;
      case "closing": return <OwnerPortalClosingSlide />;
      default: return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-[#0a0a1a] overflow-hidden"
    >
      {/* Single Slide with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={SLIDES[currentSlide].id}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="min-h-screen"
        >
          {renderSlide(SLIDES[currentSlide].id, true)}
        </motion.div>
      </AnimatePresence>

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

          {/* Audio Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 hover:bg-white/10 ${isMuted ? 'text-white/40' : 'text-[#fae052]'}`}
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <div className="w-px h-6 bg-white/10" />

          {/* Prev */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            disabled={currentSlide === 0}
            onClick={() => setCurrentSlide(prev => prev - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-white hover:bg-white/10 bg-[#fae052]/20"
            onClick={togglePlay}
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
            onClick={() => setCurrentSlide(prev => prev + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-white/10" />

          {/* Progress Dots */}
          <div className="flex items-center gap-1 px-1">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "bg-[#fae052] w-4"
                    : index < currentSlide
                    ? "bg-white/50 w-2"
                    : "bg-white/20 w-2"
                }`}
                title={slide.label}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* Restart */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
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
        {/* Segment markers */}
        <div className="relative h-full">
          {SLIDES.map((_, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 border-r border-white/20"
              style={{ left: `${((index + 1) / SLIDES.length) * 100}%` }}
            />
          ))}
        </div>
        {/* Overall progress - fills up to current slide */}
        <motion.div
          className="absolute top-0 h-full bg-[#fae052]"
          initial={{ width: 0 }}
          animate={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Slide Counter */}
      <div className="fixed top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white/70 text-sm z-50 flex items-center gap-2">
        {isAudioLoading && (
          <div className="h-2 w-2 rounded-full bg-[#fae052] animate-pulse" />
        )}
        <span>{currentSlide + 1} / {SLIDES.length}</span>
      </div>

      {/* Current Slide Label */}
      <div className="fixed top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white/70 text-sm z-50">
        {SLIDES[currentSlide].label}
      </div>
    </div>
  );
}
