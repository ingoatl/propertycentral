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
      <div className="w-full max-w-5xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Our Commitment</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8">
            Our Promise{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              to You
            </span>
          </h2>
        </div>

        {/* Main Quote */}
        <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 border border-amber-400/30 rounded-3xl p-8 md:p-12 mb-12">
          <p className="text-2xl md:text-3xl lg:text-4xl text-white font-light leading-relaxed italic">
            "We treat every property as if it were our own home. Your success is our success, and we're committed to maximizing your investment while giving you back the freedom of truly passive income."
          </p>
        </div>

        {/* Promise Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {promises.map((promise, index) => (
            <div
              key={promise.title}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-amber-400/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <promise.icon className="w-10 h-10 text-amber-400 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-white mb-2">{promise.title}</h3>
              <p className="text-white/50 text-sm">{promise.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom emphasis */}
        <div className="mt-12">
          <p className="text-white/60 text-lg">
            We don't just manage properties — we build lasting partnerships.
          </p>
        </div>
      </div>
    </SlideLayout>
  );
}
