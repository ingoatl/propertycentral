import { motion } from "framer-motion";
import { Calendar, Users, DollarSign } from "lucide-react";
import { AutoScrollImage } from "@/components/presentation/AutoScrollImage";

export function BookingsSlide() {
  const features = [
    { icon: Calendar, text: "Visual booking calendar" },
    { icon: Users, text: "Guest details & party composition" },
    { icon: DollarSign, text: "Revenue forecast" },
  ];

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
          Complete <span className="text-[#fae052]">Booking Visibility</span>
        </h2>
        <p className="text-sm md:text-lg text-white/70">
          Every reservation with guest details and revenue forecasts
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 mb-2 max-w-2xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 md:gap-2 bg-white/5 border border-white/10 rounded-full px-2 md:px-3 py-1 md:py-1.5"
          >
            <feature.icon className="h-3 w-3 md:h-3.5 md:w-3.5 text-[#fae052]" />
            <span className="text-white/80 text-xs">{feature.text}</span>
          </div>
        ))}
      </motion.div>

      {/* Screenshot */}
      <motion.div
        className="relative w-full max-w-5xl flex-1 flex items-start justify-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <AutoScrollImage 
          src="/images/owner-portal/03-bookings.png" 
          alt="Bookings Calendar"
          scrollDuration={12}
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
          ✓ Always know who's staying at your property and when
        </p>
      </motion.div>

      {/* Spacer for bottom nav */}
      <div className="h-16 md:h-20" />
    </div>
  );
}
