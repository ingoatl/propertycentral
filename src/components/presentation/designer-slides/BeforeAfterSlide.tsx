import { SlideLayout } from "../SlideLayout";
import { ExternalLink, DollarSign } from "lucide-react";

// Import combined before/after pair images from user uploads
import whitehurstPair from "@/assets/designer/whitehurst-pair1.png";
import southvalePair from "@/assets/designer/southvale-pair.png";
import justicePair from "@/assets/designer/justice-pair.png";
import lakewoodPair from "@/assets/designer/lakewood-pair.png";
import brushyPair from "@/assets/designer/brushy-pair.png";
import tolaniPair from "@/assets/designer/tolani-pair.png";

interface CaseStudy {
  name: string;
  location?: string;
  budgetRange: string;
  year: string;
  airbnbUrl: string;
  airbnbShortUrl?: string;
  pairImage: string;
  highlights?: string[];
}

// Order matches PDF: Whitehurst, Southvale, Justice, Lakewood, Brushy, To Lani
const caseStudies: Record<string, CaseStudy> = {
  whitehurst: {
    name: "Whitehurst",
    location: "Marietta",
    budgetRange: "$30K-$40K",
    year: "2025",
    airbnbUrl: "https://airbnb.com/h/designermarietta",
    airbnbShortUrl: "airbnb.com/h/designermarietta",
    pairImage: whitehurstPair,
    highlights: ["Full home transformation", "Premium furnishings", "Designer touches"],
  },
  southvale: {
    name: "Southvale",
    budgetRange: "$35K",
    year: "2025",
    airbnbUrl: "https://www.airbnb.com/rooms/1394277589009252467",
    pairImage: southvalePair,
    highlights: ["Modern aesthetic", "Cohesive design", "Guest-focused amenities"],
  },
  justice: {
    name: "Justice",
    budgetRange: "$25K",
    year: "2025",
    airbnbUrl: "https://www.airbnb.com/rooms/1395677657124996447",
    pairImage: justicePair,
    highlights: ["Complete makeover", "Green accent wall", "High-end finishes"],
  },
  lakewood: {
    name: "Lakewood",
    budgetRange: "$23K",
    year: "2024",
    airbnbUrl: "https://www.airbnb.com/rooms/1399393314185549107",
    pairImage: lakewoodPair,
    highlights: ["Warm tones", "Cozy atmosphere", "Functional layout"],
  },
  brushy: {
    name: "Brushy",
    budgetRange: "$23K",
    year: "2024",
    airbnbUrl: "https://www.airbnb.com/rooms/1108098053080240369",
    pairImage: brushyPair,
    highlights: ["Natural elements", "Inviting spaces", "Photo-ready rooms"],
  },
  tolani: {
    name: "To Lani",
    budgetRange: "$20K",
    year: "2023",
    airbnbUrl: "https://www.airbnb.com/rooms/1066144648492952003",
    pairImage: tolaniPair,
    highlights: ["Budget-conscious", "High impact", "Thoughtful details"],
  },
};

interface BeforeAfterSlideProps {
  propertyKey: keyof typeof caseStudies;
}

export function BeforeAfterSlide({ propertyKey }: BeforeAfterSlideProps) {
  const property = caseStudies[propertyKey];

  if (!property) {
    return null;
  }

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-3">Case Study</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            {property.name}
            {property.location && (
              <span className="text-white/50 font-normal"> — {property.location}</span>
            )}
          </h2>
        </div>

        {/* Combined Before/After Image with Labels */}
        <div className="relative mb-8">
          {/* Before Label - Left Side */}
          <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-white font-semibold text-lg">BEFORE</span>
          </div>
          {/* After Label - Right Side */}
          <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 rounded-full">
            <span className="text-white font-semibold text-lg">AFTER</span>
          </div>
          <img
            src={property.pairImage}
            alt={`${property.name} Before and After`}
            className="w-full h-auto max-h-[50vh] object-contain rounded-2xl border border-white/10"
          />
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
          {/* Budget */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-white/10 text-center">
            <DollarSign className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-white/50 text-sm uppercase tracking-wide mb-1">Investment Range</p>
            <p className="text-2xl lg:text-3xl font-bold text-white">{property.budgetRange}</p>
            <p className="text-white/40 text-sm">({property.year})</p>
          </div>

          {/* Highlights */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-white/10">
            <p className="text-white/50 text-sm uppercase tracking-wide mb-3 text-center">Transformation Highlights</p>
            <ul className="space-y-2">
              {property.highlights?.map((highlight, i) => (
                <li key={i} className="flex items-center gap-2 text-white/80 text-sm lg:text-base">
                  <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          {/* Verify Link */}
          <a
            href={property.airbnbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-br from-amber-400/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-amber-400/30 text-center hover:border-amber-400 transition-all duration-300 group"
          >
            <ExternalLink className="w-8 h-8 text-amber-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <p className="text-white/50 text-sm uppercase tracking-wide mb-2">Verify on Airbnb</p>
            <p className="text-amber-400 font-semibold text-base lg:text-lg">
              {property.airbnbShortUrl || "View Live Listing"}
            </p>
            <p className="text-white/40 text-xs mt-2">Click to see the property yourself</p>
          </a>
        </div>
      </div>
    </SlideLayout>
  );
}