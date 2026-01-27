import { motion } from "framer-motion";
import { Shield, UserCheck, AlertTriangle, BadgeCheck } from "lucide-react";
import { AutoScrollImage } from "@/components/presentation/AutoScrollImage";

interface ScreeningsSlideProps {
  isActive?: boolean;
}

export function ScreeningsSlide({ isActive }: ScreeningsSlideProps) {
  const features = [
    { icon: BadgeCheck, text: "100% Verification" },
    { icon: UserCheck, text: "ID + Background Check" },
    { icon: AlertTriangle, text: "Watchlist screening" },
    { icon: Shield, text: "Risk assessment" },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center justify-center px-4 md:px-8 py-8">
      {/* Headline - centered */}
      <motion.div 
        className="text-center mb-4 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-5xl font-bold text-white mb-2">
          <span className="text-[#fae052]">47%</span> Reduction in Damage Claims
        </h2>
        <p className="text-sm md:text-lg text-white/70">
          Every guest verified before arrival — ID, background check, watchlist screening
        </p>
      </motion.div>

      {/* Feature Pills - centered */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 md:gap-3 mb-6 max-w-3xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 md:px-4 py-1.5 md:py-2"
          >
            <feature.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#fae052]" />
            <span className="text-white/80 text-xs md:text-sm">{feature.text}</span>
          </div>
        ))}
      </motion.div>

      {/* Screenshot - vertically centered */}
      <motion.div
        className="relative w-full max-w-5xl h-[45vh] md:h-[50vh] flex items-center justify-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <AutoScrollImage 
          src="/images/owner-portal/09-screenings.png" 
          alt="Guest Screenings"
          scrollDuration={12}
          isActive={isActive}
        />
      </motion.div>

      {/* Pain Point Solved - centered */}
      <motion.div
        className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 md:px-8 py-3 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-emerald-400 font-medium text-sm md:text-base">
          ✓ Know exactly who is staying in your home — every guest verified
        </p>
      </motion.div>
    </div>
  );
}
