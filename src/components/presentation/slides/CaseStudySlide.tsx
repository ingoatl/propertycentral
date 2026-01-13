import { SlideLayout } from "../SlideLayout";
import { TrendingUp, Star } from "lucide-react";

interface CaseStudySlideProps {
  propertyName: "Woodland Lane" | "The Berkley" | "Lavish Living";
}

const caseStudies = {
  "Woodland Lane": {
    address: "184 Woodland Ln SW, Mableton",
    image: "https://www.peachhausgroup.com/lovable-uploads/6a187675-4db9-49e8-b0ad-ca1e121aff1a.png",
    before: { revenue: 1800, occupancy: 75 },
    after: { revenue: 3200, occupancy: 92 },
    strategy: "Hybrid (STR + MTR)",
    quote: "PeachHaus transformed our rental income beyond expectations.",
  },
  "The Berkley": {
    address: "3419 Smoke Hollow Pl, Roswell",
    image: "https://www.peachhausgroup.com/lovable-uploads/1d9f37d8-b296-4310-ada6-54ee6bd52625.jpg",
    before: { revenue: 2100, occupancy: 80 },
    after: { revenue: 3800, occupancy: 95 },
    strategy: "Mid-Term Focus",
    quote: "The corporate tenant network changed everything for us.",
  },
  "Lavish Living": {
    address: "3069 Rita Way, Smyrna",
    image: "https://www.peachhausgroup.com/lovable-uploads/35c18a51-5bad-4ff6-9e27-993af0747653.jpg",
    before: { revenue: 2400, occupancy: 70 },
    after: { revenue: 4200, occupancy: 93 },
    strategy: "Hybrid Premium",
    quote: "More income, less stress. Exactly what we needed.",
  },
};

export function CaseStudySlide({ propertyName }: CaseStudySlideProps) {
  const data = caseStudies[propertyName];
  const revenueIncrease = Math.round(((data.after.revenue - data.before.revenue) / data.before.revenue) * 100);

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-sm mb-2 text-center">Case Study</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">{propertyName}</h2>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="rounded-2xl overflow-hidden border border-white/20">
            <img src={data.image} alt={propertyName} className="w-full h-64 md:h-80 object-cover" />
            <div className="bg-white/10 p-4">
              <p className="text-white/70 text-sm">{data.address}</p>
              <p className="text-amber-400 font-medium">{data.strategy}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-white/50 text-sm mb-1">Before PeachHaus</p>
                <p className="text-2xl font-bold text-white">${data.before.revenue}/mo</p>
                <p className="text-white/40 text-sm">{data.before.occupancy}% occupancy</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-white/50 text-sm mb-1">After PeachHaus</p>
                <p className="text-2xl font-bold text-green-400">${data.after.revenue}/mo</p>
                <p className="text-white/40 text-sm">{data.after.occupancy}% occupancy</p>
              </div>
            </div>

            <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-6 text-center">
              <TrendingUp className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-amber-400">+{revenueIncrease}%</p>
              <p className="text-white/60">Revenue Increase</p>
            </div>

            <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
              <Star className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
              <p className="text-white/80 italic">"{data.quote}"</p>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
