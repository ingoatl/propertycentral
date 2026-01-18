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
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center mb-12 lg:mb-14">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">One Property</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            Three <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Strategies</span>
          </h2>
          <p className="text-xl lg:text-2xl text-white/60">You choose. We optimize. Switch anytime.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {strategies.map((strategy, index) => (
            <div
              key={strategy.title}
              className={`relative bg-white/5 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border ${strategy.borderColor} hover:bg-white/10 transition-all duration-300`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {strategy.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-400 to-cyan-500 text-white text-sm lg:text-base font-bold px-5 py-1.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Icon */}
              <div className={`w-18 h-18 lg:w-20 lg:h-20 rounded-xl bg-gradient-to-br ${strategy.color} p-4 lg:p-5 mb-6`}>
                <strategy.icon className="w-full h-full text-white" />
              </div>

              {/* Title */}
              <h3 className="text-3xl lg:text-4xl font-bold text-white mb-2">{strategy.title}</h3>
              <p className="text-white/50 text-lg lg:text-xl mb-4">{strategy.subtitle}</p>

              {/* Revenue Indicator */}
              <div className={`inline-block bg-gradient-to-r ${strategy.color} text-white text-xl lg:text-2xl font-bold px-5 py-2.5 rounded-lg mb-6`}>
                {strategy.revenue} vs LTR
              </div>

              {/* Features */}
              <ul className="space-y-3 lg:space-y-4">
                {strategy.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70 text-lg lg:text-xl">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${strategy.color}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Hybrid Mention */}
        <div className="mt-10 lg:mt-12 text-center">
          <div className="inline-flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-full px-8 py-4">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span className="text-white text-lg lg:text-xl">
              <span className="font-semibold text-amber-400">Hybrid Strategy:</span>{" "}
              Combine all three for maximum revenue year-round
            </span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
