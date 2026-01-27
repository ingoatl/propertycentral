import { useState, useRef, useEffect, useMemo } from "react";
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
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore } from "date-fns";
import { Progress } from "@/components/ui/progress";

// Helper to convert number to spoken words for ElevenLabs TTS
// ElevenLabs best practice: spell out numbers fully in words for correct pronunciation
function numberToWords(num: number): string {
  if (num === 0) return "zero";
  
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
                "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", 
                "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  
  function convertHundreds(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const one = n % 10;
      return tens[ten] + (one ? " " + ones[one] : "");
    }
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    return ones[hundred] + " hundred" + (remainder ? " " + convertHundreds(remainder) : "");
  }
  
  if (num < 0) return "negative " + numberToWords(Math.abs(num));
  
  const rounded = Math.round(num);
  
  if (rounded >= 1000000) {
    const millions = Math.floor(rounded / 1000000);
    const remainder = rounded % 1000000;
    return numberToWords(millions) + " million" + (remainder ? " " + numberToWords(remainder) : "");
  }
  
  if (rounded >= 1000) {
    const thousands = Math.floor(rounded / 1000);
    const remainder = rounded % 1000;
    return numberToWords(thousands) + " thousand" + (remainder ? " " + numberToWords(remainder) : "");
  }
  
  return convertHundreds(rounded);
}

// Format currency for TTS - spells out amounts in words
function formatCurrencyForTTS(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return "zero dollars";
  return numberToWords(rounded) + " dollars";
}

// Format percentage for TTS
function formatPercentForTTS(percent: number): string {
  const rounded = Math.round(percent);
  return numberToWords(rounded) + " percent";
}

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
  averageRating?: number;
  reviewCount?: number;
  strBookings?: number;
  mtrBookings?: number;
}

interface PropertyDetails {
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  maxGuests?: number;
  amenities?: string[];
  address?: string;
}

interface PeachHausData {
  maintenanceCompleted?: number;
  tenantPaymentStatus?: string;
  marketComparison?: {
    avgMonthlyRent?: number;
    positioning?: string;
  };
  guestCommunicationsHandled?: number;
  dynamicPricingAdjustments?: number;
  dynamicPricingValue?: number;
}

interface AudioPropertySummaryProps {
  propertyName: string;
  ownerName?: string;
  secondOwnerName?: string | null;
  rentalType?: "hybrid" | "mid_term" | "long_term" | string | null;
  marketingStats?: MarketingStats | null;
  listingHealth?: ListingHealth | null;
  revenueData?: RevenueData | null;
  peachHausData?: PeachHausData | null;
  propertyDetails?: PropertyDetails | null;
  // NEW: Onboarding and booking status props
  hasBookings?: boolean;
  onboardingStage?: string | null;
  listedSince?: Date | string | null;
}

// Using Sarah's voice - popular, natural-sounding female voice from ElevenLabs
// Sarah: EXAVITQu4vr4xnSDxMaL - One of the most popular ElevenLabs voices
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

// Onboarding steps mapping - matches OwnerOnboardingTimeline.tsx
const ONBOARDING_STEPS = [
  { key: 'payment', label: 'Payment Setup' },
  { key: 'onboarding_form', label: 'Onboarding Form' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'photos', label: 'Photos & Tour' },
  { key: 'onboarded', label: 'Go Live' },
];

// Map onboarding stages to step indices
function getOnboardingStepIndex(stage: string | null): number {
  switch(stage) {
    case 'new_lead':
    case 'contacted':
    case 'discovery_call_scheduled':
    case 'discovery_call_completed':
    case 'proposal_sent':
    case 'contract_out':
    case 'contract_signed': 
      return 0; // Payment Setup
    case 'ach_form_signed': 
    case 'onboarding_form_requested': 
      return 1; // Onboarding Form
    case 'insurance_requested': 
      return 2; // Insurance
    case 'inspection_scheduled': 
      return 3; // Inspection
    case 'photos_walkthrough':
      return 4; // Photos & Tour
    case 'ops_handoff': 
      return 6; // Complete
    default: 
      return 0;
  }
}

