import { SlideLayout } from "../SlideLayout";
import atlantaSkyline from "@/assets/presentation/atlanta-skyline-hero.jpg";
import ingoHeadshot from "@/assets/presentation/ingo-headshot.jpg";
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react";

export function ClosingSlide() {
  return (
    <SlideLayout backgroundImage={atlantaSkyline} overlay="gradient">
      <div className="text-center max-w-7xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-lg lg:text-xl mb-6">Let's Begin</p>
        <h2 className="text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-white mb-8">
          Ready to <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Maximize</span> Your Property?
        </h2>
        <p className="text-2xl md:text-3xl lg:text-4xl text-white/70 mb-12 lg:mb-16">Let's build your path to passive income together.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12 lg:mb-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border border-white/20 hover:border-amber-400/30 transition-all group">
            <Phone className="w-14 h-14 lg:w-16 lg:h-16 text-amber-400 mx-auto mb-4" />
            <p className="text-white/50 text-lg lg:text-xl mb-2">Call or Text</p>
            <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">(770) 932-4450</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border border-white/20 hover:border-amber-400/30 transition-all group">
            <Mail className="w-14 h-14 lg:w-16 lg:h-16 text-amber-400 mx-auto mb-4" />
            <p className="text-white/50 text-lg lg:text-xl mb-2">Email</p>
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">ingo@peachhausgroup.com</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border border-white/20 hover:border-amber-400/30 transition-all group">
            <MapPin className="w-14 h-14 lg:w-16 lg:h-16 text-amber-400 mx-auto mb-4" />
            <p className="text-white/50 text-lg lg:text-xl mb-2">Serving</p>
            <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">Metro Atlanta</p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border border-white/10 mb-12">
          <h3 className="text-white font-bold text-2xl lg:text-3xl mb-8">Your Next Steps</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 lg:gap-8 text-white/70">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-2xl lg:text-3xl">1</div>
              <span className="text-xl lg:text-2xl">Schedule Property Visit</span>
            </div>
            <ArrowRight className="hidden md:block w-10 h-10 text-white/30" />
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-2xl lg:text-3xl">2</div>
              <span className="text-xl lg:text-2xl">Review Custom Proposal</span>
            </div>
            <ArrowRight className="hidden md:block w-10 h-10 text-white/30" />
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-2xl lg:text-3xl">3</div>
              <span className="text-xl lg:text-2xl">Go Live in 7 Days!</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-10 lg:gap-12">
          <img 
            src={ingoHeadshot} 
            alt="Ingo Schaer" 
            className="w-24 h-24 lg:w-28 lg:h-28 rounded-full object-cover border-2 border-amber-400/50"
          />
          <img 
            src="https://www.peachhausgroup.com/lovable-uploads/ac75dc97-704f-4604-940b-b9c460d497fa.png" 
            alt="Anja Schaer" 
            className="w-24 h-24 lg:w-28 lg:h-28 rounded-full object-cover border-2 border-orange-400/50"
          />
        </div>
        <p className="text-white/60 text-xl lg:text-2xl mt-6">Ingo & Anja Schaer • PeachHaus Group</p>
      </div>
    </SlideLayout>
  );
}
