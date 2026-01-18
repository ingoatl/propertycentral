import { SlideLayout } from "../SlideLayout";
import { TrendingUp, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CaseStudySlideProps {
  propertyName: "Woodland Lane" | "The Berkley" | "Lavish Living";
}

const caseStudies = {
  "Woodland Lane": {
    address: "184 Woodland Ln SW, Mableton",
    fallbackImage: "https://www.peachhausgroup.com/lovable-uploads/6a187675-4db9-49e8-b0ad-ca1e121aff1a.png",
    before: { revenue: 1800, occupancy: 75 },
    after: { revenue: 3200, occupancy: 92 },
    strategy: "Hybrid (STR + MTR)",
    quote: "PeachHaus transformed our rental income beyond expectations.",
  },
  "The Berkley": {
    address: "3419 Smoke Hollow Pl, Roswell",
    fallbackImage: "https://www.peachhausgroup.com/lovable-uploads/1d9f37d8-b296-4310-ada6-54ee6bd52625.jpg",
    before: { revenue: 2100, occupancy: 80 },
    after: { revenue: 3800, occupancy: 95 },
    strategy: "Mid-Term Focus",
    quote: "The corporate tenant network changed everything for us.",
  },
  "Lavish Living": {
    address: "3069 Rita Way, Smyrna",
    fallbackImage: "https://www.peachhausgroup.com/lovable-uploads/35c18a51-5bad-4ff6-9e27-993af0747653.jpg",
    before: { revenue: 2400, occupancy: 70 },
    after: { revenue: 4200, occupancy: 93 },
    strategy: "Hybrid Premium",
    quote: "More income, less stress. Exactly what we needed.",
  },
};

export function CaseStudySlide({ propertyName }: CaseStudySlideProps) {
  const data = caseStudies[propertyName];
  const revenueIncrease = Math.round(((data.after.revenue - data.before.revenue) / data.before.revenue) * 100);

  // Fetch real property image from onboarding if available
  const { data: propertyImage, isLoading } = useQuery({
    queryKey: ['case-study-image', propertyName],
    queryFn: async () => {
      // Try to find property by name match
      const { data: properties } = await supabase
        .from('properties')
        .select('image_path, name')
        .ilike('name', `%${propertyName.split(' ')[0]}%`)
        .not('image_path', 'is', null)
        .limit(1);
      
      if (properties && properties.length > 0 && properties[0].image_path) {
        return properties[0].image_path;
      }
      
      // Try to find by address match
      const addressPart = data.address.split(',')[0];
      const { data: propsByAddress } = await supabase
        .from('properties')
        .select('image_path')
        .ilike('address', `%${addressPart}%`)
        .not('image_path', 'is', null)
        .limit(1);
      
      if (propsByAddress && propsByAddress.length > 0 && propsByAddress[0].image_path) {
        return propsByAddress[0].image_path;
      }
      
      return null;
    },
    staleTime: Infinity, // Don't refetch
    gcTime: Infinity,
  });

  // Always use fallback image - don't flash database images
  const imageUrl = data.fallbackImage;

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-base mb-3 text-center">Case Study</p>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-10 text-center">{propertyName}</h2>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <img 
              src={imageUrl} 
              alt={propertyName} 
              className="w-full h-72 md:h-96 object-cover"
            />
            <div className="bg-white/10 backdrop-blur-sm p-5">
              <p className="text-white/70 text-base">{data.address}</p>
              <p className="text-amber-400 font-semibold text-lg">{data.strategy}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
                <p className="text-white/50 text-base mb-2">Before PeachHaus</p>
                <p className="text-3xl md:text-4xl font-bold text-white">${data.before.revenue}/mo</p>
                <p className="text-white/40 text-base mt-1">{data.before.occupancy}% occupancy</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
                <p className="text-white/50 text-base mb-2">After PeachHaus</p>
                <p className="text-3xl md:text-4xl font-bold text-green-400">${data.after.revenue}/mo</p>
                <p className="text-white/40 text-base mt-1">{data.after.occupancy}% occupancy</p>
              </div>
            </div>

            <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-8 text-center">
              <TrendingUp className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <p className="text-5xl md:text-6xl font-bold text-amber-400">+{revenueIncrease}%</p>
              <p className="text-white/60 text-lg mt-2">Revenue Increase</p>
            </div>

            <div className="flex items-start gap-4 bg-white/5 rounded-2xl p-6">
              <Star className="w-7 h-7 text-amber-400 flex-shrink-0 mt-1" />
              <p className="text-white/80 italic text-lg md:text-xl">"{data.quote}"</p>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
