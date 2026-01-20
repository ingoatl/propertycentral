import { SlideLayout } from "../SlideLayout";
import handyHoneyLogo from "@/assets/designer/handy-honey-logo-web.png";

export function DesignerTitleSlide() {
  return (
    <SlideLayout overlay="gradient">
      <div className="text-center max-w-6xl mx-auto animate-fade-in">
        {/* Logos */}
        <div className="flex items-center justify-center gap-8 lg:gap-12 mb-10 lg:mb-14">
          <img
            src="/images/peachhaus-logo.png"
            alt="PeachHaus Group"
            className="h-16 md:h-20 lg:h-24 drop-shadow-2xl"
          />
          <span className="text-white/40 text-4xl lg:text-5xl font-light">×</span>
          <img
            src={handyHoneyLogo}
            alt="Handy Honey"
            className="h-20 md:h-24 lg:h-28 drop-shadow-2xl"
          />
        </div>

        {/* Main Title */}
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-8 tracking-tight">
          <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
            Elevate
          </span>
          <br />
          <span className="text-white/90">Your Property</span>
        </h1>

        {/* Subtitle */}
        <p className="text-2xl md:text-3xl lg:text-4xl text-white/70 font-light mb-8 max-w-4xl mx-auto">
          Professional Design & Staging Services
        </p>

        {/* Subtext */}
        <p className="text-lg md:text-xl lg:text-2xl text-white/50 max-w-3xl mx-auto">
          Presented by PeachHaus Group in partnership with Handy Honey
        </p>

        {/* Decorative Elements */}
        <div className="flex items-center justify-center gap-8 lg:gap-10 mt-12 text-white/60">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-base md:text-lg lg:text-xl">Expert Design</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-base md:text-lg lg:text-xl">Premium Staging</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-base md:text-lg lg:text-xl">Maximum ROI</span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
