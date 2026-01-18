import { SlideLayout } from "../SlideLayout";
import { Quote, Star } from "lucide-react";

export function TestimonialSlide() {
  const testimonials = [
    {
      quote: "PeachHaus increased our rental income by 78% in the first 6 months. Their corporate network is unmatched.",
      author: "Sarah M.",
      property: "4BR in Buckhead",
      rating: 5,
    },
    {
      quote: "Finally, a property manager who actually responds! The hybrid strategy was a game-changer for us.",
      author: "Michael T.",
      property: "Townhome in Smyrna",
      rating: 5,
    },
    {
      quote: "We went from vacant nights eating profits to 95% occupancy. Best decision we ever made.",
      author: "Jennifer & David K.",
      property: "3BR in Roswell",
      rating: 5,
    },
  ];

  return (
    <SlideLayout overlay="gradient">
      <div className="w-full max-w-7xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <p className="text-amber-400 uppercase tracking-widest text-base lg:text-lg mb-4">What Owners Say</p>
          <h2 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white mb-6">
            Real <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Results</span>
          </h2>
          <p className="text-xl md:text-2xl lg:text-3xl text-white/60">From property owners just like you</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-8 lg:p-10 border border-white/10 hover:border-amber-400/30 transition-all duration-300 group relative"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 left-8">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Quote className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-6 mt-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 lg:w-6 lg:h-6 text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-white/90 text-lg lg:text-xl xl:text-2xl leading-relaxed mb-8 italic">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="border-t border-white/10 pt-6">
                <p className="text-white font-bold text-lg lg:text-xl">{testimonial.author}</p>
                <p className="text-amber-400 text-base lg:text-lg">{testimonial.property}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-12 lg:mt-16 text-center">
          <div className="inline-flex items-center gap-8 lg:gap-12 bg-white/5 backdrop-blur-sm rounded-full px-8 lg:px-12 py-4 lg:py-6 border border-white/10">
            <div className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-amber-400">1,400+</p>
              <p className="text-white/50 text-sm lg:text-base">5-Star Reviews</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-amber-400">98%</p>
              <p className="text-white/50 text-sm lg:text-base">Client Retention</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-3xl lg:text-4xl font-bold text-amber-400">4.9</p>
              <p className="text-white/50 text-sm lg:text-base">Avg Rating</p>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
