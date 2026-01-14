import { SlideLayout } from "../SlideLayout";
import { Brain, Users, Zap, Clock, Award, Sparkles } from "lucide-react";

export function WhatSetsUsApartSlide() {
  const features = [
    { icon: Brain, title: "AI-Powered Optimization", desc: "Dynamic pricing that maximizes every single night", highlight: true },
    { icon: Users, title: "Exclusive Corporate Network", desc: "Access Fortune 500 tenants directly" },
    { icon: Zap, title: "Instant Strategy Switching", desc: "Adapt to market conditions seamlessly" },
    { icon: Clock, title: "24/7 Support", desc: "Always available when you need us" },
    { icon: Award, title: "10 Years Experience", desc: "Proven track record of success" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-5xl mx-auto text-center">
        <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Our Advantage</p>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          What Sets Us <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Apart</span>
        </h2>
        <p className="text-xl text-white/60 mb-12">Why property owners choose PeachHaus</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div 
              key={i} 
              className={`bg-white/5 backdrop-blur-sm rounded-xl p-6 border transition-all duration-300 group ${
                f.highlight 
                  ? 'border-amber-400/50 hover:border-amber-400 bg-gradient-to-br from-amber-400/10 to-orange-500/10' 
                  : 'border-white/10 hover:border-amber-400/30'
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {f.highlight && (
                <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-bold mb-3">
                  <Sparkles className="w-3 h-3" />
                  KEY DIFFERENTIATOR
                </div>
              )}
              <f.icon className={`w-10 h-10 mx-auto mb-4 ${f.highlight ? 'text-amber-400' : 'text-amber-400/80'}`} />
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
