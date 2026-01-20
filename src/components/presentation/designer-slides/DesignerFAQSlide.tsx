import { SlideLayout } from "../SlideLayout";
import { HelpCircle } from "lucide-react";

export function DesignerFAQSlide() {
  const faqs = [
    {
      question: "How long does a typical project take?",
      answer: "2-6 weeks depending on scope and furniture availability. Rush timelines available for an additional fee.",
    },
    {
      question: "Do I need to be present during installation?",
      answer: "No. Ilana handles everything and coordinates directly with PeachHaus for property access.",
    },
    {
      question: "What if I already have furniture?",
      answer: "We can work with existing pieces or recommend what to keep vs. replace for maximum impact.",
    },
    {
      question: "Can I verify these properties myself?",
      answer: "Absolutely! All Airbnb links are live. Book a stay and experience the quality firsthand.",
    },
    {
      question: "What's the ROI on staging?",
      answer: "Most owners see their investment recouped within 6-12 months through higher nightly rates and occupancy.",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 lg:mb-12">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">FAQ</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white">
            Common{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
        </div>

        {/* FAQ Grid */}
        <div className="grid md:grid-cols-2 gap-4 lg:gap-6">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 lg:p-7 border border-white/10 hover:border-amber-400/30 transition-all duration-300"
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg lg:text-xl font-semibold text-white mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-white/60 text-base lg:text-lg leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 lg:mt-12 text-center">
          <p className="text-white/50 text-lg lg:text-xl">
            Have more questions? Let's schedule a call!
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
