import { SlideLayout } from "../SlideLayout";
import { BookOpen } from "lucide-react";
import ingoHeadshot from "@/assets/presentation/ingo-headshot.jpg";

export function MeetTheFoundersSlide() {
  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        {/* Section Header */}
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-center text-white mb-12 lg:mb-16">
          Meet Your <span className="text-amber-400">Partners</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Ingo */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 lg:p-10 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group">
            <div className="flex flex-col items-center text-center">
              <img
                src={ingoHeadshot}
                alt="Ingo Schaer"
                className="w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full object-cover border-4 border-amber-400/30 mb-6 group-hover:border-amber-400 transition-all duration-300 shadow-2xl"
              />
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">Ingo Schaer</h3>
              <p className="text-amber-400 font-semibold text-xl lg:text-2xl mb-4">Founder & Automation Expert</p>
              <p className="text-white/60 text-lg lg:text-xl mb-6 leading-relaxed max-w-lg">
                10 years of entrepreneurship experience. Built and exited multiple businesses, 
                now leading PeachHaus with a focus on scale, systems, and strategic automation.
              </p>
              
              {/* Published Author Badge */}
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-6 h-6 text-amber-400" />
                <span className="text-amber-400 font-semibold text-base lg:text-lg uppercase tracking-wider">Published Author</span>
              </div>
              
              {/* Book Covers */}
              <div className="flex gap-4">
                <div className="relative group/book">
                  <img
                    src="/books/propertypreneur-book.png"
                    alt="Propertypreneur Book"
                    className="w-20 h-28 md:w-24 md:h-32 lg:w-28 lg:h-36 object-cover rounded-lg shadow-xl border border-white/20 group-hover/book:scale-105 transition-transform"
                  />
                </div>
                <div className="relative group/book">
                  <img
                    src="/books/out-of-state-rentals-book.png"
                    alt="Out of State Rentals Book"
                    className="w-20 h-28 md:w-24 md:h-32 lg:w-28 lg:h-36 object-cover rounded-lg shadow-xl border border-white/20 group-hover/book:scale-105 transition-transform"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Anja */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 lg:p-10 border border-white/10 hover:border-orange-400/30 transition-all duration-300 group">
            <div className="flex flex-col items-center text-center">
              <img
                src="https://www.peachhausgroup.com/lovable-uploads/ac75dc97-704f-4604-940b-b9c460d497fa.png"
                alt="Anja Schaer"
                className="w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full object-cover border-4 border-orange-400/30 mb-6 group-hover:border-orange-400 transition-all duration-300 shadow-2xl"
              />
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">Anja Schaer</h3>
              <p className="text-orange-400 font-semibold text-xl lg:text-2xl mb-4">Co-founder, Licensed GA Broker</p>
              <p className="text-white/60 text-lg lg:text-xl mb-6 leading-relaxed max-w-lg">
                Licensed Georgia Real Estate Broker, Airbnb coach and hospitality design expert. 
                Grew over $1.5M in STR bookings through design and exceptional guest experiences.
              </p>
              
              {/* Published Author Badge */}
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-6 h-6 text-orange-400" />
                <span className="text-orange-400 font-semibold text-base lg:text-lg uppercase tracking-wider">Published Author</span>
              </div>
              
              {/* Book Cover */}
              <div className="flex gap-4 justify-center">
                <div className="relative group/book">
                  <img
                    src="/books/hybrid-rental-strategy-book.png"
                    alt="The Hybrid Rental Strategy Book"
                    className="w-20 h-28 md:w-24 md:h-32 lg:w-28 lg:h-36 object-cover rounded-lg shadow-xl border border-white/20 group-hover/book:scale-105 transition-transform"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
