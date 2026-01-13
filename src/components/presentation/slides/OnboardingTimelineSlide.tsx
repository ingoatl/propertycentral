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
      description: "Management agreement signed, dedicated onboarding specialist assigned",
      color: "from-amber-400 to-orange-500",
      details: ["Personalized onboarding call", "Property access coordination", "Strategy confirmation"],
    },
    {
      day: "Days 2-3",
      icon: Camera,
      title: "Professional Media",
      description: "Photography, video tours, and virtual staging scheduled",
      color: "from-blue-400 to-cyan-500",
      details: ["HDR photography session", "Drone footage (if applicable)", "3D virtual tour creation"],
    },
    {
      day: "Days 4-5",
      icon: Palette,
      title: "Listing Creation",
      description: "SEO-optimized listings crafted for maximum visibility",
      color: "from-purple-400 to-pink-500",
      details: ["Compelling descriptions", "Strategic keyword optimization", "Multi-platform syndication"],
    },
    {
      day: "Days 6-7",
      icon: Home,
      title: "Property Prep",
      description: "Final touches, smart locks, and essential amenities",
      color: "from-green-400 to-emerald-500",
      details: ["Smart lock installation", "Guest essentials checklist", "Welcome book creation"],
    },
    {
      day: "Day 7+",
      icon: Rocket,
      title: "Go Live!",
      description: "Listings activated across all platforms, bookings begin",
      color: "from-red-400 to-rose-500",
      details: ["Airbnb, VRBO activation", "Corporate network listing", "First booking celebration! 🎉"],
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Your Journey</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            From <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Signing</span> to{" "}
            <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">Going Live</span>
          </h2>
          <p className="text-xl text-white/60">Just 7 days to transform your property into a revenue machine</p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute left-1/2 md:left-0 md:right-0 md:top-16 md:h-1 h-full w-1 md:w-auto -translate-x-1/2 md:translate-x-0 bg-gradient-to-b md:bg-gradient-to-r from-amber-400 via-blue-400 via-purple-400 via-green-400 to-red-400 opacity-30" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            {timeline.map((step, index) => (
              <div 
                key={index} 
                className="relative flex flex-col items-center text-center group"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Day Badge */}
                <div className={`bg-gradient-to-r ${step.color} text-white text-xs font-bold px-3 py-1 rounded-full mb-3`}>
                  {step.day}
                </div>

                {/* Icon Circle */}
                <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} p-0.5 mb-4 transform transition-transform group-hover:scale-110`}>
                  <div className="w-full h-full rounded-2xl bg-[#0a0a1a] flex items-center justify-center">
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                </div>

                {/* Content Card */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 h-full w-full">
                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-white/50 text-sm mb-3">{step.description}</p>
                  
                  {/* Details */}
                  <ul className="space-y-1">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-center justify-center gap-2 text-white/40 text-xs">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
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
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-full px-6 py-3">
            <Sparkles className="w-5 h-5 text-green-400" />
            <span className="text-white">
              <span className="font-semibold text-green-400">Average time to first booking:</span>{" "}
              10 days from signing
            </span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
