import { motion } from "framer-motion";
import { MessageSquare, Phone, Video, Mail } from "lucide-react";

export function MessagesSlide() {
  const features = [
    { icon: MessageSquare, text: "All SMS conversations" },
    { icon: Phone, text: "Listen to voicemails" },
    { icon: Video, text: "Watch video updates" },
    { icon: Mail, text: "Email history" },
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
          Multi-Channel <span className="text-[#fae052]">Messaging</span>
        </h2>
        <p className="text-lg text-white/70">
          Every conversation in one place — SMS, voicemails, videos, and emails
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-3 mb-8 max-w-2xl"
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

      {/* Screenshots - Show both messages views */}
      <motion.div
        className="relative w-full max-w-5xl space-y-6"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <img 
            src="/images/owner-portal/06-messages.png" 
            alt="Messages Overview"
            className="w-full h-auto"
          />
        </div>
        
        <motion.div 
          className="rounded-xl overflow-hidden shadow-2xl border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <img 
            src="/images/owner-portal/07-messages-detail.png" 
            alt="Message Detail with Voicemail"
            className="w-full h-auto"
          />
        </motion.div>
      </motion.div>

      {/* Pain Point Solved */}
      <motion.div
        className="mt-8 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-4 max-w-2xl text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.7 }}
      >
        <p className="text-emerald-400 font-medium">
          ✓ Never miss an update — every conversation preserved and accessible
        </p>
      </motion.div>
    </div>
  );
}
