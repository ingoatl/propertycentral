import { SlideLayout } from "../SlideLayout";
import { 
  FileSignature, 
  Camera, 
  Palette, 
  Home, 
  Sparkles, 
  Rocket,
  CheckCircle2
} from "lucide-react";

export function OnboardingTimelineSlide() {
  const timeline = [
    {
      day: "Day 1",
      icon: FileSignature,
      title: "Sign & Kick-off",
      description: "Management agreement signed, onboarding specialist assigned",
      color: "from-amber-400 to-orange-500",
      details: ["Personalized onboarding call", "Property access coordination", "Strategy confirmation"],
    },
    {
      day: "Days 2-3",
      icon: Camera,
      title: "Professional Media",
      description: "Photography, video tours, and virtual staging",
      color: "from-blue-400 to-cyan-500",
      details: ["HDR photography session", "Drone footage", "3D virtual tour"],
    },
    {
      day: "Days 4-5",
      icon: Palette,
      title: "Listing Creation",
      description: "SEO-optimized listings for maximum visibility",
      color: "from-purple-400 to-pink-500",
      details: ["Compelling descriptions", "Keyword optimization", "Multi-platform"],
    },
    {
      day: "Days 6-7",
      icon: Home,
      title: "Property Prep",
      description: "Smart locks, amenities, and final touches",
      color: "from-green-400 to-emerald-500",
      details: ["Smart lock install", "Guest essentials", "Welcome book"],
    },
    {
      day: "Day 7+",
      icon: Rocket,
      title: "Go Live!",
      description: "Listings activated, bookings begin",
      color: "from-red-400 to-rose-500",
      details: ["Platform activation", "Corporate listing", "First booking! 🎉"],
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center mb-10 lg:mb-12">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">Your Journey</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            From <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Signing</span> to{" "}
            <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">Going Live</span>
          </h2>
          <p className="text-xl lg:text-2xl text-white/60">Just 7 days to transform your property into a revenue machine</p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-1/2 md:left-0 md:right-0 md:top-16 md:h-1 h-full w-1 md:w-auto -translate-x-1/2 md:translate-x-0 bg-gradient-to-b md:bg-gradient-to-r from-amber-400 via-blue-400 via-purple-400 via-green-400 to-red-400 opacity-30" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 lg:gap-5 relative">
            {timeline.map((step, index) => (
              <div 
                key={index} 
                className="relative flex flex-col items-center text-center group"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Day Badge */}
                <div className={`bg-gradient-to-r ${step.color} text-white text-sm lg:text-base font-bold px-3 lg:px-4 py-1.5 rounded-full mb-3`}>
                  {step.day}
                </div>

                {/* Icon Circle */}
                <div className={`relative w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br ${step.color} p-0.5 mb-4 transform transition-transform group-hover:scale-110`}>
                  <div className="w-full h-full rounded-2xl bg-[#0a0a1a] flex items-center justify-center">
                    <step.icon className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
                  </div>
                </div>

                {/* Content Card */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl lg:rounded-2xl p-4 lg:p-5 border border-white/10 hover:border-white/20 transition-all duration-300 h-full w-full">
                  <h3 className="text-lg lg:text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm lg:text-base mb-3">{step.description}</p>
                  
                  {/* Details */}
                  <ul className="space-y-1.5">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-center justify-center gap-2 text-white/40 text-xs lg:text-sm">
                        <CheckCircle2 className="w-3 h-3 lg:w-4 lg:h-4 text-green-400 flex-shrink-0" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Badge */}
        <div className="mt-10 lg:mt-12 text-center">
          <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-full px-8 py-4">
            <Sparkles className="w-6 h-6 text-green-400" />
            <span className="text-white text-lg lg:text-xl">
              <span className="font-semibold text-green-400">Average time to first booking:</span>{" "}
              10 days from signing
            </span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
