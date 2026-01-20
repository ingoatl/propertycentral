import { SlideLayout } from "../SlideLayout";
import { TrendingUp, MousePointer, Sparkles } from "lucide-react";

export function WhyDesignMattersSlide() {
  const stats = [
    {
      icon: TrendingUp,
      stat: "20-40%",
      label: "Higher Nightly Rates",
      description: "Properties with professional staging command significantly higher rates",
    },
    {
      icon: MousePointer,
      stat: "3×",
      label: "More Clicks",
      description: "Quality photos from staged properties get 3x more listing views",
    },
    {
      icon: Sparkles,
      stat: "Premium",
      label: "'Instagram-Worthy' Spaces",
      description: "Guests pay premium for photogenic, shareable experiences",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12 lg:mb-16">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">The Impact</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            First Impressions ={" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              First Bookings
            </span>
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12 lg:mb-16">
          {stats.map((item, index) => (
            <div
              key={item.label}
              className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 lg:p-10 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group"
            >
              <item.icon className="w-14 h-14 lg:w-16 lg:h-16 text-amber-400 mx-auto mb-6 group-hover:scale-110 transition-transform" />
              <p className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-3">
                {item.stat}
              </p>
              <h3 className="text-xl lg:text-2xl font-semibold text-white mb-3">{item.label}</h3>
              <p className="text-white/50 text-base lg:text-lg">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom Quote */}
        <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 border border-amber-400/30 rounded-2xl p-8 lg:p-10">
          <p className="text-2xl md:text-3xl lg:text-4xl text-white font-light italic">
            "In a crowded market, design is your competitive advantage."
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
