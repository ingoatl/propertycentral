import { SlideLayout } from "../SlideLayout";
import { Phone, Globe, Mail, Wrench } from "lucide-react";
import ilanaHero from "@/assets/designer/ilana-hero.png";

export function MeetIlanaSlide() {
  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        {/* Section Header */}
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-center text-white mb-10 lg:mb-14">
          Meet <span className="text-amber-400">Ilana</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Image Side */}
          <div className="flex justify-center">
            <div className="relative">
              <img
                src={ilanaHero}
                alt="Ilana - Handy Honey"
                className="w-80 h-80 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] object-contain drop-shadow-2xl"
              />
            </div>
          </div>

          {/* Info Side */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 lg:p-10 border border-white/10">
            <div className="space-y-6">
              {/* Title & Tagline */}
              <div>
                <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">Ilana Weismark</h3>
                <p className="text-amber-400 font-semibold text-xl lg:text-2xl mb-2">Owner & Chief Handywoman</p>
                <p className="text-orange-400 italic text-lg lg:text-xl">
                  "Sweet Fixes Without the Nagging" 🛠️💛
                </p>
              </div>

              {/* Bio */}
              <p className="text-white/70 text-lg lg:text-xl leading-relaxed">
                Ilana specializes in transforming rental properties into stunning spaces that command premium rates. 
                With <span className="text-amber-400 font-semibold">15 years of home staging experience</span> and 
                expertise in short-term rental design, she understands what guests are looking for and how to make 
                your property stand out in a crowded market.
              </p>

              <p className="text-white/60 text-base lg:text-lg leading-relaxed">
                A proud French transplant with a "je ne sais quoi" attitude, Ilana tackles entire Airbnb outfittings—from 
                wall color picks to design, installation, and turn-key product. Great things come in small packages!
              </p>

              {/* Contact Info */}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-white/10">
                <a href="tel:770-312-6723" className="flex items-center gap-3 text-white/70 hover:text-amber-400 transition-colors">
                  <Phone className="w-5 h-5 text-amber-400" />
                  <span className="text-lg lg:text-xl">770-312-6723</span>
                </a>
                <a href="https://www.handyhoney.net" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/70 hover:text-amber-400 transition-colors">
                  <Globe className="w-5 h-5 text-amber-400" />
                  <span className="text-lg lg:text-xl">handyhoney.net</span>
                </a>
                <a href="mailto:info@handyhoney.net" className="flex items-center gap-3 text-white/70 hover:text-amber-400 transition-colors">
                  <Mail className="w-5 h-5 text-amber-400" />
                  <span className="text-lg lg:text-xl">info@handyhoney.net</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
