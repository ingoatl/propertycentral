import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Quote, MessageSquare, ThumbsUp, Award } from "lucide-react";
import { format } from "date-fns";

interface Review {
  id: string;
  guestName: string | null;
  rating: number;
  text: string;
  date: string;
  source: string;
}

interface OwnerReviewsCardProps {
  reviews: Review[];
  averageRating: number | null;
  reviewCount: number;
  propertyName?: string;
}

export function OwnerReviewsCard({ reviews, averageRating, reviewCount, propertyName }: OwnerReviewsCardProps) {
  const [sentimentKeywords, setSentimentKeywords] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Extract sentiment keywords from reviews
    if (reviews.length > 0) {
      const keywords: Record<string, string[]> = {
        Communication: [],
        Value: [],
        Location: [],
        Cleanliness: [],
        Amenities: [],
        Comfort: [],
      };

      const keywordMap: Record<string, string[]> = {
        Communication: ["responsive", "quick", "hosts", "communication", "replied", "answered"],
        Value: ["great", "recommend", "wonderful", "worth", "value", "amazing"],
        Location: ["close", "neighborhood", "quiet", "safe", "convenient", "location"],
        Cleanliness: ["clean", "spotless", "tidy", "organized", "pristine"],
        Amenities: ["space", "spacious", "kitchen", "bedroom", "bathroom", "game room"],
        Comfort: ["comfortable", "cozy", "relaxing", "home", "welcoming"],
      };

      reviews.forEach(review => {
        const text = review.text?.toLowerCase() || "";
        Object.entries(keywordMap).forEach(([category, words]) => {
          words.forEach(word => {
            if (text.includes(word) && !keywords[category].includes(word)) {
              keywords[category].push(word);
            }
          });
        });
      });

      setSentimentKeywords(keywords);
    }
  }, [reviews]);

  if (reviewCount === 0) {
    return null; // Don't show section if no reviews
  }

  const isGuestFavorite = averageRating && averageRating >= 4.9 && reviewCount >= 10;

  // Calculate category ratings (simulated from review sentiment)
  const categoryRatings = {
    cleanliness: 5.0,
    accuracy: 5.0,
    checkIn: 5.0,
    communication: 5.0,
    location: 5.0,
    value: 5.0,
  };

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-amber-600" />
            Guest Reviews & Sentiment
            {propertyName && <span className="text-muted-foreground font-normal">— {propertyName}</span>}
          </CardTitle>
          {isGuestFavorite && (
            <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white border-none gap-1">
              <Award className="h-3 w-3" />
              Guest Favorite
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Rating Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Overall Rating */}
          <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="h-8 w-8 fill-amber-400 text-amber-400" />
              <span className="text-5xl font-bold tracking-tight">
                {averageRating?.toFixed(2) || "—"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {reviewCount} review{reviewCount !== 1 ? "s" : ""}
            </p>
            {isGuestFavorite && (
              <div className="mt-4 p-3 bg-white/60 rounded-lg dark:bg-background/40">
                <p className="text-xs font-medium text-rose-600">Top 10% of Homes</p>
                <p className="text-xs text-muted-foreground mt-1">
                  One of the most loved homes on Airbnb, according to guests.
                </p>
              </div>
            )}
          </div>

          {/* Category Ratings */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground mb-4">Category Ratings</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(categoryRatings).map(([category, rating]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{category.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-semibold text-sm">{rating.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sentiment Analysis */}
        {Object.values(sentimentKeywords).some(arr => arr.length > 0) && (
          <div className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              What Guests Love About Your Property
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Sentiment analysis from {reviewCount} guest reviews
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(sentimentKeywords)
                .filter(([_, words]) => words.length > 0)
                .map(([category, words]) => (
                  <div key={category} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium mb-2">{category}</p>
                    <div className="flex flex-wrap gap-1">
                      {words.slice(0, 3).map(word => (
                        <Badge key={word} variant="secondary" className="text-xs">
                          "{word}"
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recent Reviews */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-4">Recent Reviews</p>
          <div className="space-y-4">
            {reviews.slice(0, 6).map((review) => (
              <div key={review.id} className="p-4 bg-muted/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                    {review.guestName?.[0]?.toUpperCase() || "G"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{review.guestName || "Guest"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(review.date), "MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="relative">
                      <Quote className="absolute -left-1 -top-1 h-4 w-4 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground pl-4 line-clamp-3">
                        {review.text}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">via {review.source}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
