import { Building2, Star, Phone, RefreshCw, LogOut, Menu, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  propertyName?: string;
  ownerName?: string;
  secondOwnerName?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  hasPropertyImage?: boolean;
  onScheduleCall: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  isRefreshing: boolean;
}

export function MobileHeader({
  propertyName,
  ownerName,
  secondOwnerName,
  averageRating,
  reviewCount = 0,
  hasPropertyImage,
  onScheduleCall,
  onRefresh,
  onLogout,
  isRefreshing,
}: MobileHeaderProps) {
  const firstName = ownerName?.split(' ')[0] || 'Owner';
  const secondFirstName = secondOwnerName?.split(' ')[0];

  return (
    <div className={cn(
      "relative z-30 px-4 py-3",
      hasPropertyImage ? "text-white" : ""
    )}>
      <div className="flex items-center justify-between">
        {/* Left: Logo + Property Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0",
            hasPropertyImage 
              ? "bg-white/90 dark:bg-background/90 backdrop-blur" 
              : "bg-primary/10"
          )}>
            <Building2 className={cn(
              "h-5 w-5",
              hasPropertyImage ? "text-primary" : "text-primary"
            )} />
          </div>
          
          <div className="min-w-0 flex-1">
            <h1 className={cn(
              "font-bold text-base leading-tight truncate",
              !hasPropertyImage && "text-foreground"
            )}>
              {propertyName || "Your Property"}
            </h1>
            <div className={cn(
              "flex items-center gap-2 text-sm",
              hasPropertyImage ? "text-white/80" : "text-muted-foreground"
            )}>
              <span className="truncate">
                Welcome, {firstName}
                {secondFirstName && ` & ${secondFirstName}`}
              </span>
              {averageRating && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{averageRating.toFixed(1)}</span>
                    {reviewCount > 0 && (
                      <span className="opacity-70">({reviewCount})</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant={hasPropertyImage ? "secondary" : "outline"} 
              size="icon"
              className={cn(
                "h-10 w-10 shrink-0",
                hasPropertyImage && "bg-white/20 hover:bg-white/30 border-white/20"
              )}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-background/95 backdrop-blur-xl">
            <DropdownMenuItem onClick={onScheduleCall} className="gap-3 py-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Phone className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium">Schedule Call</p>
                <p className="text-xs text-muted-foreground">Talk to your manager</p>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={onRefresh} 
              disabled={isRefreshing}
              className="gap-3 py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <RefreshCw className={cn(
                  "h-4 w-4 text-blue-600",
                  isRefreshing && "animate-spin"
                )} />
              </div>
              <div>
                <p className="font-medium">{isRefreshing ? "Refreshing..." : "Refresh Data"}</p>
                <p className="text-xs text-muted-foreground">Update dashboard</p>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={onLogout} className="gap-3 py-3 text-destructive focus:text-destructive">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-medium">Log Out</p>
                <p className="text-xs text-muted-foreground">Sign out of portal</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
