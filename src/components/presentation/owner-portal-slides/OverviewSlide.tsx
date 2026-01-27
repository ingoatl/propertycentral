import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoScrollImage } from "@/components/presentation/AutoScrollImage";

interface OverviewSlideProps {
  isActive?: boolean;
}

export function OverviewSlide({ isActive }: OverviewSlideProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center py-4 px-4 md:px-8">
      {/* Headline */}
      <motion.div 
        className="text-center mb-2 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-5xl font-bold text-white mb-1">
          Real-Time Performance, <span className="text-[#fae052]">Zero Guesswork</span>
        </h2>
        <p className="text-sm md:text-lg text-white/70">
          Revenue, occupancy, and ratings — updated in real-time
        </p>
      </motion.div>

      {/* Audio Player Card - Monthly Recap Sample */}
      <motion.div
        className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl p-2 md:p-3 mb-2 max-w-md w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-[#fae052] hover:bg-[#fae052]/90 text-black shrink-0"
            onClick={toggleAudio}
          >
            {isPlaying ? <Pause className="h-3 w-3 md:h-4 md:w-4" /> : <Play className="h-3 w-3 md:h-4 md:w-4 ml-0.5" />}
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-xs md:text-sm">Monthly Performance Recap</p>
            <p className="text-white/60 text-xs truncate">Click play to hear your personalized audio recap demo</p>
          </div>
          <Volume2 className="h-4 w-4 text-amber-400 shrink-0" />
        </div>
        <audio 
          ref={audioRef} 
          src="/audio/monthly-recap-sample.mp3" 
          onEnded={() => setIsPlaying(false)} 
        />
      </motion.div>

      {/* Screenshot - Full height scroll */}
      <motion.div
        className="relative w-full max-w-5xl flex-1 flex items-start justify-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <AutoScrollImage 
          src="/images/owner-portal/01-overview.png" 
          alt="Dashboard Overview"
          scrollDuration={15}
          isActive={isActive}
        />
      </motion.div>

      {/* Pain Point Solved - directly under screenshot with mt-2 */}
      <motion.div
        className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 md:px-6 py-2 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-emerald-400 font-medium text-xs md:text-sm">
          ✓ Never wonder how your property is performing — see it all in real-time
        </p>
      </motion.div>

      {/* Spacer for bottom nav */}
      <div className="h-16 md:h-20" />
    </div>
  );
}
