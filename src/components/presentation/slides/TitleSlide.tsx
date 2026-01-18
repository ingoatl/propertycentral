import { SlideLayout } from "../SlideLayout";
import atlantaSkyline from "@/assets/presentation/atlanta-skyline-hero.jpg";

export function TitleSlide() {
  return (
    <SlideLayout backgroundImage={atlantaSkyline} overlay="gradient">
      <div className="text-center max-w-6xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="mb-10 lg:mb-12">
          <img
            src="/images/peachhaus-logo.png"
            alt="PeachHaus Group"
            className="h-24 md:h-32 lg:h-40 mx-auto drop-shadow-2xl"
          />
        </div>

        {/* Main Title */}
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-8 tracking-tight">
          <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
            Welcome
          </span>
          <br />
          <span className="text-white/90">to PeachHaus</span>
        </h1>

        {/* Subtitle */}
        <p className="text-2xl md:text-3xl lg:text-4xl text-white/70 font-light mb-14 max-w-4xl mx-auto">
          Atlanta's Premier Property Management Partner
        </p>

        {/* Tagline */}
        <div className="flex items-center justify-center gap-8 lg:gap-10 text-white/60">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-base md:text-lg lg:text-xl">Smart Rentals</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-base md:text-lg lg:text-xl">Expert Management</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-base md:text-lg lg:text-xl">Maximum Returns</span>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
