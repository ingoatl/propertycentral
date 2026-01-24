import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
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
import { format } from "date-fns";
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
}

interface AudioPropertySummaryProps {
  propertyName: string;
  marketingStats?: MarketingStats | null;
  listingHealth?: ListingHealth | null;
  revenueData?: RevenueData | null;
}

export function AudioPropertySummary({ 
  propertyName, 
  marketingStats, 
  listingHealth,
  revenueData 
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

  // Compose the summary script from available data
  const composeSummaryScript = (): string => {
    const currentMonth = marketingStats?.report_month 
      ? format(new Date(marketingStats.report_month + '-01'), 'MMMM')
      : format(new Date(), 'MMMM');

    let script = `Here's your ${currentMonth} property report for ${propertyName}. `;

    // Marketing activities
    const totalSocial = (marketingStats?.social_media?.instagram_posts || 0) + 
      (marketingStats?.social_media?.instagram_stories || 0) + 
      (marketingStats?.social_media?.facebook_posts || 0) + 
      (marketingStats?.social_media?.gmb_posts || 0);
    
    const totalOutreach = (marketingStats?.outreach?.emails_sent || 0) + 
      (marketingStats?.outreach?.calls_made || 0);

    if (totalSocial > 0 || totalOutreach > 0) {
      script += `This month, we ran ${totalSocial + totalOutreach} marketing actions on your behalf`;
      
      if (marketingStats?.outreach?.calls_made && marketingStats.outreach.calls_made > 0) {
        script += `, including ${marketingStats.outreach.calls_made} calls to corporate housing contacts`;
      }
      if (totalSocial > 0) {
        const reach = marketingStats?.social_media?.total_reach;
        if (reach && reach > 1000) {
          script += `. Our social media posts reached over ${Math.round(reach / 1000)} thousand potential guests`;
        }
      }
      script += `. `;
    }

    // Listing health
    if (listingHealth?.score) {
      const healthDesc = listingHealth.score >= 80 ? "excellent" : 
                        listingHealth.score >= 60 ? "good" : "needs attention";
      script += `Your listing health score is ${listingHealth.score}, which is ${healthDesc}. `;
    }

    // Revenue (if available)
    if (revenueData?.thisMonthRevenue && revenueData.thisMonthRevenue > 0) {
      script += `You've earned $${revenueData.thisMonthRevenue.toLocaleString()} so far this month. `;
    }

    // Occupancy
    if (revenueData?.occupancyRate && revenueData.occupancyRate > 0) {
      script += `Your occupancy rate is ${Math.round(revenueData.occupancyRate)}% for the next 30 days. `;
    }

    // Executive summary if available
    if (marketingStats?.executive_summary) {
      script += marketingStats.executive_summary;
    }

    script += ` Thank you for trusting PeachHaus with your property.`;

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
            voiceId: "onwK4e9ZLuTAKqWW03F9" // Daniel - warm, professional male voice
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
    link.download = `${propertyName.replace(/\s+/g, '-')}-summary-${format(new Date(), 'yyyy-MM')}.mp3`;
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
          Listen to Your Property Report
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
              Generate an AI-narrated audio summary of your property's marketing performance and listing health.
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
