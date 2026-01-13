import { SlideLayout } from "../SlideLayout";
import { Calendar, Clock, Home, Sparkles } from "lucide-react";

export function ThreeStrategiesSlide() {
  const strategies = [
    {
      icon: Calendar,
      title: "Short-Term",
      subtitle: "1-30 nights",
      revenue: "+50-80%",
      features: ["Highest revenue potential", "Airbnb, VRBO, direct bookings", "Dynamic pricing optimization"],
      color: "from-amber-400 to-orange-500",
      borderColor: "border-amber-400/30",
    },
    {
      icon: Clock,
      title: "Mid-Term",
      subtitle: "1-6 months",
      revenue: "+40-60%",
      features: ["Corporate & medical tenants", "Less turnover & costs", "No HOT taxes or permits"],
      color: "from-blue-400 to-cyan-500",
      borderColor: "border-blue-400/30",
      popular: true,
    },
    {
      icon: Home,
      title: "Long-Term",
      subtitle: "12+ months",
      revenue: "Stable",
      features: ["Predictable monthly income", "Minimal management", "Traditional leasing"],
      color: "from-purple-400 to-pink-500",
      borderColor: "border-purple-400/30",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">One Property</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Three <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Strategies</span>
          </h2>
          <p className="text-xl text-white/60">You choose. We optimize. Switch anytime.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {strategies.map((strategy, index) => (
            <div
              key={strategy.title}
              className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border ${strategy.borderColor} hover:bg-white/10 transition-all duration-300`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {strategy.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-400 to-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Icon */}
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${strategy.color} p-4 mb-6`}>
                <strategy.icon className="w-full h-full text-white" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-white mb-1">{strategy.title}</h3>
              <p className="text-white/50 text-sm mb-4">{strategy.subtitle}</p>

              {/* Revenue Indicator */}
              <div className={`inline-block bg-gradient-to-r ${strategy.color} text-white text-lg font-bold px-4 py-2 rounded-lg mb-6`}>
                {strategy.revenue} vs LTR
              </div>

              {/* Features */}
              <ul className="space-y-3">
                {strategy.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70">
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${strategy.color}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Hybrid Mention */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-full px-6 py-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-white">
              <span className="font-semibold text-amber-400">Hybrid Strategy:</span>{" "}
              Combine all three for maximum revenue year-round
            </span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
