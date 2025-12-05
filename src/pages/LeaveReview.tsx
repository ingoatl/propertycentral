import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, ExternalLink, CheckCircle, Gift, Star, Heart } from "lucide-react";
import anjaIngoPhoto from "@/assets/anja-ingo-hosts.jpg";
import anjaSignature from "@/assets/anja-signature.png";

const GOOGLE_REVIEW_LINK = "https://www.google.com/maps/place//data=!4m3!3m2!1s0xde039dc97dc8b59:0xd80c5a441ed9e0bc!12e1?source=g.page.m._&laa=merchant-review-solicitation";

const LeaveReview = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookingData, setBookingData] = useState<{
    tenantName: string;
    propertyName: string;
    reviewSubmitted: boolean;
  } | null>(null);
  
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (token) {
      loadBookingData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadBookingData = async () => {
    try {
      const { data, error } = await supabase
        .from("mid_term_bookings")
        .select(`
          tenant_name,
          property_id,
          review_submitted,
          properties!inner(name)
        `)
        .eq("review_token", token)
        .single();

      if (error) throw error;

      const propertyName = (data as any).properties?.name || "Your Property";
      
      setBookingData({
        tenantName: data.tenant_name,
        propertyName,
        reviewSubmitted: data.review_submitted || false,
      });

      // Set the review template with property name
      setReviewText(getReviewTemplate(propertyName));
      
      if (data.review_submitted) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Error loading booking data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getReviewTemplate = (propertyName: string) => {
    return `I stayed at ${propertyName}, which is managed by Anja and Ingo of PeachHaus Group, for several months, and the experience was outstanding. The home was spotless at move-in, fully equipped, and exactly as described. Everything worked smoothly, which shows how well the property is maintained and managed behind the scenes.

The management from PeachHaus Group was on another level — organized, proactive, and consistently responsive. Any question or small issue was handled quickly and professionally. You can tell they operate with real systems, not guesswork, and that they genuinely care about making long-term guests comfortable.

The neighborhood felt safe and quiet, the WiFi was fast, and the home had everything I needed to live and work comfortably for an extended stay. It genuinely felt like a well-run home rather than a temporary rental.

If you're a traveling professional, relocating to Atlanta, or need reliable mid-term housing, I highly recommend staying at ${propertyName} and working with PeachHaus Group. They made the entire stay smooth, predictable, and stress-free. I would absolutely stay here again.`;
  };

  const handleCopyReview = async () => {
    try {
      await navigator.clipboard.writeText(reviewText);
      setCopied(true);
      toast.success("Review copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error("Failed to copy. Please select and copy manually.");
    }
  };

  const handleOpenGoogleReviews = () => {
    window.open(GOOGLE_REVIEW_LINK, "_blank");
  };

  const handleMarkSubmitted = async () => {
    if (!token) return;
    
    try {
      setSubmitting(true);
      
      const { error } = await supabase.functions.invoke("mark-review-submitted", {
        body: { token },
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success("Thank you! We'll send your $15 Amazon gift card shortly.");
    } catch (error) {
      console.error("Error marking review submitted:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--peach-light))] to-white">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!token || !bookingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--peach-light))] to-white p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Invalid Link</h1>
            <p className="text-muted-foreground">
              This review link is invalid or has expired. Please contact PeachHaus Group if you need assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--peach-light))] to-white p-4">
        <div className="max-w-2xl mx-auto py-12">
          <Card className="overflow-hidden">
            <div className="bg-gradient-primary p-8 text-center">
              <CheckCircle className="w-16 h-16 text-white mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white">Thank You!</h1>
            </div>
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <p className="text-lg text-muted-foreground">
                Your review means the world to us, {bookingData.tenantName}!
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <Gift className="w-10 h-10 text-green-600 mx-auto mb-3" />
                <p className="text-green-800 font-medium">
                  Your $15 Amazon Gift Card is on its way!
                </p>
                <p className="text-sm text-green-600 mt-2">
                  We'll send it to your email within 24-48 hours.
                </p>
              </div>
              <img 
                src={anjaSignature} 
                alt="Anja's signature" 
                className="h-16 mx-auto opacity-80"
              />
              <p className="text-muted-foreground">
                With heartfelt gratitude,<br />
                <span className="font-semibold">Anja & Ingo</span><br />
                <span className="text-sm">Your Hosts at PeachHaus Group</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--peach-light))] to-white">
      {/* Header */}
      <div className="bg-gradient-primary py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Thank You for Staying With Us!
          </h1>
          <p className="text-white/90 text-lg">
            {bookingData.tenantName}, we loved having you at {bookingData.propertyName}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Host Introduction */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="md:flex">
              <div className="md:w-2/5">
                <img 
                  src={anjaIngoPhoto} 
                  alt="Anja & Ingo, your hosts at PeachHaus Group" 
                  className="w-full h-64 md:h-full object-cover"
                />
              </div>
              <div className="md:w-3/5 p-6 flex flex-col justify-center">
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  Hi {bookingData.tenantName}! 👋
                </h2>
                <p className="text-muted-foreground mb-4">
                  We're <span className="font-semibold text-foreground">Anja & Ingo</span>, and we truly pour our hearts into making every stay at PeachHaus properties feel like home.
                </p>
                <p className="text-muted-foreground">
                  Your comfort and experience mean everything to us. If you have a moment, we would be incredibly grateful if you could share your thoughts with a quick review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Reviews Matter */}
        <Card className="border-primary/20 bg-gradient-to-br from-white to-[hsl(var(--peach-light)/0.3)]">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Why Your Review Matters</h3>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Helps other traveling professionals find great mid-term housing</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Allows us to continue improving our processes and service</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Lets us know we're on the right track in making your stay special</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Gift Card Incentive */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 rounded-full p-3">
                <Gift className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800">
                  Receive a $15 Amazon Gift Card
                </h3>
                <p className="text-green-700">
                  As a small thank you, we'll send you a gift card once you submit your review!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Builder */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Your Review for {bookingData.propertyName}
            </h3>
            <p className="text-sm text-muted-foreground">
              We've drafted a review based on common feedback. Feel free to personalize it to reflect your experience!
            </p>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={12}
              className="text-sm leading-relaxed"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleCopyReview}
                className="gap-2 flex-1"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Review to Clipboard
                  </>
                )}
              </Button>
              <Button
                onClick={handleOpenGoogleReviews}
                className="gap-2 flex-1 bg-gradient-primary hover:opacity-90"
              >
                <ExternalLink className="w-4 h-4" />
                Open Google Reviews
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-muted/30">
          <CardContent className="p-6">
            <h4 className="font-semibold text-foreground mb-3">Quick Steps:</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Edit the review above to add your personal touch</li>
              <li>Click "Copy Review to Clipboard"</li>
              <li>Click "Open Google Reviews" to go to our page</li>
              <li>Paste your review and submit it on Google</li>
              <li>Come back here and click the button below to claim your gift card!</li>
            </ol>
          </CardContent>
        </Card>

        {/* Submit Confirmation */}
        <Card className="border-primary/30">
          <CardContent className="p-6 text-center space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Already Submitted Your Review?
            </h3>
            <p className="text-muted-foreground">
              Click below to let us know and we'll send your $15 Amazon Gift Card!
            </p>
            <Button
              onClick={handleMarkSubmitted}
              disabled={submitting}
              size="lg"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-5 h-5" />
              {submitting ? "Processing..." : "I've Submitted My Review - Claim Gift Card"}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pb-8">
          <img 
            src={anjaSignature} 
            alt="Anja's signature" 
            className="h-14 mx-auto mb-3 opacity-80"
          />
          <p className="text-muted-foreground">
            With warmest gratitude,<br />
            <span className="font-semibold text-foreground">Anja & Ingo</span><br />
            <span className="text-sm">Your Hosts at PeachHaus Group</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeaveReview;
