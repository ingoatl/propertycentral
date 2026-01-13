import { SlideLayout } from "../SlideLayout";
import atlantaSkyline from "@/assets/presentation/atlanta-skyline-hero.jpg";
import { Phone, Mail, MapPin, ArrowRight } from "lucide-react";

export function ClosingSlide() {
  return (
    <SlideLayout backgroundImage={atlantaSkyline} overlay="gradient">
      <div className="text-center max-w-4xl mx-auto">
        <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Let's Begin</p>
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Ready to <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Maximize</span> Your Property?
        </h2>
        <p className="text-xl text-white/70 mb-10">Let's build your path to passive income together.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-amber-400/30 transition-all group">
            <Phone className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Call or Text</p>
            <p className="text-xl font-bold text-white">(770) 932-4450</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-amber-400/30 transition-all group">
            <Mail className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Email</p>
            <p className="text-lg font-bold text-white">ingo@peachhausgroup.com</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-amber-400/30 transition-all group">
            <MapPin className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Serving</p>
            <p className="text-lg font-bold text-white">Metro Atlanta</p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-10">
          <h3 className="text-white font-semibold mb-4">Your Next Steps</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-white/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold">1</div>
              <span>Schedule Property Visit</span>
            </div>
            <ArrowRight className="hidden md:block w-5 h-5 text-white/30" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold">2</div>
              <span>Review Custom Proposal</span>
            </div>
            <ArrowRight className="hidden md:block w-5 h-5 text-white/30" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 font-bold">3</div>
              <span>Go Live in 7 Days!</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8">
          <img src="/images/ingo-signature.png" alt="Ingo" className="h-16 opacity-80" />
          <img src="/images/anja-signature.png" alt="Anja" className="h-16 opacity-80" />
        </div>
        <p className="text-white/50 mt-4">Ingo & Anja Schaer • PeachHaus Group</p>
      </div>
    </SlideLayout>
  );
}
