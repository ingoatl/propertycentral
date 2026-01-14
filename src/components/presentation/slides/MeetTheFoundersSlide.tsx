import { SlideLayout } from "../SlideLayout";

export function MeetTheFoundersSlide() {
  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-6xl mx-auto">
        {/* Section Header */}
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
          Meet Your <span className="text-amber-400">Partners</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          {/* Ingo */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group">
            <div className="flex flex-col items-center text-center">
              <img
                src="https://www.peachhausgroup.com/lovable-uploads/f48b3dd5-8cfd-4ed9-b7bb-5c1fc3e60e1d.png"
                alt="Ingo Schaer"
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-amber-400/30 mb-6 group-hover:border-amber-400 transition-all duration-300"
              />
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Ingo Schaer</h3>
              <p className="text-amber-400 font-medium mb-4">Founder & Automation Expert</p>
              <p className="text-white/60 text-sm md:text-base mb-6 leading-relaxed">
                10 years of entrepreneurship experience. Built and exited multiple businesses, 
                now leading PeachHaus with a focus on scale, systems, and strategic automation.
              </p>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70">
                  📚 Author: "Propertypreneur"
                </div>
                <div className="bg-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70">
                  📚 "Out of State Rentals"
                </div>
              </div>
              <img
                src="/images/ingo-signature.png"
                alt="Ingo's Signature"
                className="h-12 opacity-70"
              />
            </div>
          </div>

          {/* Anja */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-orange-400/30 transition-all duration-300 group">
            <div className="flex flex-col items-center text-center">
              <img
                src="https://www.peachhausgroup.com/lovable-uploads/ac75dc97-704f-4604-940b-b9c460d497fa.png"
                alt="Anja Schaer"
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-orange-400/30 mb-6 group-hover:border-orange-400 transition-all duration-300"
              />
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Anja Schaer</h3>
              <p className="text-orange-400 font-medium mb-4">Co-founder, Licensed GA Broker</p>
              <p className="text-white/60 text-sm md:text-base mb-6 leading-relaxed">
                Licensed Georgia Real Estate Broker, Airbnb coach and hospitality design expert. 
                Grew over $1.5M in STR bookings through design and exceptional guest experiences.
              </p>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70">
                  📚 Author: "The Hybrid Rental Strategy"
                </div>
              </div>
              <img
                src="/images/anja-signature.png"
                alt="Anja's Signature"
                className="h-12 opacity-70"
              />
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
