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
    before: { revenue: 1800, occupancy: 75 },
    after: { revenue: 3200, occupancy: 92 },
    strategy: "Hybrid (STR + MTR)",
    quote: "PeachHaus transformed our rental income beyond expectations.",
  },
  "The Berkley": {
    address: "3419 Smoke Hollow Pl, Roswell",
    before: { revenue: 2100, occupancy: 80 },
    after: { revenue: 3800, occupancy: 95 },
    strategy: "Mid-Term Focus",
    quote: "The corporate tenant network changed everything for us.",
  },
  "Lavish Living": {
    address: "3069 Rita Way, Smyrna",
    before: { revenue: 2400, occupancy: 70 },
    after: { revenue: 4200, occupancy: 93 },
    strategy: "Hybrid Premium",
    quote: "More income, less stress. Exactly what we needed.",
  },
};

export function CaseStudySlide({ propertyName }: CaseStudySlideProps) {
  const data = caseStudies[propertyName];
  const revenueIncrease = Math.round(((data.after.revenue - data.before.revenue) / data.before.revenue) * 100);

  // Fetch real property image from the properties table
  const { data: propertyImage, isLoading } = useQuery({
    queryKey: ['case-study-property-image', propertyName],
    queryFn: async () => {
      // Try to find property by name match
      const { data: properties } = await supabase
        .from('properties')
        .select('image_path, name')
        .ilike('name', `%${propertyName.split(' ')[0]}%`)
        .not('image_path', 'is', null)
        .limit(1);
      
      if (properties && properties.length > 0 && properties[0].image_path) {
        // Get public URL for the image
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(properties[0].image_path);
        return urlData.publicUrl;
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
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(propsByAddress[0].image_path);
        return urlData.publicUrl;
      }
      
      return null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <SlideLayout overlay="gradient">
        <div className="w-full max-w-7xl mx-auto">
          <p className="text-amber-400 uppercase tracking-widest text-base mb-3 text-center">Case Study</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-10 text-center">{propertyName}</h2>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
              <div className="w-full h-72 md:h-96 bg-white/5 animate-pulse" />
              <div className="bg-white/10 backdrop-blur-sm p-5">
                <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                <div className="h-5 bg-amber-400/20 rounded w-1/3" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
              <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </SlideLayout>
    );
  }

  // Use property image if found, otherwise use a gradient placeholder
  const hasImage = !!propertyImage;

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-base mb-3 text-center">Case Study</p>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-10 text-center">{propertyName}</h2>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            {hasImage ? (
              <img 
                src={propertyImage} 
                alt={propertyName} 
                className="w-full h-72 md:h-96 object-cover"
              />
            ) : (
              <div className="w-full h-72 md:h-96 bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-white/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <TrendingUp className="w-10 h-10 text-amber-400" />
                  </div>
                  <p className="text-white/50 text-lg">{propertyName}</p>
                </div>
              </div>
            )}
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
