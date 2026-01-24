import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Volume2, 
  Play, 
  Pause, 
  RefreshCw, 
  Download,
  Headphones,
  Sparkles,
  Loader2,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface MarketingStats {
  social_media?: {
    instagram_posts?: number;
    instagram_stories?: number;
    facebook_posts?: number;
    gmb_posts?: number;
    total_reach?: number;
    total_engagement?: number;
  };
  outreach?: {
    total_companies_contacted?: number;
    emails_sent?: number;
    calls_made?: number;
    hotsheets_distributed?: number;
  };
  executive_summary?: string;
  report_month?: string;
}

interface ListingHealth {
  score?: number;
  status?: string;
}

interface RevenueData {
  thisMonthRevenue?: number;
  lastMonthRevenue?: number;
  occupancyRate?: number;
  upcomingBookings?: number;
  strRevenue?: number;
  mtrRevenue?: number;
}

interface PeachHausData {
  maintenanceCompleted?: number;
  tenantPaymentStatus?: string;
  marketComparison?: {
    avgMonthlyRent?: number;
    positioning?: string;
  };
}

interface AudioPropertySummaryProps {
  propertyName: string;
  ownerName?: string;
  rentalType?: "hybrid" | "mid_term" | "long_term" | string | null;
  marketingStats?: MarketingStats | null;
  listingHealth?: ListingHealth | null;
  revenueData?: RevenueData | null;
  peachHausData?: PeachHausData | null;
}

// Ingo's voice ID from ElevenLabs
const INGO_VOICE_ID = "HXPJDxQ2YWg0wT4IBlof";

