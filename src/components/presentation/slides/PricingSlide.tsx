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
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Transparent <span className="text-amber-400">Pricing</span>
          </h2>
          <p className="text-xl text-white/60">Performance-based: We only earn when you earn more</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {packages.map((pkg, i) => (
            <div key={i} className={`relative bg-white/5 rounded-2xl p-6 border ${pkg.popular ? 'border-amber-400' : 'border-white/10'}`}>
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-white mb-2">{pkg.name}</h3>
              <div className="text-4xl font-bold text-amber-400 mb-2">{pkg.fee}<span className="text-lg text-white/50"> mgmt fee</span></div>
              <p className="text-white/50 text-sm mb-6">{pkg.desc}</p>
              <ul className="space-y-2">
                {pkg.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-white/70 text-sm">
                    <Check className="w-4 h-4 text-green-400" /> {f}
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
