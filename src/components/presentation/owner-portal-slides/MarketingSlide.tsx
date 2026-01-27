import { motion } from "framer-motion";
import { Share2, Globe, Activity, Megaphone } from "lucide-react";

export function MarketingSlide() {
  const features = [
    { icon: Share2, text: "Social media posts for your property" },
    { icon: Globe, text: "Multi-platform distribution (Airbnb, VRBO, etc.)" },
    { icon: Activity, text: "Marketing activity timeline" },
    { icon: Megaphone, text: "Corporate housing outreach" },
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
          <span className="text-[#fae052]">Marketing</span> Visibility
        </h2>
        <p className="text-lg text-white/70">
          See exactly how we're promoting your investment across every platform
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

      {/* Marketing Platforms Visual */}
      <motion.div
        className="relative w-full max-w-4xl bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-2xl p-8 mb-8"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-xl font-bold text-white mb-6 text-center">Your Property Listed On</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {["Airbnb", "VRBO", "Furnished Finder", "Corporate Housing"].map((platform, i) => (
            <motion.div
              key={platform}
              className="bg-white/5 border border-white/10 rounded-lg p-4 text-center"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1 }}
            >
              <span className="text-white font-medium">{platform}</span>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-2xl font-bold text-[#fae052]">12</div>
            <div className="text-white/60 text-sm">Social Posts</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-2xl font-bold text-[#fae052]">8</div>
            <div className="text-white/60 text-sm">Email Campaigns</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-2xl font-bold text-[#fae052]">24</div>
            <div className="text-white/60 text-sm">Hotsheet Blasts</div>
          </div>
        </div>
      </motion.div>

      {/* Pain Point Solved */}
      <motion.div
        className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-4 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-emerald-400 font-medium">
          ✓ Visibility into every marketing effort for your property
        </p>
      </motion.div>
    </div>
  );
}
