import { motion } from "framer-motion";

export function OwnerPortalIntroSlide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center justify-center pb-28 px-4 md:px-8">
      {/* PeachHaus Logo */}
      <motion.img
        src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png"
        alt="PeachHaus"
        className="h-20 md:h-28 mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      />
      
      <motion.h1
        className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Welcome to{" "}
        <span className="text-[#fae052]">Worry-Free Ownership</span>
      </motion.h1>
      
      <motion.p
        className="text-xl md:text-2xl text-white/80 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        Your property, our passion — complete visibility into your investment
      </motion.p>

      {/* Removed "Auto-scrolling with AI narration" indicator */}
    </div>
  );
}
