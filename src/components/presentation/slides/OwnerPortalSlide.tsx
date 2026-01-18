import { SlideLayout } from "../SlideLayout";
import { Monitor, FileText, DollarSign, BarChart3 } from "lucide-react";
import { useEffect, useRef } from "react";

export function OwnerPortalSlide() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Autoplay video when slide is visible
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked by browser, that's okay
      });
    }
  }, []);

  const features = [
    { icon: BarChart3, title: "Real-Time Analytics", description: "Live performance metrics" },
    { icon: DollarSign, title: "Financial Reports", description: "Revenue & expense tracking" },
    { icon: FileText, title: "Monthly Statements", description: "Downloadable reports" },
    { icon: Monitor, title: "24/7 Access", description: "Always available" },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Your Dashboard</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Owner{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Portal
            </span>
          </h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Full transparency at your fingertips. Track your property's performance anytime, anywhere.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Video Section */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black/40">
              <video
                ref={videoRef}
                src="/videos/owner-portal-demo.mp4"
                className="w-full aspect-video object-cover"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            </div>
            <p className="text-white/40 text-center text-sm mt-4">
              See your property's performance in real-time
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-400/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-white/50 text-sm">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* CTA */}
            <div className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 border border-amber-400/30 rounded-xl p-5 mt-6">
              <p className="text-white/80 text-sm leading-relaxed">
                Every owner gets full access to their personalized dashboard from day one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
