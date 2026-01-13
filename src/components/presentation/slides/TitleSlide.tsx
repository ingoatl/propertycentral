import { SlideLayout } from "../SlideLayout";
import atlantaSkyline from "@/assets/presentation/atlanta-skyline-hero.jpg";

export function TitleSlide() {
  return (
    <SlideLayout backgroundImage={atlantaSkyline} overlay="gradient">
      <div className="text-center max-w-5xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/images/peachhaus-logo.png"
            alt="PeachHaus Group"
            className="h-20 md:h-28 mx-auto drop-shadow-2xl"
          />
        </div>

        {/* Main Title */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 tracking-tight">
          <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
            Welcome
          </span>
          <br />
          <span className="text-white/90">to PeachHaus</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl lg:text-3xl text-white/70 font-light mb-12 max-w-3xl mx-auto">
          Atlanta's Premier Property Management Partner
        </p>

        {/* Tagline */}
        <div className="flex items-center justify-center gap-6 text-white/60">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm md:text-base">Smart Rentals</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-sm md:text-base">Expert Management</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-sm md:text-base">Maximum Returns</span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
