import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar } from "lucide-react";

export function OwnerPortalClosingSlide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center justify-center py-12 px-4 md:px-8">
      {/* Logo */}
      <motion.img
        src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png"
        alt="PeachHaus"
        className="h-14 md:h-20 mb-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Headline */}
      <motion.div 
        className="text-center mb-10 max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          Ready to Experience{" "}
          <span className="text-[#fae052]">True Transparency?</span>
        </h2>
        <p className="text-xl text-white/70">
          Join property owners who have complete visibility into their investment
        </p>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Button
          size="lg"
          className="bg-[#fae052] hover:bg-[#fae052]/90 text-black font-semibold px-8 py-6 text-lg"
          onClick={() => window.open("/owner", "_blank")}
        >
          <ExternalLink className="mr-2 h-5 w-5" />
          View Demo Portal
        </Button>
        
        <Button
          size="lg"
          variant="outline"
          className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg"
          onClick={() => window.open("/book-discovery-call", "_blank")}
        >
          <Calendar className="mr-2 h-5 w-5" />
          Schedule a Call
        </Button>
      </motion.div>

      {/* Contact Info */}
      <motion.div
        className="mt-12 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-white/50 text-sm mb-2">Questions? Reach out directly</p>
        <a 
          href="tel:+14048005932" 
          className="text-[#fae052] hover:underline font-medium"
        >
          (404) 800-5932
        </a>
        <span className="text-white/30 mx-3">•</span>
        <a 
          href="mailto:info@stayatpeachhaus.com" 
          className="text-[#fae052] hover:underline font-medium"
        >
          info@stayatpeachhaus.com
        </a>
      </motion.div>
    </div>
  );
}
