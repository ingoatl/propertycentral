import { SlideLayout } from "../SlideLayout";
import luxuryInterior from "@/assets/presentation/luxury-interior.jpg";
import { Lightbulb, Award, Heart, Zap } from "lucide-react";

export function MissionSlide() {
  const values = [
    { icon: Lightbulb, title: "Automation", desc: "Leverage technology to maximize efficiency" },
    { icon: Award, title: "Excellence", desc: "Exceptional results in every aspect" },
    { icon: Heart, title: "Integrity", desc: "Transparency in all relationships" },
    { icon: Zap, title: "Hospitality", desc: "Welcoming experiences for all" },
  ];

  return (
    <SlideLayout backgroundImage={luxuryInterior} overlay="gradient">
      <div className="w-full max-w-5xl mx-auto text-center">
        {/* Mission Statement */}
        <div className="mb-16">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Our Mission</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight">
            Your property should work{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              as hard as you do
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed">
            "We build property portfolios that generate freedom — not headaches."
          </p>
        </div>

        {/* Core Values */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {values.map((value, index) => (
            <div
              key={value.title}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-amber-400/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <value.icon className="w-10 h-10 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
              <p className="text-white/50 text-sm">{value.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
