import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Home, Volume2, VolumeX, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStoredPresentationAudio } from "@/hooks/useStoredPresentationAudio";

// Import slides
import { TitleSlide } from "@/components/presentation/slides/TitleSlide";
import { MeetTheFoundersSlide } from "@/components/presentation/slides/MeetTheFoundersSlide";
import { OurPromiseSlide } from "@/components/presentation/slides/OurPromiseSlide";
import { ByTheNumbersSlide } from "@/components/presentation/slides/ByTheNumbersSlide";
import { ProblemSolutionSlide } from "@/components/presentation/slides/ProblemSolutionSlide";
import { ThreeStrategiesSlide } from "@/components/presentation/slides/ThreeStrategiesSlide";
import { RevenueComparisonSlide } from "@/components/presentation/slides/RevenueComparisonSlide";
import { CorporateNetworkSlide } from "@/components/presentation/slides/CorporateNetworkSlide";
import { CaseStudySlide } from "@/components/presentation/slides/CaseStudySlide";
import { WhatSetsUsApartSlide } from "@/components/presentation/slides/WhatSetsUsApartSlide";
import { TestimonialSlide } from "@/components/presentation/slides/TestimonialSlide";
import { OwnerPortalSlide } from "@/components/presentation/slides/OwnerPortalSlide";
import { OnboardingTimelineSlide } from "@/components/presentation/slides/OnboardingTimelineSlide";
import { HowItWorksSlide } from "@/components/presentation/slides/HowItWorksSlide";
import { PricingSlide } from "@/components/presentation/slides/PricingSlide";
import { ClosingSlide } from "@/components/presentation/slides/ClosingSlide";

const SLIDES = [
  { 
    id: "title", 
    component: TitleSlide, 
    label: "Welcome",
    duration: 6000,
    script: "Welcome to PeachHaus Property Management. Where exceptional hospitality meets profitable returns."
  },
  { 
    id: "founders", 
    component: MeetTheFoundersSlide, 
    label: "Team",
    duration: 22000,
    script: "Meet Anja and Ingo, the dynamic team behind PeachHaus. Anja is a licensed Georgia real estate broker, Airbnb coach, and hospitality design expert who has grown over two million dollars in short-term rental bookings. She's also the author of The Hybrid Rental Strategy, our proven approach where we focus on mid-term rentals first and fill in the gaps with short-term stays where allowed. Ingo brings over thirty years of entrepreneurship experience with ten years specifically in the real estate and property management space. Together they've built PeachHaus to combine old-world hospitality with modern revenue optimization."
  },
  { 
    id: "promise", 
    component: OurPromiseSlide, 
    label: "Promise",
    duration: 10000,
    script: "Our promise is simple: maximize your rental income while protecting your investment. We handle everything so you can enjoy passive income without the stress."
  },
  { 
    id: "numbers", 
    component: ByTheNumbersSlide, 
    label: "Stats",
    duration: 10000,
    script: "The numbers speak for themselves. With over fourteen hundred five-star Airbnb reviews, our properties consistently outperform market averages with higher occupancy rates and premium nightly rates."
  },
  { 
    id: "problem", 
    component: ProblemSolutionSlide, 
    label: "Solutions",
    duration: 12000,
    script: "We understand the challenges of property management: inconsistent income, guest issues, maintenance headaches. PeachHaus solves these problems with technology-driven solutions and hands-on care."
  },
  { 
    id: "strategies", 
    component: ThreeStrategiesSlide, 
    label: "Strategies",
    duration: 12000,
    script: "Our three-pronged approach combines short-term vacation rentals, mid-term corporate housing, and hybrid strategies to maximize your returns year-round."
  },
  { 
    id: "revenue", 
    component: RevenueComparisonSlide, 
    label: "Revenue",
    duration: 10000,
    script: "See the difference professional management makes. Our owners typically earn 30 to 50 percent more compared to self-management or traditional long-term rentals."
  },
  { 
    id: "corporate", 
    component: CorporateNetworkSlide, 
    label: "Network",
    duration: 10000,
    script: "Access our exclusive corporate network. We partner with Fortune 500 companies, film productions, and relocating professionals who need premium accommodations."
  },
  { 
    id: "case-woodland", 
    component: () => <CaseStudySlide propertyName="Woodland Lane" />, 
    label: "Case 1",
    duration: 12000,
    script: "Woodland Lane transformed from an underperforming rental into a top-earning property, generating over 15 thousand dollars monthly through our hybrid strategy."
  },
  { 
    id: "case-berkley", 
    component: () => <CaseStudySlide propertyName="The Berkley" />, 
    label: "Case 2",
    duration: 12000,
    script: "The Berkley exemplifies our corporate housing expertise. With direct corporate contracts, this property maintains 90 percent occupancy at premium rates."
  },
  { 
    id: "case-lavish", 
    component: () => <CaseStudySlide propertyName="Lavish Living" />, 
    label: "Case 3",
    duration: 12000,
    script: "Lavish Living showcases the luxury short-term rental potential. With professional photography and marketing, bookings increased by 200 percent within three months."
  },
  { 
    id: "apart", 
    component: WhatSetsUsApartSlide, 
    label: "Why Us",
    duration: 12000,
    script: "What sets us apart? 24/7 guest support, dynamic pricing optimization, professional photography, and complete transparency through our owner portal."
  },
  { 
    id: "testimonials", 
    component: TestimonialSlide, 
    label: "Reviews",
    duration: 10000,
    script: "Don't just take our word for it. Our property owners consistently praise our communication, professionalism, and ability to maximize their rental income."
  },
  { 
    id: "portal", 
    component: OwnerPortalSlide, 
    label: "Portal",
    duration: 10000,
    script: "Access everything from your owner portal. Real-time earnings, booking calendars, expense tracking, and maintenance updates all in one place."
  },
  { 
    id: "timeline", 
    component: OnboardingTimelineSlide, 
    label: "Timeline",
    duration: 10000,
    script: "Getting started is easy. From initial consultation to your first booking, our streamlined onboarding takes just two to four weeks."
  },
  { 
    id: "how", 
    component: HowItWorksSlide, 
    label: "Process",
    duration: 10000,
    script: "Our process is designed for simplicity. We handle property setup, professional photography, listing optimization, and guest management from day one."
  },
  { 
    id: "pricing", 
    component: PricingSlide, 
    label: "Pricing",
    duration: 10000,
    script: "Our pricing is straightforward and aligned with your success. We only succeed when you succeed, with competitive management fees and no hidden costs."
  },
  { 
    id: "closing", 
    component: ClosingSlide, 
    label: "Contact",
    duration: 8000,
    script: "Ready to maximize your property's potential? Schedule a discovery call today and let's discuss how PeachHaus can transform your rental income."
  },
];

