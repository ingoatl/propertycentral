import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  DollarSign, 
  Shield, 
  TrendingUp,
  MessageSquare,
  Wrench,
  Calendar,
  CheckCircle,
  Sparkles,
  PiggyBank,
  FileCheck,
  CalendarCheck,
} from "lucide-react";

interface ValueMetrics {
  // Time saved
  guestCommunicationsHandled?: number;
  maintenanceIssuesCoordinated?: number;
  bookingInquiriesManaged?: number;
  
  // Revenue protected/recovered
  gapNightsFilled?: number;
  gapNightsValue?: number;
  dynamicPricingAdjustments?: number;
  dynamicPricingValue?: number;
  
  // Compliance & Risk
  licenseRenewed?: boolean;
  insuranceVerified?: boolean;
  taxDocumentsPrepared?: boolean;
  
  // Booking stats
  totalBookings?: number;
  repeatGuestBookings?: number;
  directBookings?: number;
}

interface OwnerValueRealizedProps {
  metrics: ValueMetrics;
  propertyName: string;
}

export function OwnerValueRealized({ metrics, propertyName }: OwnerValueRealizedProps) {
  // Calculate estimated time saved (conservative estimates)
  const communicationsTime = (metrics.guestCommunicationsHandled || 0) * 0.25; // 15 min per communication
  const maintenanceTime = (metrics.maintenanceIssuesCoordinated || 0) * 1.5; // 90 min per issue
  const inquiriesTime = (metrics.bookingInquiriesManaged || 0) * 0.3; // 18 min per inquiry
  const totalHoursSaved = communicationsTime + maintenanceTime + inquiriesTime;
  
  // Calculate revenue impact
  const gapNightsValue = metrics.gapNightsValue || (metrics.gapNightsFilled || 0) * 189;
  const pricingValue = metrics.dynamicPricingValue || (metrics.dynamicPricingAdjustments || 0) * 45;
  const totalRevenueImpact = gapNightsValue + pricingValue;

  // Calculate what management fee effectively "costs" vs value delivered
  const estimatedHourlyRate = 75; // Owner's time value estimate
  const valueOfTimeSaved = totalHoursSaved * estimatedHourlyRate;
  const totalValueDelivered = valueOfTimeSaved + totalRevenueImpact;

  const hasData = totalHoursSaved > 0 || totalRevenueImpact > 0;

  if (!hasData) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Value Realized This Month
            </CardTitle>
            <CardDescription>
              Tangible benefits from professional property management
            </CardDescription>
          </div>
          {totalValueDelivered > 0 && (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-3 py-1">
              ${totalValueDelivered.toLocaleString()} Value
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Time Saved */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-4 w-4" />
              Time Saved
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {totalHoursSaved.toFixed(1)} hrs
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Estimated at ${estimatedHourlyRate}/hr = ${valueOfTimeSaved.toLocaleString()}
              </p>
              <div className="space-y-2 text-sm">
                {(metrics.guestCommunicationsHandled || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      Guest messages
                    </span>
                    <span className="font-medium">{metrics.guestCommunicationsHandled}</span>
                  </div>
                )}
                {(metrics.maintenanceIssuesCoordinated || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-orange-500" />
                      Maintenance issues
                    </span>
                    <span className="font-medium">{metrics.maintenanceIssuesCoordinated}</span>
                  </div>
                )}
                {(metrics.bookingInquiriesManaged || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-purple-500" />
                      Booking inquiries
                    </span>
                    <span className="font-medium">{metrics.bookingInquiriesManaged}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Revenue Protected */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <PiggyBank className="h-4 w-4" />
              Revenue Protected
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl">
              <div className="text-3xl font-bold text-emerald-600 mb-1">
                ${totalRevenueImpact.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Revenue recovered or optimized
              </p>
              <div className="space-y-2 text-sm">
                {(metrics.gapNightsFilled || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                      Gap nights filled
                    </span>
                    <span className="font-medium text-emerald-600">
                      +${gapNightsValue.toLocaleString()}
                    </span>
                  </div>
                )}
                {(metrics.dynamicPricingAdjustments || 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                      Pricing optimizations
                    </span>
                    <span className="font-medium text-blue-600">
                      +${pricingValue.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compliance & Risk */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <Shield className="h-4 w-4" />
              Compliance & Risk
            </div>
            <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-xl">
              <div className="text-3xl font-bold text-violet-600 mb-1">
                Protected
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Staying compliant avoids fines & liability
              </p>
              <div className="space-y-2 text-sm">
                {metrics.licenseRenewed && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>License renewed</span>
                    <Badge variant="outline" className="text-xs ml-auto">
                      $500+ saved
                    </Badge>
                  </div>
                )}
                {metrics.insuranceVerified && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Insurance verified</span>
                  </div>
                )}
                {metrics.taxDocumentsPrepared && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Tax docs ready</span>
                  </div>
                )}
                {!metrics.licenseRenewed && !metrics.insuranceVerified && !metrics.taxDocumentsPrepared && (
                  <div className="text-muted-foreground text-xs">
                    All compliance items up to date. You're protected from regulatory fines and liability issues.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ROI Summary */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Total Value This Month</p>
                <p className="text-xs text-muted-foreground">
                  Time saved + revenue protected + risk avoided
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                ${totalValueDelivered.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">in tangible value</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
