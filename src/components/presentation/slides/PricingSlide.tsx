import { SlideLayout } from "../SlideLayout";
import { Check, Sparkles } from "lucide-react";

export function PricingSlide() {
  const packages = [
    {
      name: "Mid-Term Essential",
      fee: "18%",
      desc: "Essential mid-term rental management for 1-6 month stays",
      features: ["Mid-term listing optimization", "Corporate & medical tenant network", "Professional furniture coordination", "Monthly financial reporting", "Lease management & renewals"],
    },
    {
      name: "Hybrid Strategy",
      fee: "20%",
      desc: "Dynamic STR/MTR switching for maximum revenue",
      features: ["Everything in Essential", "Dynamic rental model switching", "Real-time market optimization", "Premium corporate network", "Dedicated strategy manager"],
      popular: true,
    },
    {
      name: "Hybrid Premium Plus",
      fee: "25%",
      desc: "Complete hybrid empire with branded marketing",
      features: ["Everything in Hybrid", "Branded direct-booking website", "Multi-channel marketing", "Exclusive insurance network access", "Premium guest experience"],
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center mb-10 lg:mb-12">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            Transparent <span className="text-amber-400">Pricing</span>
          </h2>
          <p className="text-xl lg:text-2xl text-white/60">Performance-based: We only earn when you earn more</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {packages.map((pkg, i) => (
            <div key={i} className={`relative bg-white/5 rounded-2xl lg:rounded-3xl p-6 lg:p-8 border ${pkg.popular ? 'border-amber-400' : 'border-white/10'}`}>
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-sm lg:text-base font-bold px-5 py-1.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-4 h-4" /> Most Popular
                </div>
              )}
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">{pkg.name}</h3>
              <div className="text-5xl lg:text-6xl font-bold text-amber-400 mb-3">{pkg.fee}<span className="text-xl lg:text-2xl text-white/50"> mgmt fee</span></div>
              <p className="text-white/50 text-base lg:text-lg mb-6">{pkg.desc}</p>
              <ul className="space-y-3">
                {pkg.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-white/70 text-base lg:text-lg">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
