import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Phone, Mail } from "lucide-react";

export function OwnerPortalClosingSlide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center justify-center py-12 pb-24 px-4 md:px-8">
      {/* Owner Photos */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative">
          <img
            src="/images/owners-anja-ingo.png"
            alt="Anja & Ingo - PeachHaus Founders"
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-[#fae052]/30 shadow-2xl"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#fae052] text-black text-xs font-semibold px-3 py-1 rounded-full">
            Anja & Ingo
          </div>
        </div>
      </motion.div>

      {/* Logo */}
      <motion.img
        src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png"
        alt="PeachHaus"
        className="h-12 md:h-16 mb-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      />

      {/* Headline */}
      <motion.div 
        className="text-center mb-8 max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
          Ready to Experience{" "}
          <span className="text-[#fae052]">True Transparency?</span>
        </h2>
        <p className="text-lg md:text-xl text-white/70">
          Join property owners who have complete visibility into their investment
        </p>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4 mb-8"
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
          className="bg-white hover:bg-white/90 text-black font-semibold px-8 py-6 text-lg"
          onClick={() => window.open("/book-discovery-call", "_blank")}
        >
          <Calendar className="mr-2 h-5 w-5" />
          Schedule a Call
        </Button>
      </motion.div>

      {/* Contact Info */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-white/50 text-sm mb-3">Questions? Reach out directly</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a 
            href="tel:+14048005932" 
            className="flex items-center gap-2 text-[#fae052] hover:underline font-medium"
          >
            <Phone className="h-4 w-4" />
            (404) 800-5932
          </a>
          <span className="text-white/30 hidden sm:inline">•</span>
          <a 
            href="mailto:info@peachhausgroup.com" 
            className="flex items-center gap-2 text-[#fae052] hover:underline font-medium"
          >
            <Mail className="h-4 w-4" />
            info@peachhausgroup.com
          </a>
        </div>
      </motion.div>
    </div>
  );
}
