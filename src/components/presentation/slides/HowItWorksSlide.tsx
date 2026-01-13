import { SlideLayout } from "../SlideLayout";
import { Search, Settings, TrendingUp, ArrowRight, Sparkles } from "lucide-react";

export function HowItWorksSlide() {
  const steps = [
    { 
      icon: Search, 
      num: 1, 
      title: "Discover", 
      desc: "Free property analysis with custom income projections for all 3 strategies",
      details: ["Virtual or in-person consultation", "Market analysis & comp review", "ROI projections for each strategy"]
    },
    { 
      icon: Settings, 
      num: 2, 
      title: "Setup", 
      desc: "Professional photos, optimized listings, and seamless onboarding in 7 days",
      details: ["Professional photography", "Listing optimization", "Smart lock installation"]
    },
    { 
      icon: TrendingUp, 
      num: 3, 
      title: "Thrive", 
      desc: "Sit back and enjoy passive income while we handle absolutely everything",
      details: ["24/7 guest support", "Dynamic pricing", "Monthly owner reports"]
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto text-center">
        <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Simple Process</p>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          How It <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Works</span>
        </h2>
        <p className="text-xl text-white/60 mb-12">Three simple steps to rental freedom</p>

        <div className="flex flex-col md:flex-row items-stretch justify-center gap-6">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-amber-400/30 transition-all flex-1 min-w-[280px]">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <div className="text-amber-400 text-sm font-bold mb-2">STEP {step.num}</div>
                <h3 className="text-2xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-white/60 mb-4 text-sm">{step.desc}</p>
                
                {/* Details */}
                <ul className="space-y-2 text-left w-full">
                  {step.details.map((detail, j) => (
                    <li key={j} className="flex items-center gap-2 text-white/50 text-sm">
                      <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block w-8 h-8 text-amber-400/50 mx-4 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
