import { SlideLayout } from "../SlideLayout";
import { TrendingUp } from "lucide-react";

export function RevenueComparisonSlide() {
  const data = [
    { strategy: "Long-Term", monthly: 2100, color: "bg-slate-500", percentage: 0 },
    { strategy: "Mid-Term", monthly: 3400, color: "bg-blue-500", percentage: 62 },
    { strategy: "Hybrid", monthly: 4800, color: "bg-gradient-to-r from-amber-400 to-orange-500", percentage: 128 },
  ];

  const maxValue = Math.max(...data.map(d => d.monthly));

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-12 lg:mb-14">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">The Numbers Don't Lie</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4">
            Revenue <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Comparison</span>
          </h2>
          <p className="text-xl lg:text-2xl text-white/60">Same property. Different strategies. Dramatic results.</p>
        </div>

        {/* Chart */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-12 border border-white/10">
          <div className="space-y-8 lg:space-y-10">
            {data.map((item, index) => (
              <div key={item.strategy} className="space-y-3" style={{ animationDelay: `${index * 200}ms` }}>
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold text-xl lg:text-2xl">{item.strategy}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                      ${item.monthly.toLocaleString()}<span className="text-white/50 text-xl lg:text-2xl">/mo</span>
                    </span>
                    {item.percentage > 0 && (
                      <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-base lg:text-lg font-medium">
                        <TrendingUp className="w-5 h-5" />
                        +{item.percentage}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-14 lg:h-20 bg-white/10 rounded-xl overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-xl transition-all duration-1000 ease-out flex items-center justify-end pr-6`}
                    style={{ width: `${(item.monthly / maxValue) * 100}%` }}
                  >
                    {item.strategy === "Hybrid" && (
                      <span className="text-white font-bold text-base lg:text-xl">RECOMMENDED</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-10 lg:mt-12 pt-8 border-t border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-white/40 text-base lg:text-lg">Annual Revenue (LTR)</p>
                <p className="text-3xl lg:text-4xl font-bold text-white">$25,200</p>
              </div>
              <div>
                <p className="text-white/40 text-base lg:text-lg">Annual Revenue (MTR)</p>
                <p className="text-3xl lg:text-4xl font-bold text-blue-400">$40,800</p>
              </div>
              <div>
                <p className="text-white/40 text-base lg:text-lg">Annual Revenue (Hybrid)</p>
                <p className="text-3xl lg:text-4xl font-bold text-amber-400">$57,600</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-white/40 text-base lg:text-lg mt-8">
          * Example based on a 3BR property in Metro Atlanta. Actual results may vary.
        </p>
      </div>
    </SlideLayout>
  );
}