export default function OnboardingPresentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioEndedRef = useRef(false);
  const hasPlayedRef = useRef(false);
  // Ref to track isPlaying for use in callbacks (avoids stale closure)
  const isPlayingRef = useRef(false);
  // CRITICAL: Track which slide we've triggered audio for (prevents double-play in Strict Mode)
  const hasPlayedForSlideRef = useRef<string | null>(null);
  // Touch swipe support
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
  // Keep ref in sync with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Use stored audio from Supabase (pre-generated)
  const { 
    playAudioForSlide, 
    stopAudio, 
    isMuted, 
    toggleMute, 
    isLoading: isAudioLoading,
    isPreloaded,
    initAudioContext
  } = useStoredPresentationAudio({ 
    presentation: "onboarding"
  });

  // Auto-start presentation when audio is preloaded
  useEffect(() => {
    if (isPreloaded && !hasAutoStarted) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        initAudioContext();
        setHasAutoStarted(true);
        hasPlayedRef.current = true;
        setIsPlaying(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPreloaded, hasAutoStarted, initAudioContext]);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < SLIDES.length && !isTransitioning) {
      // Stop current audio before transitioning
      stopAudio();
      audioEndedRef.current = true; // Prevent double-trigger
      hasPlayedForSlideRef.current = null; // Reset slide lock
      setIsTransitioning(true);
      setCurrentSlide(index);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [isTransitioning, stopAudio]);

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
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide, stopAudio]);

  const nextSlide = useCallback(() => {
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  // Touch swipe handlers for mobile navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        nextSlide(); // Swipe left = next
      } else {
        prevSlide(); // Swipe right = prev
      }
    }
  }, [nextSlide, prevSlide]);

  // Auto-play with audio narration - ROBUST autoplay that always advances
  useEffect(() => {
    if (!isPlaying) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      return;
    }

    const slide = SLIDES[currentSlide];
    
    // CRITICAL: Prevent double-play for this specific slide (React Strict Mode fix)
    if (hasPlayedForSlideRef.current === slide.id) {
      return;
    }
    hasPlayedForSlideRef.current = slide.id;

    // Clear any existing timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    // Track if we've already advanced from this slide
    let hasAdvanced = false;

    // Callback when audio ends - ALWAYS advances if still playing
    const onAudioComplete = () => {
      if (hasAdvanced) return;
      hasAdvanced = true;
      
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      
      console.log(`Audio complete for ${slide.id}, advancing in 1.5s...`);
      
      // Short pause (1.5 seconds) then advance - hasAdvanced is already true so just check isPlaying
      setTimeout(() => {
        if (isPlayingRef.current) {
          advanceSlide();
        }
      }, 1500);
    };

    // Play audio immediately
    if (slide.script && !isMuted) {
      playAudioForSlide(slide.id, slide.script!, onAudioComplete);
    }

    // Fallback timer - ensures we ALWAYS advance even if audio fails
    const fallbackDuration = isMuted ? slide.duration + 3000 : 40000;
    fallbackTimerRef.current = setTimeout(() => {
      if (!hasAdvanced && isPlayingRef.current) {
        console.log(`Fallback advance for ${slide.id}`);
        hasAdvanced = true;
        advanceSlide();
      }
    }, fallbackDuration);

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [currentSlide, isPlaying, isMuted, playAudioForSlide, advanceSlide]);

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

  const togglePlay = () => {
    // Initialize audio context on user interaction
    initAudioContext();
    
    if (!isPlaying) {
      // Reset audio tracking for fresh start
      hasPlayedForSlideRef.current = null;
      audioEndedRef.current = false;
      
      if (currentSlide === SLIDES.length - 1) {
        setCurrentSlide(0);
      }
      hasPlayedRef.current = true;
      setIsPlaying(true);
    } else {
      // PAUSE: Stop audio and clear timers
      setIsPlaying(false);
      stopAudio();
      hasPlayedForSlideRef.current = null;
      audioEndedRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    }
  };

  const restart = () => {
    setCurrentSlide(0);
    setIsPlaying(true);
  };

  const CurrentSlideComponent = SLIDES[currentSlide].component;

  return (
    <div 
      className="fixed inset-0 bg-[#0a0a1a] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide Content */}
      <div
        className={cn(
          "w-full h-full transition-all duration-500 ease-out",
          isTransitioning ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
        )}
      >
        <CurrentSlideComponent />
      </div>

      {/* Navigation Controls - Perfectly Centered */}
      <div className="fixed bottom-4 md:bottom-6 left-0 right-0 flex justify-center z-50 px-4">
        <div className="flex items-center gap-1.5 md:gap-2 bg-black/80 backdrop-blur-lg border border-white/10 rounded-full px-3 md:px-4 py-2">
        {/* Home - Goes to slide 1 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 md:h-8 md:w-8 rounded-full text-white/70 hover:text-white hover:bg-white/10"
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
          className={cn(
            "h-10 w-10 md:h-8 md:w-8 hover:bg-white/10",
            isMuted ? "text-white/40" : "text-amber-400"
          )}
          onClick={toggleMute}
        >
          {isMuted ? <VolumeX className="h-5 w-5 md:h-4 md:w-4" /> : <Volume2 className="h-5 w-5 md:h-4 md:w-4" />}
        </Button>

        <div className="w-px h-6 bg-white/10 hidden md:block" />

        {/* Previous Button - Larger on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="h-10 w-10 md:h-8 md:w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5 md:h-4 md:w-4" />
        </Button>

        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 md:h-10 md:w-10 text-white hover:bg-white/10 bg-amber-500/20"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6 md:h-5 md:w-5 text-amber-400" />
          ) : (
            <Play className="h-6 w-6 md:h-5 md:w-5 text-amber-400 ml-0.5" />
          )}
        </Button>

        {/* Next Button - Larger on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={nextSlide}
          disabled={currentSlide === SLIDES.length - 1}
          className="h-10 w-10 md:h-8 md:w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5 md:h-4 md:w-4" />
        </Button>

        <div className="w-px h-6 bg-white/10 hidden md:block" />

        {/* Slide Indicators - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsPlaying(false);
                goToSlide(index);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentSlide
                  ? "w-4 bg-gradient-to-r from-amber-400 to-orange-500"
                  : index < currentSlide
                  ? "bg-white/50"
                  : "bg-white/20 hover:bg-white/40"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-white/10 hidden md:block" />

        {/* Restart - Hidden on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          onClick={restart}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        {/* Fullscreen - Hidden on mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="hidden md:flex h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        </div>
      </div>

      {/* Progress Bar - Below top controls */}
      <div className="fixed top-12 left-0 right-0 h-1 bg-white/10 z-40">
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
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}
        />
      </div>

      {/* Top Right Controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-50 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
        {isAudioLoading && (
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        )}
        {isPreloaded && !isAudioLoading && (
          <div className="h-2 w-2 rounded-full bg-green-400" title="Audio ready" />
        )}
        <span className="text-white/70 text-sm">
          {currentSlide + 1} / {SLIDES.length}
        </span>
      </div>

      {/* Current Slide Label */}
      <div className="fixed top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white/70 text-sm z-50">
        {SLIDES[currentSlide].label}
      </div>
    </div>
  );
}
