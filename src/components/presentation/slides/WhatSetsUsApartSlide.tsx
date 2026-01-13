import { SlideLayout } from "../SlideLayout";
import { Brain, Users, Zap, Shield, Clock, Award } from "lucide-react";

export function WhatSetsUsApartSlide() {
  const features = [
    { icon: Brain, title: "AI-Powered Optimization", desc: "Dynamic pricing that maximizes every night" },
    { icon: Users, title: "Exclusive Corporate Network", desc: "Access Fortune 500 tenants directly" },
    { icon: Zap, title: "Instant Strategy Switching", desc: "Adapt to market conditions seamlessly" },
    { icon: Shield, title: "$3M Insurance Coverage", desc: "Complete protection for your property" },
    { icon: Clock, title: "24/7 Support", desc: "Always available when you need us" },
    { icon: Award, title: "15+ Years Experience", desc: "Proven track record of success" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-5xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-12">
          What Sets Us <span className="text-amber-400">Apart</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-amber-400/30 transition-all">
              <f.icon className="w-10 h-10 text-amber-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
