import { SlideLayout } from "../SlideLayout";
import { AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export function ProblemSolutionSlide() {
  const problems = [
    "Vacant nights eating into profits",
    "Difficult tenants and late payments",
    "Pricing guesswork leaving money on the table",
    "Time drain from constant management tasks",
    "No access to premium corporate tenants",
  ];

  const solutions = [
    "Maximize occupancy with 3 flexible strategies",
    "Premium tenant network (corporate & insurance)",
    "AI-powered dynamic pricing optimization",
    "Full-service hands-off management",
    "Direct relationships with Fortune 500 companies",
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            The <span className="text-red-400">Problem</span> We{" "}
            <span className="text-green-400">Solve</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-16">
          {/* Problems */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white">Common Pain Points</h3>
            </div>
            {problems.map((problem, index) => (
              <div
                key={index}
                className="flex items-start gap-4 bg-red-500/10 rounded-xl p-4 border border-red-500/20"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-6 h-6 rounded-full bg-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-400 text-sm font-bold">✕</span>
                </div>
                <p className="text-white/80">{problem}</p>
              </div>
            ))}
          </div>

          {/* Arrow in center for desktop */}
          <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2">
            <ArrowRight className="w-12 h-12 text-amber-400" />
          </div>

          {/* Solutions */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white">The PeachHaus Solution</h3>
            </div>
            {solutions.map((solution, index) => (
              <div
                key={index}
                className="flex items-start gap-4 bg-green-500/10 rounded-xl p-4 border border-green-500/20"
                style={{ animationDelay: `${index * 100 + 500}ms` }}
              >
                <div className="w-6 h-6 rounded-full bg-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-white/80">{solution}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
