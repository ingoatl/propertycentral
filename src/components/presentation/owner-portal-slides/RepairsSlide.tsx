import { motion } from "framer-motion";
import { Wrench, CheckCircle, Clock, ThumbsUp } from "lucide-react";

export function RepairsSlide() {
  const features = [
    { icon: CheckCircle, text: "Status tracking" },
    { icon: ThumbsUp, text: "Approve/decline directly" },
    { icon: Clock, text: "Scheduled maintenance" },
    { icon: Wrench, text: "Costs upfront" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center py-8 px-4 md:px-8">
      {/* Fortune 500 Assertion-Based Headline */}
      <motion.div 
        className="text-center mb-4 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-2">
          <span className="text-[#fae052]">Stay in Control</span> of Maintenance
        </h2>
        <p className="text-base md:text-lg text-white/70">
          Approve work before it happens — all costs visible upfront
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 mb-4 max-w-3xl"
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

      {/* Screenshot */}
      <motion.div
        className="relative w-full max-w-6xl flex-1 flex items-center justify-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 max-h-[60vh]">
          <img 
            src="/images/owner-portal/08-repairs.png" 
            alt="Maintenance & Repairs"
            className="w-full h-full object-contain object-top"
          />
        </div>
      </motion.div>

      {/* Pain Point Solved */}
      <motion.div
        className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-emerald-400 font-medium text-sm">
          ✓ Stay in control of repairs — approve work before it happens
        </p>
      </motion.div>
    </div>
  );
}