export function AudioPropertySummary({ 
  propertyName, 
  ownerName,
  rentalType,
  marketingStats, 
  listingHealth,
  revenueData,
  peachHausData,
}: AudioPropertySummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Get owner's first name for personalized greeting
  const ownerFirstName = ownerName?.split(' ')[0] || "there";

  // Always use previous month for the report
  const previousMonth = subMonths(new Date(), 1);
  const previousMonthName = format(previousMonth, 'MMMM');

  // Compose the summary script based on rental type
  const composeSummaryScript = (): string => {
    const isHybrid = rentalType === "hybrid";
    const isMidTerm = rentalType === "mid_term";

    // Marketing activities totals
    const totalSocialPosts = (marketingStats?.social_media?.instagram_posts || 0) + 
      (marketingStats?.social_media?.instagram_stories || 0) + 
      (marketingStats?.social_media?.facebook_posts || 0) + 
      (marketingStats?.social_media?.gmb_posts || 0);
    
    const callsMade = marketingStats?.outreach?.calls_made || 0;
    const totalReach = marketingStats?.social_media?.total_reach || 0;
    const companiesContacted = marketingStats?.outreach?.total_companies_contacted || 0;
    const maintenanceItems = peachHausData?.maintenanceCompleted || 0;
    const upcomingBookingValue = (revenueData?.upcomingBookings || 0) * 250; // Estimated avg booking value

    // Build personalized script based on rental type
    let script = `Hi ${ownerFirstName}, here's your ${previousMonthName} performance recap for ${propertyName}. `;

    if (isHybrid) {
      // HYBRID PROPERTY SCRIPT - Focus on STR bookings, occupancy, dynamic pricing
      const totalRevenue = revenueData?.thisMonthRevenue || revenueData?.lastMonthRevenue || 0;
      const strRevenue = revenueData?.strRevenue || 0;
      const mtrRevenue = revenueData?.mtrRevenue || 0;
      const occupancy = revenueData?.occupancyRate || 0;

      if (totalRevenue > 0) {
        script += `Last month, your property earned $${totalRevenue.toLocaleString()} in total revenue`;
        if (strRevenue > 0 && mtrRevenue > 0) {
          script += ` — $${strRevenue.toLocaleString()} from short-term bookings and $${mtrRevenue.toLocaleString()} from an extended stay guest`;
        }
        script += `. `;
      }

      if (occupancy > 0) {
        script += `Your occupancy reached ${Math.round(occupancy)}% across the month. `;
      }

      // Marketing activities
      if (totalSocialPosts > 0 || callsMade > 0) {
        script += `On the marketing side, `;
        if (totalSocialPosts > 0 && totalReach > 1000) {
          script += `we made ${totalSocialPosts} social media posts that reached over ${Math.round(totalReach / 1000)} thousand travelers`;
        } else if (totalSocialPosts > 0) {
          script += `we made ${totalSocialPosts} social media posts`;
        }
        if (callsMade > 0 || companiesContacted > 0) {
          const outreachCount = callsMade || companiesContacted;
          script += totalSocialPosts > 0 ? `, and conducted ${outreachCount} outreach calls to corporate housing contacts and insurance adjusters` : `we conducted ${outreachCount} outreach calls to corporate housing contacts and insurance adjusters`;
        }
        script += `. `;
      }

      // Proactive maintenance
      if (maintenanceItems > 0) {
        script += `We also handled ${maintenanceItems} maintenance items proactively, keeping your property guest-ready at all times. `;
      }

      // Forward-looking
      if (revenueData?.upcomingBookings && revenueData.upcomingBookings > 0) {
        script += `Looking ahead, you have ${revenueData.upcomingBookings} confirmed bookings for the next 30 days. `;
      }

    } else if (isMidTerm) {
      // MID-TERM PROPERTY SCRIPT - Focus on tenant stability, property value, relationship building
      // Based on research: owners want to hear about tenant stability, vacancy minimization, 
      // tenant quality, proactive maintenance, market positioning, net income
      
      const monthlyRevenue = revenueData?.thisMonthRevenue || revenueData?.lastMonthRevenue || 0;
      const tenantStatus = peachHausData?.tenantPaymentStatus || "on_time";

      if (monthlyRevenue > 0) {
        script += `Last month, your property generated $${monthlyRevenue.toLocaleString()} in rental income. `;
      }

      // Tenant quality and payment status (key owner concern)
      if (tenantStatus === "on_time") {
        script += `Your current tenant remains in good standing with on-time payments throughout the lease. `;
      } else {
        script += `Your tenant's payment status has been monitored and documented. `;
      }

      // Corporate relationship building (NOT "leads in pipeline")
      if (callsMade > 0 || companiesContacted > 0) {
        const outreachCount = callsMade || companiesContacted;
        script += `On the management side, we conducted ${outreachCount} outreach calls to corporate housing coordinators, insurance adjusters, and relocation specialists — building relationships that create tenant demand for properties like yours. `;
      }

      // Proactive maintenance (property value protection)
      if (maintenanceItems > 0) {
        script += `We also completed ${maintenanceItems} preventive maintenance items, protecting your investment and ensuring long-term property value. `;
      }

      // Market positioning (owners want to know their rate is competitive)
      if (peachHausData?.marketComparison?.avgMonthlyRent) {
        script += `Your property's market positioning remains strong — similar homes in your area are averaging $${peachHausData.marketComparison.avgMonthlyRent.toLocaleString()} monthly, and your rental rate is competitive for the quality you offer. `;
      }

    } else {
      // GENERIC SCRIPT for unspecified rental types
      const revenue = revenueData?.thisMonthRevenue || revenueData?.lastMonthRevenue || 0;
      
      if (revenue > 0) {
        script += `Last month, your property generated $${revenue.toLocaleString()} in rental income. `;
      }

      // Marketing activities
      if (totalSocialPosts > 0 || callsMade > 0) {
        const totalActions = totalSocialPosts + callsMade;
        script += `This month, we ran ${totalActions} marketing actions on your behalf`;
        if (callsMade > 0) {
          script += `, including ${callsMade} calls to corporate housing contacts`;
        }
        script += `. `;
      }

      // Listing health (generic)
      if (listingHealth?.score) {
        const healthDesc = listingHealth.score >= 80 ? "excellent" : 
                          listingHealth.score >= 60 ? "good" : "requires attention";
        script += `Your listing health score is ${listingHealth.score}, which is ${healthDesc}. `;
      }

      // Occupancy
      if (revenueData?.occupancyRate && revenueData.occupancyRate > 0) {
        script += `Your occupancy rate is ${Math.round(revenueData.occupancyRate)}% for the next 30 days. `;
      }
    }

    // Closing - always warm and professional
    script += `Thank you for trusting PeachHaus with your property — we're always working behind the scenes to maximize your returns.`;

    return script;
  };

  const generateAudio = async () => {
    setIsGenerating(true);
    try {
      const script = composeSummaryScript();
      console.log("Generating audio for script:", script.substring(0, 100) + "...");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text: script, 
            voiceId: INGO_VOICE_ID // Using Ingo's voice
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate audio: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // Cleanup old audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
      setGeneratedAt(new Date());
      toast.success("Audio summary generated!");
    } catch (error) {
      console.error("Error generating audio:", error);
      toast.error("Failed to generate audio summary");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(currentProgress);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${propertyName.replace(/\s+/g, '-')}-summary-${format(previousMonth, 'yyyy-MM')}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Audio downloaded");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if we have enough data to generate a meaningful summary
  const hasData = marketingStats || listingHealth || revenueData;

  if (!hasData) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10">
        <CardTitle className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-primary" />
          Listen to Your {previousMonthName} Recap
        </CardTitle>
        <CardDescription>
          AI-narrated monthly summary you can listen to on the go
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {!audioUrl ? (
          // Generate button
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Volume2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-muted-foreground mb-4 text-sm max-w-sm mx-auto">
              Generate an AI-narrated audio summary of your property's {previousMonthName} performance and marketing activity.
            </p>
            <Button 
              onClick={generateAudio} 
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Audio Summary
                </>
              )}
            </Button>
          </div>
        ) : (
          // Audio player
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={generateAudio}
                disabled={isGenerating}
                title="Regenerate"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                size="lg"
                className="w-14 h-14 rounded-full"
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleDownload}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Generated timestamp */}
            {generatedAt && (
              <p className="text-center text-xs text-muted-foreground">
                Generated {format(generatedAt, "MMM d, h:mm a")}
              </p>
            )}

            {/* Hidden audio element */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
