import { SlideLayout } from "../SlideLayout";
import { Shield, Heart, TrendingUp, Clock } from "lucide-react";

export function OurPromiseSlide() {
  const promises = [
    { icon: Shield, title: "Your Property, Our Priority", description: "We protect your investment like it's our own" },
    { icon: Heart, title: "Genuine Partnership", description: "Your success is our success" },
    { icon: TrendingUp, title: "Maximize Returns", description: "Committed to growing your investment" },
    { icon: Clock, title: "True Passive Income", description: "Giving you back your freedom" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12 lg:mb-16">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">Our Commitment</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8">
            Our Promise{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              to You
            </span>
          </h2>
        </div>

        {/* Main Quote */}
        <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 border border-amber-400/30 rounded-3xl p-10 lg:p-14 mb-12 lg:mb-16">
          <p className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-white font-light leading-relaxed italic">
            "We treat every property as if it were our own home. Your success is our success."
          </p>
        </div>

        {/* Promise Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {promises.map((promise, index) => (
            <div
              key={promise.title}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-white/10 hover:border-amber-400/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <promise.icon className="w-12 h-12 lg:w-14 lg:h-14 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">{promise.title}</h3>
              <p className="text-white/50 text-base lg:text-lg">{promise.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom emphasis */}
        <div className="mt-12">
          <p className="text-white/60 text-xl lg:text-2xl">
            We don't just manage properties — we build lasting partnerships.
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
