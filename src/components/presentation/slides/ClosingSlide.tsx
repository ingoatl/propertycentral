import { SlideLayout } from "../SlideLayout";
import atlantaSkyline from "@/assets/presentation/atlanta-skyline-hero.jpg";

export function ClosingSlide() {
  return (
    <SlideLayout backgroundImage={atlantaSkyline} overlay="gradient">
      <div className="text-center max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Ready to <span className="text-amber-400">Maximize</span> Your Property?
        </h2>
        <p className="text-xl text-white/70 mb-10">Let's build your path to passive income together.</p>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-12">
          <div className="bg-white/10 rounded-xl p-6 border border-white/20">
            <p className="text-white/50 text-sm">Call or Text</p>
            <p className="text-2xl font-bold text-white">(770) Enzo-4450</p>
          </div>
          <div className="bg-white/10 rounded-xl p-6 border border-white/20">
            <p className="text-white/50 text-sm">Email</p>
            <p className="text-xl font-bold text-white">ingo@peachhausgroup.com</p>
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
