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
      <div className="w-full max-w-6xl mx-auto text-center">
        {/* Header */}
        <div className="mb-10 lg:mb-12">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Ready to{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Transform
            </span>{" "}
            Your Property?
          </h2>
          <p className="text-xl lg:text-2xl text-white/60 max-w-3xl mx-auto">
            Schedule a free consultation to discuss your vision and get a custom proposal.
          </p>
        </div>

        {/* Next Steps */}
        <div className="grid md:grid-cols-3 gap-4 lg:gap-6 mb-10 lg:mb-12">
          {steps.map((item, index) => (
            <div
              key={item.title}
              className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-white/10"
            >
              {/* Step Number */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-white">{item.step}</span>
              </div>
              
              <item.icon className="w-10 h-10 lg:w-12 lg:h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-white/50 text-base">{item.description}</p>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-5 -translate-y-1/2 z-10">
                  <ArrowRight className="w-6 h-6 text-amber-400/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Cards */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-10">
          {/* Ilana Contact */}
          <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 backdrop-blur-sm rounded-3xl p-6 lg:p-8 border border-amber-400/30">
            <img
              src={handyHoneyLogo}
              alt="Handy Honey"
              className="h-16 lg:h-20 mx-auto mb-4"
            />
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Contact Ilana</h3>
            
            <div className="space-y-3">
              <a href="tel:770-312-6723" className="flex items-center justify-center gap-3 text-white/80 hover:text-amber-400 transition-colors text-lg lg:text-xl">
                <Phone className="w-5 h-5 text-amber-400" />
                <span>770-312-6723</span>
              </a>
              <a href="mailto:info@handyhoney.net" className="flex items-center justify-center gap-3 text-white/80 hover:text-amber-400 transition-colors text-lg lg:text-xl">
                <Mail className="w-5 h-5 text-amber-400" />
                <span>info@handyhoney.net</span>
              </a>
              <a href="https://www.handyhoney.net" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 text-white/80 hover:text-amber-400 transition-colors text-lg lg:text-xl">
                <Globe className="w-5 h-5 text-amber-400" />
                <span>handyhoney.net</span>
              </a>
            </div>
          </div>

          {/* PeachHaus Contact */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 lg:p-8 border border-white/10">
            <img
              src="/images/peachhaus-logo.png"
              alt="PeachHaus Group"
              className="h-16 lg:h-20 mx-auto mb-4"
            />
            <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">Or Talk to PeachHaus</h3>
            
            <p className="text-white/60 text-base lg:text-lg mb-4">
              Already working with us? Reach out to your property manager and we'll coordinate everything.
            </p>
            
            <div className="space-y-3">
              <a href="tel:404-991-5076" className="flex items-center justify-center gap-3 text-white/80 hover:text-amber-400 transition-colors text-lg lg:text-xl">
                <Phone className="w-5 h-5 text-amber-400" />
                <span>404-991-5076</span>
              </a>
              <a href="mailto:hello@peachhausgroup.com" className="flex items-center justify-center gap-3 text-white/80 hover:text-amber-400 transition-colors text-lg lg:text-xl">
                <Mail className="w-5 h-5 text-amber-400" />
                <span>hello@peachhausgroup.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Final Tagline */}
        <div className="bg-gradient-to-r from-amber-400/20 via-orange-500/20 to-amber-400/20 rounded-2xl p-6 lg:p-8 border border-amber-400/30">
          <p className="text-2xl md:text-3xl lg:text-4xl text-white font-light italic">
            "Design is not just an expense — it's an <span className="text-amber-400 font-semibold">investment</span> with measurable ROI."
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
