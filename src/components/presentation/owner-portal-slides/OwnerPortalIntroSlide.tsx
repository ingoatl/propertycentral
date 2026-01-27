import { motion } from "framer-motion";
import { SlideLayout } from "../SlideLayout";

export function OwnerPortalIntroSlide() {
  return (
    <SlideLayout overlay="gradient">
      <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
        {/* PeachHaus Logo */}
        <motion.img
          src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png"
          alt="PeachHaus"
          className="h-20 md:h-28 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        />
        
        <motion.h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Your Property.{" "}
          <span className="text-[#fae052]">Complete Visibility.</span>
        </motion.h1>
        
        <motion.p
          className="text-xl md:text-2xl text-white/80 max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          Experience the most comprehensive owner portal in the industry
        </motion.p>

        <motion.div
          className="mt-12 flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="h-2 w-2 rounded-full bg-[#fae052] animate-pulse" />
            Auto-scrolling presentation
          </div>
        </motion.div>
      </div>
    </SlideLayout>
  );
}
