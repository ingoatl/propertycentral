import { SlideLayout } from "../SlideLayout";
import { Paintbrush, Home, Crown, AlertCircle, CheckCircle } from "lucide-react";

export function InvestmentGuideSlide() {
  const tiers = [
    {
      icon: Paintbrush,
      tier: "Refresh",
      range: "Starting at $5K",
      description: "Minor updates, decor refresh, key room focus",
      features: ["Decor updates", "Key room staging", "Accessory styling", "Art placement"],
      color: "amber",
    },
    {
      icon: Home,
      tier: "From Scratch",
      range: "Starting at $10K",
      description: "Full staging, furniture, multiple rooms",
      features: ["Full home staging", "Quality furniture", "Complete styling", "Photography ready"],
      color: "orange",
      popular: true,
    },
    {
      icon: Crown,
      tier: "Premium Overhaul",
      range: "$20K-$40K+",
      description: "Complete transformation, custom pieces, renovations",
      features: ["Custom furniture", "Designer pieces", "Full renovation", "Luxury finishes"],
      color: "amber",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 lg:mb-10">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">Investment Guide</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            Design{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Fee
            </span>
          </h2>
          <p className="text-white/60 text-xl lg:text-2xl">
            Professional design services — furniture purchased separately at cost
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-8">
          {tiers.map((tier) => (
            <div
              key={tier.tier}
              className={`relative bg-white/5 backdrop-blur-sm rounded-3xl p-6 lg:p-8 border transition-all duration-300 ${
                tier.popular
                  ? "border-amber-400/50 bg-gradient-to-br from-amber-400/10 to-orange-500/10"
                  : "border-white/10 hover:border-amber-400/30"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1 rounded-full">
                  <span className="text-white text-sm font-semibold">MOST COMMON</span>
                </div>
              )}

              <div className="text-center">
                <tier.icon className={`w-12 h-12 lg:w-14 lg:h-14 mx-auto mb-4 ${
                  tier.color === "orange" ? "text-orange-400" : "text-amber-400"
                }`} />
                
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">{tier.tier}</h3>
                
                <p className={`text-4xl lg:text-5xl font-bold mb-4 ${
                  tier.color === "orange" 
                    ? "bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent"
                    : "text-amber-400"
                }`}>
                  {tier.range}
                </p>
                
                <p className="text-white/60 text-base lg:text-lg mb-6">{tier.description}</p>

                <ul className="space-y-3 text-left">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/70 text-sm lg:text-base">
                      <div className={`w-2 h-2 rounded-full ${
                        tier.color === "orange" ? "bg-orange-400" : "bg-amber-400"
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* What's Included Clarification */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-500/10 backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-green-500/30">
            <div className="flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold mb-2">Design Fee Covers:</p>
                <ul className="text-white/70 text-sm lg:text-base space-y-1">
                  <li>• Design consultation & planning</li>
                  <li>• Sourcing & coordination</li>
                  <li>• Project management</li>
                  <li>• Installation & styling</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-amber-500/30">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-semibold mb-2">Furniture & Materials:</p>
                <ul className="text-white/70 text-sm lg:text-base space-y-1">
                  <li>• Purchased separately at cost</li>
                  <li>• <span className="text-amber-400 font-semibold">No markups</span> on furniture</li>
                  <li>• Full transparency on pricing</li>
                  <li>• Owner approves all purchases</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 lg:p-5 border border-white/10 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-white/50 flex-shrink-0 mt-0.5" />
          <p className="text-white/50 text-sm lg:text-base">
            <span className="text-white/70 font-medium">Note:</span> Design fees do not include painting, 
            structural renovations, wallpaper installation, or board and batten accents. 
            Those services are quoted separately.
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
