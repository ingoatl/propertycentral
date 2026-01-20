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
      <div className="w-full max-w-7xl mx-auto h-full flex flex-col justify-center px-4 lg:px-8 overflow-hidden">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3">
            Ready to{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Transform
            </span>{" "}
            Your Property?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-white/60 max-w-3xl mx-auto">
            Schedule a free consultation to discuss your vision and get a custom proposal.
          </p>
        </div>

        {/* Next Steps */}
        <div className="grid grid-cols-3 gap-3 lg:gap-6 mb-6 lg:mb-8">
          {steps.map((item, index) => (
            <div
              key={item.title}
              className="relative bg-white/5 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-white/10 text-center"
            >
              {/* Step Number */}
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-3">
                <span className="text-base lg:text-xl font-bold text-white">{item.step}</span>
              </div>
              
              <item.icon className="w-7 h-7 lg:w-10 lg:h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-white/50 text-xs sm:text-sm lg:text-base">{item.description}</p>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5 text-amber-400/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Ilana Contact */}
          <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-5 lg:p-8 border border-amber-400/30">
            <img
              src={handyHoneyLogo}
              alt="Handy Honey"
              className="h-12 lg:h-16 mx-auto mb-3 lg:mb-4"
            />
            <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 text-center">Contact Ilana</h3>
            
            <div className="space-y-2 lg:space-y-3">
              <a href="tel:770-312-6723" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-base lg:text-lg">
                <Phone className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>770-312-6723</span>
              </a>
              <a href="mailto:info@handyhoney.net" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-base lg:text-lg">
                <Mail className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>info@handyhoney.net</span>
              </a>
              <a href="https://www.handyhoney.net" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-base lg:text-lg">
                <Globe className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>handyhoney.net</span>
              </a>
            </div>
          </div>

          {/* PeachHaus Contact */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 lg:p-8 border border-white/10">
            <img
              src="/images/peachhaus-logo.png"
              alt="PeachHaus Group"
              className="h-12 lg:h-16 mx-auto mb-3 lg:mb-4"
            />
            <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 text-center">Or Talk to PeachHaus</h3>
            
            <p className="text-white/60 text-sm lg:text-base mb-3 lg:mb-4 text-center">
              Already working with us? We'll coordinate everything.
            </p>
            
            <div className="space-y-2 lg:space-y-3">
              <a href="tel:404-800-5932" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-base lg:text-lg">
                <Phone className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>(404) 800-5932</span>
              </a>
              <a href="mailto:info@peachhausgroup.com" className="flex items-center justify-center gap-2 text-white/80 hover:text-amber-400 transition-colors text-base lg:text-lg">
                <Mail className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span>info@peachhausgroup.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Final Tagline */}
        <div className="bg-gradient-to-r from-amber-400/20 via-orange-500/20 to-amber-400/20 rounded-xl p-5 lg:p-6 border border-amber-400/30">
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-white font-light italic text-center">
            "Design is not just an expense — it's an <span className="text-amber-400 font-semibold">investment</span> with measurable ROI."
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