export function AudioPropertySummary({ 
  propertyName, 
  ownerName,
  secondOwnerName,
  rentalType,
  marketingStats, 
  listingHealth,
  revenueData,
  peachHausData,
  propertyDetails,
  hasBookings,
  onboardingStage,
  listedSince,
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

  // Get owner's first name(s) for personalized greeting - handles 2 owners
  const ownerFirstName = useMemo(() => {
    const firstName1 = ownerName?.split(' ')[0] || "there";
    const firstName2 = secondOwnerName?.split(' ')[0];
    
    if (firstName2 && firstName2 !== firstName1) {
      return `${firstName1} and ${firstName2}`;
    }
    return firstName1;
  }, [ownerName, secondOwnerName]);

  // Always use previous month for the report - dynamically updates when month changes
  const previousMonth = subMonths(new Date(), 1);
  const previousMonthName = format(previousMonth, 'MMMM');

  // Helper to compose onboarding-in-progress script
  const composeOnboardingScript = (stage: string): string => {
    const stepIndex = getOnboardingStepIndex(stage);
    const completedSteps = ONBOARDING_STEPS.slice(0, stepIndex).map(s => s.label);
    const currentStep = ONBOARDING_STEPS[stepIndex]?.label || 'Getting started';
    const isHybrid = rentalType === "hybrid";
    
    let script = `Hi ${ownerFirstName}, welcome to PeachHaus! We're excited to be partnering with you on ${propertyName}. `;
    
    // Acknowledge completed steps
    if (completedSteps.length > 0) {
      if (completedSteps.length === 1) {
        script += `Your ${completedSteps[0].toLowerCase()} is complete — great start! `;
      } else {
        const lastStep = completedSteps.pop();
        script += `You've already completed ${completedSteps.join(', ').toLowerCase()}, and ${lastStep?.toLowerCase()} — you're making excellent progress! `;
      }
    }
    
    // Current step guidance
    switch(stepIndex) {
      case 0: // Payment Setup
        script += `We're currently setting up your payment processing. Once that's complete, we'll move on to gathering important details about your property. `;
        break;
      case 1: // Onboarding Form
        script += `To keep momentum going, please complete your onboarding form when you get a chance. This helps us set up your listing with all the right details about your property — amenities, house rules, and what makes your place special. `;
        break;
      case 2: // Insurance
        script += `Please submit your insurance documentation when you have a moment. This is an important step that protects both you and your future guests. `;
        break;
      case 3: // Inspection
        script += `We're scheduling your property inspection — this is where we document your property's condition and ensure everything is guest-ready. We'll coordinate a convenient time with you. `;
        break;
      case 4: // Photos & Tour
        script += `We're arranging your professional photo shoot and virtual tour. Quality photos are crucial — listings with professional photography see up to 40% more bookings. `;
        break;
      default:
        script += `We're finalizing the last details to get your property live. `;
    }
    
    // Marketing activities already happening
    const callsMade = marketingStats?.outreach?.calls_made || 0;
    const companiesContacted = marketingStats?.outreach?.total_companies_contacted || 0;
    const outreachCount = callsMade || companiesContacted;
    
    if (isHybrid) {
      script += `In the meantime, our marketing team is already building your property's digital presence. We've begun drafting your listing copy and identifying the best platforms to showcase your home. `;
      if (outreachCount > 0) {
        script += `We've also made ${outreachCount} outreach calls to corporate housing coordinators and insurance adjusters, building relationships for quality bookings. `;
      }
    } else {
      script += `Our team is already reaching out to corporate housing coordinators, insurance adjusters, and relocation specialists in your area, building the relationships that lead to quality, long-term tenants. `;
      if (outreachCount > 0) {
        script += `So far, we've contacted ${outreachCount} companies to start generating interest. `;
      }
    }
    
    // Remaining steps
    const remainingCount = ONBOARDING_STEPS.length - stepIndex - 1;
    if (remainingCount > 0) {
      script += `After ${currentStep.toLowerCase()}, `;
      if (remainingCount === 1) {
        script += `there's just one more step before you go live and start earning. `;
      } else {
        script += `there are ${remainingCount} more steps before we go live — we'll guide you through each one. `;
      }
    }
    
    script += `Thank you for trusting PeachHaus. We're here to make this process smooth and get you earning as quickly as possible.`;
    
    return script;
  };
  
  // Helper to compose no-bookings script (fully onboarded but no reservations yet)
  const composeNoBookingsScript = (): string => {
    const isHybrid = rentalType === "hybrid";
    const isMidTerm = rentalType === "mid_term";
    
    const callsMade = marketingStats?.outreach?.calls_made || 0;
    const companiesContacted = marketingStats?.outreach?.total_companies_contacted || 0;
    const outreachCount = callsMade || companiesContacted;
    const totalSocialPosts = (marketingStats?.social_media?.instagram_posts || 0) + 
      (marketingStats?.social_media?.instagram_stories || 0) + 
      (marketingStats?.social_media?.facebook_posts || 0) + 
      (marketingStats?.social_media?.gmb_posts || 0);
    const totalReach = marketingStats?.social_media?.total_reach || 0;
    const listingScore = listingHealth?.score || 0;
    const avgMonthlyRent = peachHausData?.marketComparison?.avgMonthlyRent;
    
    let script = `Hi ${ownerFirstName}, here's your update for ${propertyName}. `;
    
    if (isHybrid) {
      // HYBRID - No Bookings Yet Script
      script += `Your property is now live and our marketing machine is in full gear. `;
      
      // Social media activity
      if (totalSocialPosts > 0) {
        if (totalReach > 1000) {
          script += `This month, we've posted ${totalSocialPosts} times across social media, reaching over ${Math.round(totalReach / 1000)} thousand potential guests. `;
        } else {
          script += `This month, we've made ${totalSocialPosts} social media posts to promote your property. `;
        }
      }
      
      // Outreach activity
      if (outreachCount > 0) {
        script += `We've also made ${outreachCount} outreach calls to corporate housing coordinators and insurance adjusters to build mid-term booking opportunities. `;
      }
      
      // Set expectations for new listings
      script += `New listings on Airbnb and VRBO typically take 30 to 60 days to gain full visibility in search results. We're using this time strategically — optimizing your listing, adjusting pricing for competitiveness, and running targeted promotions to attract your first guests. `;
      
      // Listing health
      if (listingScore > 0) {
        script += `Your listing health score is ${listingScore}, which means we're well positioned. `;
      }
      
      script += `We're working every day to line up your first reservation. `;
      
    } else if (isMidTerm) {
      // MID-TERM - No Bookings Yet Script
      script += `Your property is market-ready and we're actively working to place your first quality tenant. `;
      
      // Outreach activity
      if (outreachCount > 0) {
        script += `This month, we've contacted ${outreachCount} corporate housing companies, insurance adjusters, and relocation specialists. These relationships take time to develop, but they lead to reliable, longer-term tenants who treat your property with care. `;
      } else {
        script += `We're reaching out to corporate housing companies, insurance adjusters, and relocation specialists to find quality tenants. These relationships take time to develop, but they lead to reliable tenants who treat your property with care. `;
      }
      
      // Market context
      if (avgMonthlyRent) {
        script += `We're monitoring the local market to ensure your rental rate is competitive while maximizing your returns. Properties like yours in the area are averaging around ${formatCurrencyForTTS(avgMonthlyRent)} monthly. `;
      }
      
      // Set expectations
      script += `Mid-term placements often take a few weeks to finalize, but once we secure a tenant, you'll enjoy consistent monthly income with fewer turnovers. `;
      
    } else {
      // GENERIC - No Bookings Yet Script
      script += `Your property is live and we're actively marketing to potential guests. `;
      
      if (totalSocialPosts > 0 || outreachCount > 0) {
        script += `This month, we've run ${totalSocialPosts + outreachCount} marketing activities on your behalf. `;
      }
      
      script += `New listings typically take a few weeks to gain traction in search results. We're optimizing your listing and building visibility to attract your first booking soon. `;
    }
    
    script += `Thank you for your trust in PeachHaus. We're committed to getting your property earning and will be in touch as soon as that first booking comes through.`;
    
    return script;
  };

  // Compose the summary script based on rental type - ENHANCED with property-specific info
  const composeSummaryScript = (): string => {
    // Determine which script to use based on onboarding status and bookings
    const isOnboarding = onboardingStage && 
      onboardingStage !== 'ops_handoff' && 
      getOnboardingStepIndex(onboardingStage) < 6;
    
    const propertyHasNoBookings = hasBookings === false;
    
    // Priority 1: Onboarding in progress
    if (isOnboarding && onboardingStage) {
      return composeOnboardingScript(onboardingStage);
    }
    
    // Priority 2: Fully onboarded but no bookings yet
    if (propertyHasNoBookings) {
      return composeNoBookingsScript();
    }
    
    // Priority 3: Standard performance recap (existing logic)
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
    const guestComms = peachHausData?.guestCommunicationsHandled || 0;

    // Build personalized script based on rental type
    let script = `Hi ${ownerFirstName}, here's your ${previousMonthName} performance recap for ${propertyName}. `;

    if (isHybrid) {
      // HYBRID PROPERTY SCRIPT - Focus on STR bookings, occupancy, dynamic pricing, reviews
      const totalRevenue = revenueData?.lastMonthRevenue || revenueData?.thisMonthRevenue || 0;
      const strRevenue = revenueData?.strRevenue || 0;
      const mtrRevenue = revenueData?.mtrRevenue || 0;
      const occupancy = revenueData?.occupancyRate || 0;
      const avgRating = revenueData?.averageRating || 0;
      const reviewCount = revenueData?.reviewCount || 0;
      const strBookings = revenueData?.strBookings || 0;

      // Revenue breakdown - using spelled-out numbers for correct TTS pronunciation
      if (totalRevenue > 0) {
        script += `Last month, your property earned ${formatCurrencyForTTS(totalRevenue)} in total revenue`;
        if (strRevenue > 0 && mtrRevenue > 0) {
          script += ` — ${formatCurrencyForTTS(strRevenue)} from short-term bookings and ${formatCurrencyForTTS(mtrRevenue)} from an extended stay guest`;
        }
        script += `. `;
      }

      // Occupancy and bookings - using spelled-out numbers for TTS
      if (occupancy > 0) {
        script += `Your occupancy reached ${formatPercentForTTS(occupancy)} across the month`;
        if (strBookings > 0) {
          script += ` with ${numberToWords(strBookings)} completed short-term stays`;
        }
        script += `. `;
      }

      // Guest reviews and ratings - property owners love hearing about this
      if (avgRating && avgRating > 0) {
        script += `Your guests love your property — you're averaging ${avgRating.toFixed(1)} stars`;
        if (reviewCount > 0) {
          script += ` across ${reviewCount} reviews`;
        }
        script += `. `;
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

      // Guest communications handled
      if (guestComms > 0) {
        script += `We handled ${guestComms} guest communications on your behalf. `;
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
      // Research-backed: owners want to hear about stability, not sales pipeline
      
      const monthlyRevenue = revenueData?.lastMonthRevenue || revenueData?.thisMonthRevenue || 0;
      const tenantStatus = peachHausData?.tenantPaymentStatus || "on_time";

      // Monthly rental income
      if (monthlyRevenue > 0) {
        script += `Last month, your property generated ${formatCurrencyForTTS(monthlyRevenue)} in rental income. `;
      }

      // Tenant quality and payment status (key owner concern per research)
      if (tenantStatus === "on_time") {
        script += `Your current tenant remains in excellent standing with consistent on-time payments throughout the lease. `;
      } else if (tenantStatus === "monitoring") {
        script += `We're monitoring your tenant's payment pattern and will keep you informed. `;
      } else {
        script += `Your tenant's payment status has been documented and we're managing the situation. `;
      }

      // Corporate relationship building (NOT "leads in pipeline" per user request)
      if (callsMade > 0 || companiesContacted > 0) {
        const outreachCount = callsMade || companiesContacted;
        script += `On the management side, we conducted ${outreachCount} outreach calls to corporate housing coordinators, insurance adjusters, and relocation specialists — building relationships that create ongoing tenant demand for properties like yours. `;
      }

      // Proactive maintenance (property value protection - key MTR owner concern)
      if (maintenanceItems > 0) {
        script += `We also completed ${maintenanceItems} preventive maintenance items, protecting your investment and ensuring long-term property value. `;
      }

      // Market positioning (owners want to know their rate is competitive)
      if (peachHausData?.marketComparison?.avgMonthlyRent) {
        script += `Your property's market positioning remains strong — similar homes in your area are averaging ${formatCurrencyForTTS(peachHausData.marketComparison.avgMonthlyRent)} monthly, and your rental rate is competitive for the quality you offer. `;
      }

    } else {
      // GENERIC SCRIPT for unspecified rental types
      const revenue = revenueData?.lastMonthRevenue || revenueData?.thisMonthRevenue || 0;
      const avgRating = revenueData?.averageRating || 0;
      const reviewCount = revenueData?.reviewCount || 0;
      
      if (revenue > 0) {
        script += `Last month, your property generated ${formatCurrencyForTTS(revenue)} in rental income. `;
      }

      // Reviews
      if (avgRating && avgRating > 0) {
        script += `Your property is rated ${avgRating.toFixed(1)} stars`;
        if (reviewCount > 0) {
          script += ` with ${reviewCount} guest reviews`;
        }
        script += `. `;
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

      // Maintenance
      if (maintenanceItems > 0) {
        script += `We handled ${maintenanceItems} maintenance items to keep your property in top condition. `;
      }

      // Occupancy
      if (revenueData?.occupancyRate && revenueData.occupancyRate > 0) {
        script += `Your occupancy rate is ${formatPercentForTTS(revenueData.occupancyRate)} for the next thirty days. `;
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
            voiceId: VOICE_ID // Using Sarah's popular voice
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
          Listen to Your Last Month's Recap
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
