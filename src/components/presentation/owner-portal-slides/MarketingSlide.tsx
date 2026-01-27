import { motion } from "framer-motion";
import { Share2, Globe, Activity, Megaphone } from "lucide-react";
import { AutoScrollImage } from "@/components/presentation/AutoScrollImage";

export function MarketingSlide() {
  const features = [
    { icon: Share2, text: "Social media posts" },
    { icon: Globe, text: "Multi-platform distribution" },
    { icon: Activity, text: "Activity timeline" },
    { icon: Megaphone, text: "Corporate outreach" },
  ];

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
          See <span className="text-[#fae052]">Every Marketing Effort</span>
        </h2>
        <p className="text-base md:text-lg text-white/70">
          Track exactly how we're promoting your investment across all platforms
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 mb-3 max-w-3xl"
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
        className="relative w-full max-w-5xl flex-1 flex items-center justify-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <AutoScrollImage 
          src="/images/owner-portal/10-marketing.png" 
          alt="Marketing Dashboard"
          scrollDuration={10}
        />
      </motion.div>

      {/* Pain Point Solved - directly under screenshot */}
      <motion.div
        className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-emerald-400 font-medium text-sm">
          ✓ Visibility into every marketing effort for your property
        </p>
      </motion.div>

      {/* Spacer for bottom nav */}
      <div className="h-20" />
    </div>
  );
}
