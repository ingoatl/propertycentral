import { SlideLayout } from "../SlideLayout";
import { Shield, Heart, Target, Handshake } from "lucide-react";

export function OurPromiseSlide() {
  const promises = [
    {
      icon: Shield,
      title: "Full Transparency",
      description: "Real-time access to bookings, revenue, and expenses. No hidden fees, ever."
    },
    {
      icon: Heart,
      title: "Your Property, Our Priority",
      description: "We treat every home as if it were our own. Your investment deserves nothing less."
    },
    {
      icon: Target,
      title: "Results-Driven",
      description: "Our success is measured by your returns. We're only satisfied when you are."
    },
    {
      icon: Handshake,
      title: "Partnership, Not Just Service",
      description: "We're invested in your long-term wealth, not just short-term bookings."
    }
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Our Commitment to You</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Our{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Promise
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed">
            "We treat every property as if it were our own home. Your success is our success."
          </p>
        </div>

        {/* Promise Cards */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {promises.map((promise, index) => (
            <div
              key={promise.title}
              className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <promise.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{promise.title}</h3>
                  <p className="text-white/60 text-base md:text-lg leading-relaxed">{promise.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Emphasis */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-amber-400/10 border border-amber-400/30 rounded-full px-8 py-4">
            <p className="text-amber-400 text-lg md:text-xl font-semibold">
              🤝 Your Freedom is Our Mission
            </p>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
