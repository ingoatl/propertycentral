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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center py-6 px-4 md:px-8">
      {/* Headline */}
      <motion.div 
        className="text-center mb-3 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">
          Real-Time Performance, <span className="text-[#fae052]">Zero Guesswork</span>
        </h2>
        <p className="text-base md:text-lg text-white/70">
          Revenue, occupancy, and ratings — updated in real-time
        </p>
      </motion.div>

      {/* Audio Player Card - Monthly Recap Sample */}
      <motion.div
        className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl p-3 mb-3 max-w-md w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full bg-[#fae052] hover:bg-[#fae052]/90 text-black shrink-0"
            onClick={toggleAudio}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">Monthly Performance Recap</p>
            <p className="text-white/60 text-xs truncate">Click play to hear a demo recap</p>
          </div>
          <Volume2 className="h-4 w-4 text-amber-400 shrink-0" />
        </div>
        <audio 
          ref={audioRef} 
          src="/audio/monthly-recap-sample.mp3" 
          onEnded={() => setIsPlaying(false)} 
        />
      </motion.div>

      {/* Screenshot */}
      <motion.div
        className="relative w-full max-w-5xl flex-1 flex items-center justify-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <AutoScrollImage 
          src="/images/owner-portal/01-overview.png" 
          alt="Dashboard Overview"
          scrollDuration={10}
        />
      </motion.div>

      {/* Pain Point Solved - directly under screenshot */}
      <motion.div
        className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-emerald-400 font-medium text-sm">
          ✓ Never wonder how your property is performing — see it all in real-time
        </p>
      </motion.div>

      {/* Spacer for bottom nav */}
      <div className="h-20" />
    </div>
  );
}
