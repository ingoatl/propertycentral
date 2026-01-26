import { useState } from "react";
import { Building2, Star, Phone, RefreshCw, LogOut, MoreVertical, Mic, MessageSquare, Video, Calendar } from "lucide-react";
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
  ownerPhone?: string | null;
  ownerEmail?: string | null;
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
  ownerPhone,
  ownerEmail,
}: MobileHeaderProps) {
  const firstName = ownerName?.split(' ')[0] || 'Owner';
  const secondFirstName = secondOwnerName?.split(' ')[0];

  return (
    <div className={cn(
      "relative z-30",
      hasPropertyImage ? "text-white" : ""
    )}>
      {/* Main Header Row */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Property Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
              hasPropertyImage 
                ? "bg-white/95 dark:bg-background/95 backdrop-blur-sm" 
                : "bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20"
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
                  Hi, {firstName}
                  {secondFirstName && ` & ${secondFirstName}`}
                </span>
                {averageRating && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium">{averageRating.toFixed(1)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant={hasPropertyImage ? "secondary" : "ghost"} 
                size="icon"
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl",
                  hasPropertyImage && "bg-white/20 hover:bg-white/30 border-white/20"
                )}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-background/95 backdrop-blur-xl">
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
                  <p className="font-medium">{isRefreshing ? "Refreshing..." : "Refresh"}</p>
                  <p className="text-xs text-muted-foreground">Update data</p>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={onLogout} className="gap-3 py-3 text-destructive focus:text-destructive">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <LogOut className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="font-medium">Log Out</p>
                  <p className="text-xs text-muted-foreground">Sign out</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="px-4 pb-3">
        <div className={cn(
          "flex items-center gap-2 p-2 rounded-2xl",
          hasPropertyImage 
            ? "bg-white/10 backdrop-blur-md border border-white/20" 
            : "bg-muted/50 border border-border/50"
        )}>
          {/* Schedule Call - Primary */}
          <Button
            onClick={onScheduleCall}
            size="sm"
            className={cn(
              "flex-1 gap-2 rounded-xl h-10 font-medium",
              hasPropertyImage 
                ? "bg-white text-primary hover:bg-white/90 shadow-lg" 
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>Schedule Call</span>
          </Button>

          {/* Voice Message */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-xl shrink-0",
              hasPropertyImage 
                ? "text-white hover:bg-white/20" 
                : "text-foreground hover:bg-muted"
            )}
            onClick={() => {
              // Navigate to messages tab - voice section
              const event = new CustomEvent('ownerPortalAction', { detail: { action: 'voicemail' } });
              window.dispatchEvent(event);
            }}
          >
            <Mic className="h-5 w-5" />
          </Button>

          {/* Text Message */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-xl shrink-0",
              hasPropertyImage 
                ? "text-white hover:bg-white/20" 
                : "text-foreground hover:bg-muted"
            )}
            onClick={() => {
              const event = new CustomEvent('ownerPortalAction', { detail: { action: 'sms' } });
              window.dispatchEvent(event);
            }}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          {/* Video Message */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-xl shrink-0",
              hasPropertyImage 
                ? "text-white hover:bg-white/20" 
                : "text-foreground hover:bg-muted"
            )}
            onClick={() => {
              const event = new CustomEvent('ownerPortalAction', { detail: { action: 'video' } });
              window.dispatchEvent(event);
            }}
          >
            <Video className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
