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
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center mb-10 lg:mb-12">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">Exclusive Access</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            Our <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Corporate Network</span>
          </h2>
          <p className="text-xl lg:text-2xl text-white/60">Access tenants others can't reach</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mb-10 lg:mb-12">
          {stats.map((stat, index) => (
            <div key={stat.label} className="bg-white/5 rounded-xl lg:rounded-2xl p-5 lg:p-6 text-center border border-white/10">
              <stat.icon className="w-10 h-10 lg:w-12 lg:h-12 text-amber-400 mx-auto mb-3" />
              <p className="text-3xl lg:text-4xl font-bold text-white">{stat.value}</p>
              <p className="text-white/50 text-sm lg:text-base">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Logo Marquee */}
        <div className="relative overflow-hidden py-6 lg:py-8 bg-white/5 rounded-2xl lg:rounded-3xl border border-white/10 mb-10 lg:mb-12">
          <div className="flex animate-[scroll_30s_linear_infinite]">
            {[...corporateLogos, ...corporateLogos].map((company, index) => (
              <div
                key={index}
                className="flex-shrink-0 mx-6 lg:mx-8 flex flex-col items-center justify-center"
              >
                <div className="bg-white/10 rounded-lg px-6 lg:px-8 py-4 lg:py-5 min-w-[180px] lg:min-w-[200px] text-center">
                  <p className="text-white font-semibold text-lg lg:text-xl">{company.name}</p>
                  <p className="text-amber-400 text-sm lg:text-base">{company.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 lg:gap-4 text-center">
          {["Healthcare", "Fortune 500", "Government", "Film & Entertainment", "Tech Companies", "Consulting"].map((cat) => (
            <div key={cat} className="bg-amber-400/10 border border-amber-400/30 rounded-full px-4 lg:px-6 py-2 lg:py-3">
              <span className="text-amber-400 text-sm lg:text-base font-medium">{cat}</span>
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
