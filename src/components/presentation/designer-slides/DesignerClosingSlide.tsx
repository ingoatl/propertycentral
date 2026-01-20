import { SlideLayout } from "../SlideLayout";
import { Phone, Mail, Globe, ArrowRight, Calendar, FileText, Sparkles } from "lucide-react";
import handyHoneyLogo from "@/assets/designer/handy-honey-logo-web.png";

export function DesignerClosingSlide() {
  const steps = [
    { icon: Calendar, step: "1", title: "Schedule Property Walk", description: "Free consultation" },
    { icon: FileText, step: "2", title: "Review Design Proposal", description: "Custom plan & budget" },
    { icon: Sparkles, step: "3", title: "Transform & Launch", description: "Watch it come to life" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-center overflow-hidden">
        {/* Header - Compact */}
        <div className="text-center mb-4 lg:mb-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
            Ready to{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Transform
            </span>{" "}
            Your Property?
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-white/60 max-w-2xl mx-auto">
            Schedule a free consultation to discuss your vision and get a custom proposal.
          </p>
        </div>

        {/* Next Steps - Compact */}
        <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-4 lg:mb-6">
          {steps.map((item, index) => (
            <div
              key={item.title}
              className="relative bg-white/5 backdrop-blur-sm rounded-xl p-3 lg:p-5 border border-white/10 text-center"
            >
              {/* Step Number */}
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-2">
                <span className="text-sm lg:text-lg font-bold text-white">{item.step}</span>
              </div>
              
              <item.icon className="w-6 h-6 lg:w-8 lg:h-8 text-amber-400 mx-auto mb-2" />
              <h3 className="text-xs sm:text-sm lg:text-base font-semibold text-white mb-1 leading-tight">{item.title}</h3>
              <p className="text-white/50 text-[10px] sm:text-xs lg:text-sm hidden sm:block">{item.description}</p>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                  <ArrowRight className="w-4 h-4 text-amber-400/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Cards - Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-4 lg:mb-6">
          {/* Ilana Contact */}
          <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-amber-400/30">
            <img
              src={handyHoneyLogo}
              alt="Handy Honey"
              className="h-10 lg:h-14 mx-auto mb-2 lg:mb-3"
            />
            <h3 className="text-lg lg:text-xl font-bold text-white mb-2 text-center">Contact Ilana</h3>
            
            <div className="space-y-1.5 lg:space-y-2">
              <a href="tel:770-312-6723" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-sm lg:text-base">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>770-312-6723</span>
              </a>
              <a href="mailto:info@handyhoney.net" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-sm lg:text-base">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>info@handyhoney.net</span>
              </a>
              <a href="https://www.handyhoney.net" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-sm lg:text-base">
                <Globe className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>handyhoney.net</span>
              </a>
            </div>
          </div>

          {/* PeachHaus Contact */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 lg:p-6 border border-white/10">
            <img
              src="/images/peachhaus-logo.png"
              alt="PeachHaus Group"
              className="h-10 lg:h-14 mx-auto mb-2 lg:mb-3"
            />
            <h3 className="text-lg lg:text-xl font-bold text-white mb-2 text-center">Or Talk to PeachHaus</h3>
            
            <p className="text-white/60 text-xs lg:text-sm mb-2 lg:mb-3 text-center">
              Already working with us? We'll coordinate everything.
            </p>
            
            <div className="space-y-1.5 lg:space-y-2">
              <a href="tel:404-800-5932" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-sm lg:text-base">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>(404) 800-5932</span>
              </a>
              <a href="mailto:info@peachhausgroup.com" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-sm lg:text-base">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>info@peachhausgroup.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Final Tagline - Compact */}
        <div className="bg-gradient-to-r from-amber-400/20 via-orange-500/20 to-amber-400/20 rounded-xl p-4 lg:p-5 border border-amber-400/30">
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white font-light italic text-center">
            "Design is not just an expense — it's an <span className="text-amber-400 font-semibold">investment</span> with measurable ROI."
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
