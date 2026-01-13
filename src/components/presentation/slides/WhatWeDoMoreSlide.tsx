import { SlideLayout } from "../SlideLayout";
import { 
  Check, 
  X, 
  Brain, 
  Users, 
  Shield, 
  Camera, 
  Phone, 
  TrendingUp,
  Building2,
  FileText,
  Sparkles
} from "lucide-react";

export function WhatWeDoMoreSlide() {
  const comparisons = [
    {
      feature: "AI-Powered Dynamic Pricing",
      icon: Brain,
      peachhaus: true,
      others: false,
      description: "Real-time pricing optimization based on demand, events, seasonality",
    },
    {
      feature: "Corporate Housing Network",
      icon: Building2,
      peachhaus: true,
      others: false,
      description: "Direct relationships with Fortune 500 HR departments for premium tenants",
    },
    {
      feature: "Insurance Restoration Network",
      icon: Shield,
      peachhaus: true,
      others: false,
      description: "24-hour emergency placement for displaced families at premium rates",
    },
    {
      feature: "Hybrid Strategy Switching",
      icon: TrendingUp,
      peachhaus: true,
      others: false,
      description: "Seamlessly switch between STR, MTR, LTR based on market conditions",
    },
    {
      feature: "Professional Staging & Design",
      icon: Camera,
      peachhaus: true,
      others: "limited",
      description: "In-house interior design consultation for maximum appeal",
    },
    {
      feature: "Owner-First Communication",
      icon: Phone,
      peachhaus: true,
      others: "limited",
      description: "Direct line to your dedicated property manager, not a call center",
    },
    {
      feature: "Legal & Compliance Support",
      icon: FileText,
      peachhaus: true,
      others: false,
      description: "Navigate HOA restrictions, permits, and local regulations stress-free",
    },
    {
      feature: "Guest Vetting & Verification",
      icon: Users,
      peachhaus: true,
      others: "limited",
      description: "Multi-layer screening including background checks on all guests",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">The PeachHaus Difference</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            What We Do That{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Others Don't</span>
          </h2>
          <p className="text-xl text-white/60">Not all property managers are created equal</p>
        </div>

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {comparisons.map((item, index) => (
            <div 
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-amber-400/30 group-hover:to-orange-500/30 transition-all">
                  <item.icon className="w-6 h-6 text-amber-400" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold">{item.feature}</h3>
                    <div className="flex items-center gap-3">
                      {/* PeachHaus Column */}
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                        <span className="text-xs text-white/40 hidden sm:inline">PH</span>
                      </div>
                      {/* Others Column */}
                      <div className="flex items-center gap-1">
                        {item.others === true ? (
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-400" />
                          </div>
                        ) : item.others === "limited" ? (
                          <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <span className="text-yellow-400 text-xs font-bold">~</span>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <X className="w-4 h-4 text-red-400" />
                          </div>
                        )}
                        <span className="text-xs text-white/40 hidden sm:inline">Others</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-white/50 text-sm">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Badge */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-full px-6 py-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-white">
              <span className="font-semibold text-amber-400">Result:</span>{" "}
              30-50% higher returns than traditional property managers
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-green-400" />
            </div>
            <span>Full Service</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <span className="text-yellow-400 text-xs font-bold">~</span>
            </div>
            <span>Limited</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-3 h-3 text-red-400" />
            </div>
            <span>Not Offered</span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
