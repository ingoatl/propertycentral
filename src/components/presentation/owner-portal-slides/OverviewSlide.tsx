import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OverviewSlideProps {
  isActive?: boolean;
}

export function OverviewSlide({ isActive }: OverviewSlideProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isActive && audioRef.current) {
      // Auto-play when slide becomes active
      audioRef.current.play().catch(() => {
        // Browser blocked autoplay - that's ok
      });
      setIsPlaying(true);
    } else if (!isActive && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center py-16 px-4 md:px-8">
      {/* Header */}
      <motion.div 
        className="text-center mb-8 max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
          Dashboard <span className="text-[#fae052]">Overview</span>
        </h2>
        <p className="text-lg text-white/70">
          Your complete property performance at a glance — revenue, occupancy, and guest ratings
        </p>
      </motion.div>

      {/* Audio Player Card */}
      <motion.div
        className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl p-4 mb-8 max-w-md w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            className="h-12 w-12 rounded-full bg-[#fae052] hover:bg-[#fae052]/90 text-black"
            onClick={toggleAudio}
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
          </Button>
          <div className="flex-1">
            <p className="text-white font-medium text-sm">Monthly Performance Recap</p>
            <p className="text-white/60 text-xs">AI-generated audio summary delivered to your phone</p>
          </div>
          <Volume2 className="h-5 w-5 text-amber-400" />
        </div>
        <audio ref={audioRef} src="/audio/monthly-recap-sample.mp3" />
      </motion.div>

      {/* Screenshot */}
      <motion.div
        className="relative w-full max-w-5xl"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-transparent to-transparent z-10 pointer-events-none" />
        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <img 
            src="/images/owner-portal/01-overview.png" 
            alt="Dashboard Overview"
            className="w-full h-auto"
          />
        </div>
      </motion.div>

      {/* Pain Point Solved */}
      <motion.div
        className="mt-8 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-4 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-emerald-400 font-medium">
          ✓ Never wonder how your property is performing — see it all in real-time
        </p>
      </motion.div>
    </div>
  );
}
