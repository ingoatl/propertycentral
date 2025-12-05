import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, ExternalLink, CheckCircle, Gift, Star, Heart, Home } from "lucide-react";
import anjaIngoPhoto from "@/assets/anja-ingo-hosts.jpg";
import anjaSignature from "@/assets/anja-signature.png";

const GOOGLE_REVIEW_LINK = "https://www.google.com/maps/place//data=!4m3!3m2!1s0xde039dc97dc8b59:0xd80c5a441ed9e0bc!12e1?source=g.page.m._&laa=merchant-review-solicitation";

const PublicReview = () => {
  const [copied, setCopied] = useState(false);
  const [propertyName, setPropertyName] = useState("");
  const [guestName, setGuestName] = useState("");
  
  const getReviewTemplate = (propName: string) => {
    const name = propName || "[Property Name]";
    return `I stayed at ${name}, which is managed by Anja and Ingo of PeachHaus Group, for several months, and the experience was outstanding. The home was spotless at move-in, fully equipped, and exactly as described. Everything worked smoothly, which shows how well the property is maintained and managed behind the scenes.

The management from PeachHaus Group was on another level — organized, proactive, and consistently responsive. Any question or small issue was handled quickly and professionally. You can tell they operate with real systems, not guesswork, and that they genuinely care about making long-term guests comfortable.

The neighborhood felt safe and quiet, the WiFi was fast, and the home had everything I needed to live and work comfortably for an extended stay. It genuinely felt like a well-run home rather than a temporary rental.

If you're a traveling professional, relocating to Atlanta, or need reliable mid-term housing, I highly recommend staying at ${name} and working with PeachHaus Group. They made the entire stay smooth, predictable, and stress-free. I would absolutely stay here again.`;
  };

  const [reviewText, setReviewText] = useState(getReviewTemplate(""));

  const handlePropertyNameChange = (value: string) => {
    setPropertyName(value);
    setReviewText(getReviewTemplate(value));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--peach-light))] to-white">
      {/* Header */}
      <div className="bg-gradient-primary py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <Home className="w-12 h-12 text-white mx-auto mb-3" />
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Share Your PeachHaus Experience
          </h1>
          <p className="text-white/90 text-lg">
            We'd love to hear about your stay with us
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
                  Hi There! 👋
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
                  As a small thank you, we'll send you a gift card once you submit your review! Just let us know at info@peachhausgroup.com
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Details */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Your Stay Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guestName">Your Name (optional)</Label>
                <Input
                  id="guestName"
                  placeholder="Enter your name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyName">Property Name</Label>
                <Input
                  id="propertyName"
                  placeholder="e.g., Villa 14, The Peach House"
                  value={propertyName}
                  onChange={(e) => handlePropertyNameChange(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Builder */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Your Review {propertyName && `for ${propertyName}`}
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
              <li>Enter your property name above to personalize the review</li>
              <li>Edit the review to add your personal touch</li>
              <li>Click "Copy Review to Clipboard"</li>
              <li>Click "Open Google Reviews" to go to our page</li>
              <li>Paste your review and submit it on Google</li>
              <li>Email us at info@peachhausgroup.com to claim your $15 gift card!</li>
            </ol>
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

export default PublicReview;
