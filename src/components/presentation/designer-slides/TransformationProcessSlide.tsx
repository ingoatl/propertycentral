import { SlideLayout } from "../SlideLayout";
import { MessageSquare, FileText, ShoppingBag, Wrench, Camera } from "lucide-react";

export function TransformationProcessSlide() {
  const steps = [
    {
      icon: MessageSquare,
      number: "01",
      title: "Consultation",
      description: "Property walkthrough and vision discussion",
    },
    {
      icon: FileText,
      number: "02",
      title: "Design Plan",
      description: "Custom proposal with budget options",
    },
    {
      icon: ShoppingBag,
      number: "03",
      title: "Sourcing",
      description: "Furniture, decor, and finishing touches",
    },
    {
      icon: Wrench,
      number: "04",
      title: "Installation",
      description: "Professional setup and styling",
    },
    {
      icon: Camera,
      number: "05",
      title: "Photography",
      description: "Ready for professional photos",
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto text-center">
        {/* Header */}
        <div className="mb-10 lg:mb-14">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">The Process</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white">
            From <span className="text-amber-400">Ordinary</span> to{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Extraordinary
            </span>
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent -translate-y-1/2 z-0" />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6 relative z-10">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-white/10 hover:border-amber-400/50 hover:bg-white/10 transition-all duration-300 group"
              >
                {/* Number Badge */}
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-lg lg:text-xl font-bold text-white">{step.number}</span>
                </div>

                {/* Icon */}
                <step.icon className="w-10 h-10 lg:w-12 lg:h-12 text-amber-400 mx-auto mb-4" />

                {/* Title */}
                <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">{step.title}</h3>

                {/* Description */}
                <p className="text-white/50 text-sm lg:text-base">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Note */}
        <div className="mt-10 lg:mt-12">
          <p className="text-white/60 text-lg lg:text-xl">
            Average timeline: <span className="text-amber-400 font-semibold">2-6 weeks</span> depending on scope
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
