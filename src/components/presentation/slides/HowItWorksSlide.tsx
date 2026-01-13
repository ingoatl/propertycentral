import { SlideLayout } from "../SlideLayout";
import { Search, Settings, TrendingUp } from "lucide-react";

export function HowItWorksSlide() {
  const steps = [
    { icon: Search, num: 1, title: "Discover", desc: "Free property analysis with income projections for all 3 strategies" },
    { icon: Settings, num: 2, title: "Setup", desc: "Professional photos, optimized listings, and seamless onboarding" },
    { icon: TrendingUp, num: 3, title: "Thrive", desc: "Sit back and enjoy passive income while we handle everything" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-5xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-12">
          How It <span className="text-amber-400">Works</span>
        </h2>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center max-w-xs">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
                <step.icon className="w-10 h-10 text-white" />
              </div>
              <div className="text-amber-400 text-sm font-bold mb-2">STEP {step.num}</div>
              <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
              <p className="text-white/60">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
