import { SlideLayout } from "../SlideLayout";
import { HelpCircle } from "lucide-react";

export function DesignerFAQSlide() {
  const faqs = [
    {
      question: "How long does a typical project take?",
      answer: "2-6 weeks depending on scope. Rush timelines available.",
    },
    {
      question: "Do I need to be present during installation?",
      answer: "No. Ilana handles everything and coordinates with PeachHaus.",
    },
    {
      question: "What if I already have furniture?",
      answer: "We can work with existing pieces or recommend replacements.",
    },
    {
      question: "Can I verify these properties myself?",
      answer: "All Airbnb links are live. Book a stay to experience the quality.",
    },
    {
      question: "What's the ROI on staging?",
      answer: "Most owners recoup investment within 6-12 months.",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-center">
        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <p className="text-amber-400 uppercase tracking-widest text-sm lg:text-base mb-2">FAQ</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white">
            Common{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
        </div>

        {/* FAQ Grid - Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 lg:p-5 border border-white/10 hover:border-amber-400/30 transition-all duration-300"
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm lg:text-base font-semibold text-white mb-1 leading-tight">
                    {faq.question}
                  </h3>
                  <p className="text-white/60 text-xs lg:text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-6 lg:mt-8 text-center">
          <p className="text-white/50 text-base lg:text-lg">
            Have more questions? Let's schedule a call!
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
