import { motion } from "framer-motion";
import { Shield, UserCheck, AlertTriangle, BadgeCheck } from "lucide-react";

export function ScreeningsSlide() {
  const features = [
    { icon: BadgeCheck, text: "100% Verification Rate" },
    { icon: UserCheck, text: "ID Verified + Background Check" },
    { icon: AlertTriangle, text: "Watchlist screening" },
    { icon: Shield, text: "47% reduction in property damage" },
  ];

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
          Guest <span className="text-[#fae052]">Screenings</span>
        </h2>
        <p className="text-lg text-white/70">
          Know exactly who is staying in your home — every guest verified before arrival
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-3 mb-8 max-w-3xl"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2"
          >
            <feature.icon className="h-4 w-4 text-[#fae052]" />
            <span className="text-white/80 text-sm">{feature.text}</span>
          </div>
        ))}
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
            src="/images/owner-portal/09-screenings.png" 
            alt="Guest Screenings"
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
          ✓ Know exactly who is staying in your home — every guest verified
        </p>
      </motion.div>
    </div>
  );
}
