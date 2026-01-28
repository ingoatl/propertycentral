import { SlideLayout } from "../SlideLayout";
import { TrendingUp, Star } from "lucide-react";

interface CaseStudySlideProps {
  propertyName: "Woodland Lane" | "The Berkley" | "Lavish Living";
}

const caseStudies = {
  "Woodland Lane": {
    address: "Mableton, GA",
    before: { revenue: 1800, occupancy: 75 },
    after: { revenue: 3200, occupancy: 92 },
    strategy: "Hybrid (STR + MTR)",
    quote: "PeachHaus transformed our rental income beyond expectations.",
    imageUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/54536b8d-9b6f-41f8-855f-3c4eb78aaf00-1761078098901.png",
  },
  "The Berkley": {
    address: "Roswell, GA",
    before: { revenue: 2100, occupancy: 80 },
    after: { revenue: 3800, occupancy: 95 },
    strategy: "Mid-Term Focus",
    quote: "The corporate tenant network changed everything for us.",
    imageUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/bdb82ccb-b2fa-42fb-8c58-42aad6e2ef38-1761181004138.jpg",
  },
  "Lavish Living": {
    address: "Smyrna, GA",
    before: { revenue: 2400, occupancy: 70 },
    after: { revenue: 4200, occupancy: 93 },
    strategy: "Hybrid Premium",
    quote: "More income, less stress. Exactly what we needed.",
    imageUrl: "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/96e2819b-c0e8-4281-b535-5c99c39973b3-1761592743837.jpg",
  },
};

export function CaseStudySlide({ propertyName }: CaseStudySlideProps) {
  const data = caseStudies[propertyName];
  const revenueIncrease = Math.round(((data.after.revenue - data.before.revenue) / data.before.revenue) * 100);

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-3 text-center">Case Study</p>
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-10 lg:mb-12 text-center">{propertyName}</h2>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="rounded-2xl lg:rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
            <img 
              src={data.imageUrl} 
              alt={propertyName} 
              className="w-full h-72 md:h-80 lg:h-96 object-cover"
            />
            <div className="bg-white/10 backdrop-blur-sm p-5 lg:p-6">
              <p className="text-white/70 text-lg lg:text-xl">{data.address}</p>
              <p className="text-amber-400 font-semibold text-xl lg:text-2xl">{data.strategy}</p>
            </div>
          </div>

          <div className="space-y-6 lg:space-y-8">
            <div className="grid grid-cols-2 gap-4 lg:gap-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl lg:rounded-3xl p-6 lg:p-8 text-center">
                <p className="text-white/50 text-lg lg:text-xl mb-2">Before PeachHaus</p>
                <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">${data.before.revenue}<span className="text-2xl lg:text-3xl">/mo</span></p>
                <p className="text-white/40 text-lg lg:text-xl mt-2">{data.before.occupancy}% occupancy</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl lg:rounded-3xl p-6 lg:p-8 text-center">
                <p className="text-white/50 text-lg lg:text-xl mb-2">After PeachHaus</p>
                <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-green-400">${data.after.revenue}<span className="text-2xl lg:text-3xl">/mo</span></p>
                <p className="text-white/40 text-lg lg:text-xl mt-2">{data.after.occupancy}% occupancy</p>
              </div>
            </div>

            <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl lg:rounded-3xl p-8 lg:p-10 text-center">
              <TrendingUp className="w-14 h-14 lg:w-16 lg:h-16 text-amber-400 mx-auto mb-4" />
              <p className="text-6xl md:text-7xl lg:text-8xl font-bold text-amber-400">+{revenueIncrease}%</p>
              <p className="text-white/60 text-xl lg:text-2xl mt-3">Revenue Increase</p>
            </div>

            <div className="flex items-start gap-4 bg-white/5 rounded-2xl p-6 lg:p-8">
              <Star className="w-8 h-8 lg:w-10 lg:h-10 text-amber-400 flex-shrink-0 mt-1" />
              <p className="text-white/80 italic text-xl lg:text-2xl">"{data.quote}"</p>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
