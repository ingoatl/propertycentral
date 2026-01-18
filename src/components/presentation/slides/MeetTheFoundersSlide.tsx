import { SlideLayout } from "../SlideLayout";
import { BookOpen } from "lucide-react";
import ingoHeadshot from "@/assets/presentation/ingo-headshot.jpg";

export function MeetTheFoundersSlide() {
  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        {/* Section Header */}
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white mb-12">
          Meet Your <span className="text-amber-400">Partners</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          {/* Ingo */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-10 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group">
            <div className="flex flex-col items-center text-center">
              <img
                src={ingoHeadshot}
                alt="Ingo Schaer"
                className="w-44 h-44 md:w-56 md:h-56 rounded-full object-cover border-4 border-amber-400/30 mb-6 group-hover:border-amber-400 transition-all duration-300 shadow-2xl"
              />
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-2">Ingo Schaer</h3>
              <p className="text-amber-400 font-semibold text-lg mb-4">Founder & Automation Expert</p>
              <p className="text-white/60 text-base md:text-lg mb-6 leading-relaxed max-w-md">
                10 years of entrepreneurship experience. Built and exited multiple businesses, 
                now leading PeachHaus with a focus on scale, systems, and strategic automation.
              </p>
              
              {/* Published Author Badge */}
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-semibold text-sm uppercase tracking-wider">Published Author</span>
              </div>
              
              {/* Book Covers */}
              <div className="flex gap-4">
                <div className="relative group/book">
                  <img
                    src="/books/propertypreneur-book.png"
                    alt="Propertypreneur Book"
                    className="w-24 h-32 md:w-28 md:h-36 object-cover rounded-lg shadow-xl border border-white/20 group-hover/book:scale-105 transition-transform"
                  />
                  <p className="text-white/50 text-xs mt-2 text-center">"Propertypreneur"</p>
                </div>
                <div className="relative group/book">
                  <img
                    src="/books/out-of-state-rentals-book.png"
                    alt="Out of State Rentals Book"
                    className="w-24 h-32 md:w-28 md:h-36 object-cover rounded-lg shadow-xl border border-white/20 group-hover/book:scale-105 transition-transform"
                  />
                  <p className="text-white/50 text-xs mt-2 text-center">"Out of State Rentals"</p>
                </div>
              </div>
            </div>
          </div>

          {/* Anja */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-10 border border-white/10 hover:border-orange-400/30 transition-all duration-300 group">
            <div className="flex flex-col items-center text-center">
              <img
                src="https://www.peachhausgroup.com/lovable-uploads/ac75dc97-704f-4604-940b-b9c460d497fa.png"
                alt="Anja Schaer"
                className="w-44 h-44 md:w-56 md:h-56 rounded-full object-cover border-4 border-orange-400/30 mb-6 group-hover:border-orange-400 transition-all duration-300 shadow-2xl"
              />
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-2">Anja Schaer</h3>
              <p className="text-orange-400 font-semibold text-lg mb-4">Co-founder, Licensed GA Broker</p>
              <p className="text-white/60 text-base md:text-lg mb-6 leading-relaxed max-w-md">
                Licensed Georgia Real Estate Broker, Airbnb coach and hospitality design expert. 
                Grew over $1.5M in STR bookings through design and exceptional guest experiences.
              </p>
              
              {/* Published Author Badge */}
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 font-semibold text-sm uppercase tracking-wider">Published Author</span>
              </div>
              
              {/* Book Cover */}
              <div className="flex gap-4 justify-center">
                <div className="relative group/book">
                  <img
                    src="/books/hybrid-rental-strategy-book.png"
                    alt="The Hybrid Rental Strategy Book"
                    className="w-24 h-32 md:w-28 md:h-36 object-cover rounded-lg shadow-xl border border-white/20 group-hover/book:scale-105 transition-transform"
                  />
                  <p className="text-white/50 text-xs mt-2 text-center">"Hybrid Rental Strategy"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
