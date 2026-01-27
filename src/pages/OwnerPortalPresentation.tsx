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
import { useStoredPresentationAudio } from "@/hooks/useStoredPresentationAudio";
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
import { CommunicationSlide } from "@/components/presentation/owner-portal-slides/CommunicationSlide";
import { OwnerPortalClosingSlide } from "@/components/presentation/owner-portal-slides/OwnerPortalClosingSlide";

// Slide configuration with narration scripts (Sarah voice - female, warm, professional)
const SLIDES = [
  { 
    id: "intro", 
    label: "Intro", 
    duration: 10000,
    script: "Welcome to PeachHaus... We're so glad you're here. Let us show you how we take care of your investment — and keep you completely informed, every step of the way."
  },
  { 
    id: "overview", 
    label: "Overview", 
    duration: 14000,
    script: "Here's your dashboard... Everything you need to know about your property — revenue, occupancy, and guest ratings — all in real-time. And every month, you'll receive a personalized audio recap, delivered right to your phone."
  },
  { 
    id: "insights", 
    label: "Insights", 
    duration: 12000,
    script: "Know exactly how your property stacks up against the competition. Our market intelligence reveals revenue opportunities, tracks demand-driving events, and powers dynamic pricing through PriceLabs."
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
    script: "Transparent financials you can access anytime. Download your monthly statements with gross and net earnings clearly broken down."
  },
  { 
    id: "expenses", 
    label: "Expenses", 
    duration: 12000,
    script: "No hidden fees... ever. Every dollar is documented with vendor names and receipt attachments. Filter by category to understand exactly where your money goes."
  },
  { 
    id: "messages", 
    label: "Messages", 
    duration: 12000,
    script: "Every conversation, in one place. SMS, emails, voicemails, and video updates. Listen to recordings from your property manager and never miss an important update."
  },
  { 
    id: "repairs", 
    label: "Repairs", 
    duration: 14000,
    script: "Stay in control of maintenance. Any repair over five hundred dollars requires your approval before work begins... And you'll also see predictive maintenance tasks scheduled for your property — things like HVAC servicing and gutter cleaning — all planned ahead of time."
  },
  { 
    id: "screenings", 
    label: "Screenings", 
    duration: 10000,
    script: "Peace of mind, built in. Every single guest is verified before they arrive — ID check, background screening, and watchlist review. This process has reduced property damage claims by forty-seven percent."
  },
  { 
    id: "marketing", 
    label: "Marketing", 
    duration: 10000,
    script: "See exactly how we're promoting your investment. View social media posts, platform distribution across Airbnb, VRBO, and corporate housing, and track our marketing activities in real-time."
  },
  { 
    id: "communication", 
    label: "Contact", 
    duration: 12000,
    script: "We believe communication with your property manager should be effortless. That's why you can leave a voicemail, send a text, schedule a video call, or call us directly — right from your dashboard. This level of access is rare in our industry, and we're proud to offer it."
  },
  { 
    id: "closing", 
    label: "CTA", 
    duration: 8000,
    script: "Ready to experience true transparency? Explore our demo portal, or schedule a call with our team today. We'd love to show you more."
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
  const [isPlaying, setIsPlaying] = useState(false); // Start paused until user clicks play
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioEndedRef = useRef(false);
  // CRITICAL: Track which slide we've triggered audio for (prevents double-play in Strict Mode)
  const hasPlayedForSlideRef = useRef<string | null>(null);
  // Touch swipe support
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Use stored audio from Supabase (pre-generated)
  const { 
    playAudioForSlide, 
    stopAudio, 
    isMuted, 
    toggleMute, 
    isLoading: isAudioLoading,
    isPreloaded,
    initAudioContext,
  } = useStoredPresentationAudio({
    presentation: "owner-portal"
  });

  // Advance to next slide with end-of-presentation guard
  const advanceSlide = useCallback(() => {
    // Guard: prevent advancing past the end
    if (currentSlide >= SLIDES.length - 1) {
      // Clean stop at end of presentation
      setIsPlaying(false);
      stopAudio();
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      audioEndedRef.current = true;
      return;
    }
    setCurrentSlide(prev => prev + 1);
  }, [currentSlide, stopAudio]);

  // Touch swipe handlers for mobile navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0 && currentSlide < SLIDES.length - 1) {
        stopAudio();
        audioEndedRef.current = true;
        hasPlayedForSlideRef.current = null;
        setCurrentSlide(prev => prev + 1);
      } else if (diff < 0 && currentSlide > 0) {
        stopAudio();
        audioEndedRef.current = true;
        hasPlayedForSlideRef.current = null;
        setCurrentSlide(prev => prev - 1);
      }
    }
  }, [currentSlide, stopAudio]);

  // Play audio and manage slide timing when slide changes - with double-play prevention
  useEffect(() => {
    if (!isPlaying) {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      hasPlayedForSlideRef.current = null; // Reset when paused
      stopAudio();
      return;
    }

    const slide = SLIDES[currentSlide];
    
    // CRITICAL: Prevent double-play for this specific slide (React Strict Mode fix)
    if (hasPlayedForSlideRef.current === slide.id) {
      return;
    }
    hasPlayedForSlideRef.current = slide.id;
    
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

    // Play audio immediately (no delay - audio is preloaded)
    if (slide.script && !isMuted) {
      playAudioForSlide(slide.id, slide.script, onAudioComplete);
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
      // When audio is enabled, set a very long fallback (45 seconds) as safety net
      fallbackTimerRef.current = setTimeout(() => {
        if (!audioEndedRef.current) {
          console.log("Fallback timer triggered for slide:", slide.id);
          advanceSlide();
        }
      }, 45000);
    }

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      // Always stop audio on cleanup to prevent overlapping
      stopAudio();
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
          stopAudio();
          audioEndedRef.current = true;
          setCurrentSlide(prev => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentSlide > 0) {
          stopAudio();
          audioEndedRef.current = true;
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
  }, [currentSlide, toggleMute, stopAudio]);

  const goToSlide = (index: number) => {
    stopAudio();
    audioEndedRef.current = true;
    hasPlayedForSlideRef.current = null; // Reset slide lock
    setCurrentSlide(index);
    setIsPlaying(false);
  };

  const restart = () => {
    initAudioContext(); // Ensure audio context is ready
    setCurrentSlide(0);
    setIsPlaying(true);
    setHasStarted(true);
  };

  const togglePlay = () => {
    // Initialize audio context on first user interaction
    initAudioContext();
    setHasStarted(true);
    
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

  const renderSlide = (slideId: string, isActive: boolean) => {
    switch (slideId) {
      case "intro": return <OwnerPortalIntroSlide />;
      case "overview": return <OverviewSlide isActive={isActive} />;
      case "insights": return <InsightsSlide isActive={isActive} />;
      case "bookings": return <BookingsSlide />;
      case "statements": return <StatementsSlide />;
      case "expenses": return <ExpensesSlide />;
      case "messages": return <MessagesSlide />;
      case "repairs": return <RepairsSlide />;
      case "screenings": return <ScreeningsSlide />;
      case "marketing": return <MarketingSlide isActive={isActive} />;
      case "communication": return <CommunicationSlide />;
      case "closing": return <OwnerPortalClosingSlide />;
      default: return null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen min-h-[100dvh] bg-[#0a0a1a] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
          className="min-h-screen min-h-[100dvh] pb-20 md:pb-24"
        >
          {renderSlide(SLIDES[currentSlide].id, true)}
        </motion.div>
      </AnimatePresence>

      {/* Fixed Navigation Bar - Perfectly Centered */}
      <motion.div
        className="fixed bottom-4 md:bottom-6 left-0 right-0 flex justify-center z-50 px-4"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="bg-black/80 backdrop-blur-lg border border-white/10 rounded-full px-2 md:px-4 py-2 flex items-center gap-1 md:gap-2 shadow-2xl">
          {/* Home - Goes to slide 1 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:h-8 md:w-8 shrink-0 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => {
              stopAudio();
              audioEndedRef.current = true;
              hasPlayedForSlideRef.current = null;
              setCurrentSlide(0);
              setIsPlaying(false);
            }}
          >
            <Home className="h-5 w-5 md:h-4 md:w-4" />
          </Button>

          {/* Audio Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-10 w-10 md:h-8 md:w-8 shrink-0 hover:bg-white/10 ${isMuted ? 'text-white/40' : 'text-[#fae052]'}`}
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5 md:h-4 md:w-4" />
            ) : (
              <Volume2 className="h-5 w-5 md:h-4 md:w-4" />
            )}
          </Button>

          <div className="w-px h-6 bg-white/10 hidden md:block" />

          {/* Prev - Larger on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:h-8 md:w-8 shrink-0 text-white/70 hover:text-white hover:bg-white/10"
            disabled={currentSlide === 0}
            onClick={() => {
              stopAudio();
              audioEndedRef.current = true;
              hasPlayedForSlideRef.current = null;
              setCurrentSlide(prev => prev - 1);
            }}
          >
            <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
          </Button>

          {/* Play/Pause - Prominent */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 md:h-10 md:w-10 shrink-0 text-white hover:bg-white/10 bg-[#fae052]/20 relative"
            onClick={togglePlay}
          >
            {isAudioLoading && (
              <div className="absolute inset-0 rounded-lg border-2 border-[#fae052] border-t-transparent animate-spin" />
            )}
            {isPlaying ? (
              <Pause className="h-6 w-6 md:h-5 md:w-5 text-[#fae052]" />
            ) : (
              <Play className="h-6 w-6 md:h-5 md:w-5 text-[#fae052] ml-0.5" />
            )}
          </Button>

          {/* Next - Larger on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 md:h-8 md:w-8 shrink-0 text-white/70 hover:text-white hover:bg-white/10"
            disabled={currentSlide === SLIDES.length - 1}
            onClick={() => {
              stopAudio();
              audioEndedRef.current = true;
              hasPlayedForSlideRef.current = null;
              setCurrentSlide(prev => prev + 1);
            }}
          >
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
          </Button>

          <div className="w-px h-6 bg-white/10 hidden md:block" />

          {/* Progress Dots - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-1 px-1">
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

          <div className="w-px h-6 bg-white/10 hidden md:block" />

          {/* Restart - Hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white/70 hover:text-white hover:bg-white/10 hidden md:flex"
            onClick={restart}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Fullscreen - Hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white/70 hover:text-white hover:bg-white/10 hidden md:flex"
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
        {isPreloaded && (
          <div className="h-2 w-2 rounded-full bg-emerald-400" title="Audio preloaded" />
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
