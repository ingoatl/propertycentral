import { SlideLayout } from "../SlideLayout";
import { Star, Home, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

function AnimatedCounter({ end, duration = 2000, prefix = "", suffix = "" }: { 
  end: number; 
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return (
    <span>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

export function ByTheNumbersSlide() {
  const stats = [
    { 
      icon: Star, 
      value: 1400, 
      suffix: "+", 
      label: "Five-Star Reviews",
      color: "from-amber-400 to-yellow-500"
    },
    { 
      icon: Home, 
      value: 50, 
      suffix: "+", 
      label: "Properties Managed",
      color: "from-green-400 to-emerald-500"
    },
    { 
      icon: TrendingUp, 
      value: 98, 
      suffix: "%", 
      label: "Client Satisfaction",
      color: "from-blue-400 to-cyan-500"
    },
    { 
      icon: Clock, 
      value: 30, 
      prefix: "<", 
      suffix: " min", 
      label: "Response Time",
      color: "from-purple-400 to-pink-500"
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-amber-400 uppercase tracking-widest text-sm mb-4">Our Track Record</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
            Results That{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Speak
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="relative group"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 text-center h-full">
                {/* Icon */}
                <div className={`w-16 h-16 mx-auto mb-6 rounded-xl bg-gradient-to-br ${stat.color} p-4`}>
                  <stat.icon className="w-full h-full text-white" />
                </div>

                {/* Value */}
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  <AnimatedCounter 
                    end={stat.value} 
                    prefix={stat.prefix} 
                    suffix={stat.suffix} 
                    duration={2000} 
                  />
                </div>

                {/* Label */}
                <p className="text-white/60 text-sm md:text-base">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-white/40 text-sm mt-8">
          Results may vary. Performance metrics represent data from current clients.
        </p>
      </div>
    </SlideLayout>
  );
}
