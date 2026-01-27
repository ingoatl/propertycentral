import { motion } from "framer-motion";
import { Mic, MessageSquare, Calendar, Phone, Headphones, Video } from "lucide-react";

export function CommunicationSlide() {
  const channels = [
    { 
      icon: Mic, 
      title: "Leave a Voicemail",
      description: "Record a message anytime — we respond within 24 hours",
      color: "from-orange-500/20 to-orange-600/10",
      iconColor: "text-orange-400"
    },
    { 
      icon: MessageSquare, 
      title: "Send a Text",
      description: "Quick messages delivered directly to your property manager",
      color: "from-blue-500/20 to-blue-600/10",
      iconColor: "text-blue-400"
    },
    { 
      icon: Calendar, 
      title: "Schedule a Call",
      description: "Book a video or phone call — topics like statements, pricing, or updates",
      color: "from-purple-500/20 to-purple-600/10",
      iconColor: "text-purple-400"
    },
    { 
      icon: Phone, 
      title: "Call Now",
      description: "Speak to someone immediately during business hours",
      color: "from-emerald-500/20 to-emerald-600/10",
      iconColor: "text-emerald-400"
    },
  ];

  const features = [
    { icon: Headphones, text: "24/7 message access" },
    { icon: Video, text: "Video call support" },
    { icon: MessageSquare, text: "SMS & email" },
    { icon: Mic, text: "Voice recordings" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#0a0a1a] flex flex-col items-center py-8 pb-28 px-4 md:px-8">
      {/* Headline */}
      <motion.div 
        className="text-center mb-6 max-w-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">
          <span className="text-[#fae052]">Direct Access</span> to Your Property Manager
        </h2>
        <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto">
          Communication should be effortless. Reach us how you prefer — voicemail, text, call, or video.
        </p>
      </motion.div>

      {/* Feature Pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-2 mb-8 max-w-3xl"
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

      {/* Communication Channels Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl mb-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        {channels.map((channel, i) => (
          <motion.div
            key={i}
            className={`relative bg-gradient-to-br ${channel.color} border border-white/10 rounded-2xl p-6 backdrop-blur-sm`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
          >
            <div className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4`}>
              <channel.icon className={`h-6 w-6 ${channel.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{channel.title}</h3>
            <p className="text-sm text-white/60">{channel.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Industry Leadership Callout */}
      <motion.div
        className="bg-[#fae052]/10 border border-[#fae052]/30 rounded-xl px-6 py-4 max-w-2xl text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-[#fae052] font-medium text-sm mb-1">
          ★ Industry-Leading Communication
        </p>
        <p className="text-white/70 text-xs">
          Our owners have multiple ways to connect — something 83% of property managers don't offer
        </p>
      </motion.div>

      {/* Pain Point Solved */}
      <motion.div
        className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-6 py-3 max-w-2xl text-center mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <p className="text-emerald-400 font-medium text-sm">
          ✓ Never feel out of touch — reach us however works best for you
        </p>
      </motion.div>
    </div>
  );
}
