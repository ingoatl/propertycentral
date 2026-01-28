import { SlideLayout } from "../SlideLayout";
import { ExternalLink, DollarSign } from "lucide-react";

// Import new before/after images
import whitehurstBefore from "@/assets/designer/whitehurst-before-new.jpg";
import whitehurstAfter from "@/assets/designer/whitehurst-after-new.jpg";
import southvaleBefore from "@/assets/designer/southvale-before-new.jpg";
import southvaleAfter from "@/assets/designer/southvale-after-new.jpg";
import justiceBefore from "@/assets/designer/justice-before-new.jpg";
import justiceAfter from "@/assets/designer/justice-after-new.jpg";
import lakewoodBefore from "@/assets/designer/lakewood-before-new.jpg";
import lakewoodAfter from "@/assets/designer/lakewood-after-new.jpg";
import brushyBefore from "@/assets/designer/brushy-before-new.jpg";
import brushyAfter from "@/assets/designer/brushy-after-new.jpg";
import tolaniBefore from "@/assets/designer/tolani-before-new.jpg";
import tolaniAfter from "@/assets/designer/tolani-after-new.jpg";

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

// Order matches PDF: Whitehurst, Southvale, Justice, Lakewood, Brushy, To Lani
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
    budgetRange: "$25K",
    year: "2025",
    airbnbUrl: "https://tinyurl.com/AirBnBSouthvale",
    airbnbShortUrl: "View on Airbnb",
    beforeImage: southvaleBefore,
    afterImage: southvaleAfter,
    highlights: ["Modern aesthetic", "Cohesive design", "Guest-focused amenities"],
  },
  justice: {
    name: "Justice",
    budgetRange: "$23K",
    year: "2024",
    airbnbUrl: "https://tinyurl.com/AirBnBJustice",
    airbnbShortUrl: "View on Airbnb",
    beforeImage: justiceBefore,
    afterImage: justiceAfter,
    highlights: ["Complete makeover", "Stone fireplace focal point", "High-end finishes"],
  },
  lakewood: {
    name: "Lakewood",
    budgetRange: "$23K",
    year: "2024",
    airbnbUrl: "https://tinyurl.com/AirBnBLakewood",
    airbnbShortUrl: "View on Airbnb",
    beforeImage: lakewoodBefore,
    afterImage: lakewoodAfter,
    highlights: ["Warm tones", "Cozy atmosphere", "Functional layout"],
  },
  brushy: {
    name: "Brushy",
    budgetRange: "$23K",
    year: "2024",
    airbnbUrl: "https://tinyurl.com/AirBnBBrushy",
    airbnbShortUrl: "View on Airbnb",
    beforeImage: brushyBefore,
    afterImage: brushyAfter,
    highlights: ["Natural elements", "Inviting spaces", "Photo-ready rooms"],
  },
  tolani: {
    name: "To Lani",
    budgetRange: "$20K",
    year: "2023",
    airbnbUrl: "https://tinyurl.com/AirBnBToLani",
    airbnbShortUrl: "View on Airbnb",
    beforeImage: tolaniBefore,
    afterImage: tolaniAfter,
    highlights: ["Budget-conscious", "Signature accent wall", "Five-star reviews"],
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
        <div className="text-center mb-6">
          <p className="text-amber-400 uppercase tracking-widest text-sm lg:text-base mb-2">Case Study</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
            {property.name}
            {property.location && (
              <span className="text-white/50 font-normal"> — {property.location}</span>
            )}
          </h2>
        </div>

        {/* Side-by-Side Before/After Images */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Before */}
          <div className="relative">
            <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <span className="text-white font-semibold text-sm">BEFORE</span>
            </div>
            <img
              src={property.beforeImage}
              alt={`${property.name} Before`}
              className="w-full h-[40vh] object-cover rounded-xl border border-white/10"
            />
          </div>
          {/* After */}
          <div className="relative">
            <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 rounded-full">
              <span className="text-white font-semibold text-sm">AFTER</span>
            </div>
            <img
              src={property.afterImage}
              alt={`${property.name} After`}
              className="w-full h-[40vh] object-cover rounded-xl border border-white/10"
            />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Budget */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center">
            <DollarSign className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Investment</p>
            <p className="text-xl lg:text-2xl font-bold text-white">{property.budgetRange}</p>
            <p className="text-white/40 text-xs">({property.year})</p>
          </div>

          {/* Highlights */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <p className="text-white/50 text-xs uppercase tracking-wide mb-2 text-center">Highlights</p>
            <ul className="space-y-1">
              {property.highlights?.map((highlight, i) => (
                <li key={i} className="flex items-center gap-2 text-white/80 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
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
            className="bg-gradient-to-br from-amber-400/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-4 border border-amber-400/30 text-center hover:border-amber-400 transition-all duration-300 group"
          >
            <ExternalLink className="w-6 h-6 text-amber-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Verify Live</p>
            <p className="text-amber-400 font-semibold text-sm">
              {property.airbnbShortUrl || "View Listing"}
            </p>
          </a>
        </div>
      </div>
    </SlideLayout>
  );
}
