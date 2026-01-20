import { SlideLayout } from "../SlideLayout";
import { ExternalLink, DollarSign, MapPin } from "lucide-react";

// Import before/after images - using correct paired images from PDF
import whitehurstBefore from "@/assets/designer/whitehurst-before-new.jpg";
import whitehurstAfter from "@/assets/designer/whitehurst-after-new.jpg";
import southvaleBefore from "@/assets/designer/southvale-before-new.jpg";
import southvaleAfter from "@/assets/designer/southvale-after-new.jpg";
import justiceBefore from "@/assets/designer/justice-before-new.jpg";
import justiceAfter from "@/assets/designer/justice-after-new.jpg";
import lakewoodBefore from "@/assets/designer/lakewood-before-new.jpg";
import lakewoodAfter from "@/assets/designer/lakewood-after-new.jpg";
import brushyBefore from "@/assets/designer/brushy-before.jpg";
import brushyAfter from "@/assets/designer/brushy-after.jpg";
import tolaniBefore from "@/assets/designer/tolani-before.jpg";
import tolaniAfter from "@/assets/designer/tolani-after.jpg";


interface CaseStudy {
  name: string;
  location?: string;
  budgetRange: string;
  year: string;
  airbnbUrl: string;
  airbnbShortUrl?: string;
  beforeImage: string;
  afterImage: string;
  highlights?: string[];
}

const caseStudies: Record<string, CaseStudy> = {
  whitehurst: {
    name: "Whitehurst",
    location: "Marietta",
    budgetRange: "$30K-$40K",
    year: "2025",
    airbnbUrl: "https://airbnb.com/h/designermarietta",
    airbnbShortUrl: "airbnb.com/h/designermarietta",
    beforeImage: whitehurstBefore,
    afterImage: whitehurstAfter,
    highlights: ["Full home transformation", "Premium furnishings", "Designer touches"],
  },
  southvale: {
    name: "Southvale",
    budgetRange: "$20K-$30K",
    year: "2025",
    airbnbUrl: "https://www.airbnb.com/rooms/1394277589009252467",
    beforeImage: southvaleBefore,
    afterImage: southvaleAfter,
    highlights: ["Modern aesthetic", "Cohesive design", "Guest-focused amenities"],
  },
  justice: {
    name: "Justice",
    budgetRange: "$20K-$25K",
    year: "2024",
    airbnbUrl: "https://www.airbnb.com/rooms/1395677657124996447",
    beforeImage: justiceBefore,
    afterImage: justiceAfter,
    highlights: ["Complete makeover", "Neutral palette", "High-end finishes"],
  },
  lakewood: {
    name: "Lakewood",
    budgetRange: "$20K-$25K",
    year: "2024",
    airbnbUrl: "https://www.airbnb.com/rooms/1399393314185549107",
    beforeImage: lakewoodBefore,
    afterImage: lakewoodAfter,
    highlights: ["Warm tones", "Cozy atmosphere", "Functional layout"],
  },
  brushy: {
    name: "Brushy",
    budgetRange: "$20K-$25K",
    year: "2024",
    airbnbUrl: "https://www.airbnb.com/rooms/1108098053080240369",
    beforeImage: brushyBefore,
    afterImage: brushyAfter,
    highlights: ["Natural elements", "Inviting spaces", "Photo-ready rooms"],
  },
  tolani: {
    name: "To Lani",
    budgetRange: "$18K-$22K",
    year: "2023",
    airbnbUrl: "https://www.airbnb.com/rooms/1066144648492952003",
    beforeImage: tolaniBefore,
    afterImage: tolaniAfter,
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
        <div className="text-center mb-8 lg:mb-10">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-3">Case Study</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            {property.name}
            {property.location && (
              <span className="text-white/50 font-normal"> — {property.location}</span>
            )}
          </h2>
        </div>

        {/* Before/After Comparison */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-8">
          {/* Before */}
          <div className="relative group">
            <div className="absolute top-4 left-4 z-10 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-white font-semibold text-lg">BEFORE</span>
            </div>
            <img
              src={property.beforeImage}
              alt={`${property.name} Before`}
              className="w-full h-64 md:h-72 lg:h-80 object-cover rounded-2xl border border-white/10"
            />
          </div>

          {/* After */}
          <div className="relative group">
            <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 rounded-full">
              <span className="text-white font-semibold text-lg">AFTER</span>
            </div>
            <img
              src={property.afterImage}
              alt={`${property.name} After`}
              className="w-full h-64 md:h-72 lg:h-80 object-cover rounded-2xl border border-amber-400/30"
            />
          </div>
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
