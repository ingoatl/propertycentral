import { SlideLayout } from "../SlideLayout";
import { Brain, Users, Zap, Sparkles } from "lucide-react";

export function WhatSetsUsApartSlide() {
  const features = [
    { icon: Brain, title: "AI-Powered Optimization", desc: "Dynamic pricing that maximizes every single night", highlight: true },
    { icon: Users, title: "Exclusive Corporate Network", desc: "Access Fortune 500 tenants directly" },
    { icon: Zap, title: "Hybrid Strategy Switching", desc: "Seamlessly adapt to market conditions" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto text-center">
        <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">Our Advantage</p>
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
          What Sets Us <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Apart</span>
        </h2>
        <p className="text-xl lg:text-2xl text-white/60 mb-12 lg:mb-16">Why property owners choose PeachHaus</p>
        
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((f, i) => (
            <div 
              key={i} 
              className={`bg-white/5 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border transition-all duration-300 group ${
                f.highlight 
                  ? 'border-amber-400/50 hover:border-amber-400 bg-gradient-to-br from-amber-400/10 to-orange-500/10' 
                  : 'border-white/10 hover:border-amber-400/30'
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {f.highlight && (
                <div className="flex items-center justify-center gap-2 text-amber-400 text-sm lg:text-base font-bold mb-4">
                  <Sparkles className="w-4 h-4" />
                  KEY DIFFERENTIATOR
                </div>
              )}
              <f.icon className={`w-16 h-16 lg:w-20 lg:h-20 mx-auto mb-6 ${f.highlight ? 'text-amber-400' : 'text-amber-400/80'}`} />
              <h3 className="text-white font-bold text-2xl lg:text-3xl mb-4">{f.title}</h3>
              <p className="text-white/50 text-lg lg:text-xl">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-12 lg:mt-16">
          <div className="inline-flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-full px-8 py-4">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span className="text-white text-lg lg:text-xl">
              <span className="font-semibold text-amber-400">Result:</span>{" "}
              30-50% higher returns than traditional property managers
            </span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
