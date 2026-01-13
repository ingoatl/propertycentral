import { SlideLayout } from "../SlideLayout";
import { Building2, Shield, Briefcase, Users } from "lucide-react";

export function CorporateNetworkSlide() {
  const corporateLogos = [
    { name: "Coca-Cola", type: "Fortune 500" },
    { name: "Delta Air Lines", type: "Fortune 500" },
    { name: "Home Depot", type: "Fortune 500" },
    { name: "UPS", type: "Fortune 500" },
    { name: "Emory Healthcare", type: "Healthcare" },
    { name: "Georgia-Pacific", type: "Fortune 500" },
    { name: "Cox Enterprises", type: "Media" },
    { name: "Chick-fil-A", type: "Food & Beverage" },
    { name: "NCR Corporation", type: "Technology" },
    { name: "Equifax", type: "Finance" },
    { name: "Aflac", type: "Insurance" },
    { name: "SunTrust", type: "Banking" },
  ];

  const stats = [
    { icon: Building2, value: "500+", label: "Corporate Stays Completed" },
    { icon: Shield, value: "24hr", label: "Emergency Placements" },
    { icon: Briefcase, value: "90+ days", label: "Average Stay Length" },
    { icon: Users, value: "15+", label: "Years Experience" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Exclusive Access</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Our <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Corporate Network</span>
          </h2>
          <p className="text-xl text-white/60">Access tenants others can't reach</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, index) => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <stat.icon className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-white/50 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Logo Marquee */}
        <div className="relative overflow-hidden py-6 bg-white/5 rounded-2xl border border-white/10 mb-10">
          <div className="flex animate-[scroll_30s_linear_infinite]">
            {[...corporateLogos, ...corporateLogos].map((company, index) => (
              <div
                key={index}
                className="flex-shrink-0 mx-8 flex flex-col items-center justify-center"
              >
                <div className="bg-white/10 rounded-lg px-6 py-4 min-w-[160px] text-center">
                  <p className="text-white font-semibold">{company.name}</p>
                  <p className="text-amber-400 text-xs">{company.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
          {["Healthcare", "Fortune 500", "Government", "Film & Entertainment", "Tech Companies", "Consulting"].map((cat) => (
            <div key={cat} className="bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-2">
              <span className="text-amber-400 text-sm font-medium">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </SlideLayout>
  );
}
