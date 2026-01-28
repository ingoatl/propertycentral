import { SlideLayout } from "../SlideLayout";
import atlantaSkyline from "@/assets/presentation/atlanta-skyline-hero.jpg";
import ingoHeadshot from "@/assets/presentation/ingo-headshot.jpg";
import { Phone, Mail, MapPin, ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClosingSlide() {
  return (
    <SlideLayout backgroundImage={atlantaSkyline} overlay="gradient">
      <div className="text-center max-w-6xl mx-auto px-4 py-6 overflow-y-auto max-h-screen">
        <p className="text-amber-400 uppercase tracking-widest text-sm md:text-base mb-3">Let's Begin</p>
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
          Ready to <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Maximize</span> Your Property?
        </h2>
        <p className="text-lg md:text-xl lg:text-2xl text-white/70 mb-6">Let's build your path to passive income together.</p>
        
        {/* CTA Button */}
        <Button
          size="lg"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8 py-6 text-lg mb-8 shadow-xl"
          onClick={() => window.open("/book-discovery-call", "_blank")}
        >
          <Calendar className="mr-2 h-5 w-5" />
          Schedule Discovery Call
        </Button>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:border-amber-400/30 transition-all">
            <Phone className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-white/50 text-sm mb-1">Call or Text</p>
            <a href="tel:+14048005932" className="text-xl md:text-2xl font-bold text-white hover:text-amber-400 transition-colors">
              (404) 800-5932
            </a>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:border-amber-400/30 transition-all">
            <Mail className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-white/50 text-sm mb-1">Email</p>
            <a href="mailto:info@peachhausgroup.com" className="text-lg md:text-xl font-bold text-white hover:text-amber-400 transition-colors">
              info@peachhausgroup.com
            </a>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:border-amber-400/30 transition-all">
            <MapPin className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <p className="text-white/50 text-sm mb-1">Serving</p>
            <p className="text-xl md:text-2xl font-bold text-white">Metro Atlanta</p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 mb-6">
          <h3 className="text-white font-bold text-lg md:text-xl mb-4">In Your Next Steps</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-white/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-lg">1</div>
              <span className="text-base">Schedule a Discovery Call</span>
            </div>
            <ArrowRight className="hidden md:block w-6 h-6 text-white/30" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-lg">2</div>
              <span className="text-base">Review & Sign Management Agreement</span>
            </div>
            <ArrowRight className="hidden md:block w-6 h-6 text-white/30" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-lg">3</div>
              <span className="text-base">Property Setup & Go Live</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <img 
            src={ingoHeadshot} 
            alt="Ingo Schaer" 
            className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-amber-400/50"
          />
          <img 
            src="https://www.peachhausgroup.com/lovable-uploads/ac75dc97-704f-4604-940b-b9c460d497fa.png" 
            alt="Anja Schaer" 
            className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-orange-400/50"
          />
        </div>
        <p className="text-white/60 text-base md:text-lg mt-4 pb-20">Ingo & Anja Schaer • PeachHaus Group</p>
      </div>
    </SlideLayout>
  );
}
