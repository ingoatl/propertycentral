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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center py-8 pb-24 px-4 md:px-8">
      {/* Fortune 500 Assertion-Based Headline */}
      <motion.div 
        className="text-center mb-4 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">
          Complete <span className="text-[#fae052]">Booking Visibility</span>
        </h2>
        <p className="text-base md:text-lg text-white/70">
          Every reservation with guest details and revenue forecasts
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 mb-4 max-w-2xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5"
          >
            <feature.icon className="h-3.5 w-3.5 text-[#fae052]" />
            <span className="text-white/80 text-xs">{feature.text}</span>
          </div>
        ))}
      </motion.div>

      {/* Screenshot with auto-scroll for tall images */}
      <motion.div
        className="relative w-full max-w-6xl flex-1 flex items-start justify-center overflow-hidden"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <AutoScrollImage 
          src="/images/owner-portal/03-bookings.png" 
          alt="Bookings Calendar"
          scrollDuration={8}
        />
      </motion.div>

      {/* Pain Point Solved */}
      <motion.div
        className="mt-6 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 max-w-2xl text-center mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-emerald-400 font-medium text-sm">
          ✓ Always know who's staying at your property and when
        </p>
      </motion.div>
    </div>
  );
}
