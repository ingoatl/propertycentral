import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SlideLayoutProps {
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
  overlay?: "dark" | "light" | "gradient" | "none";
}

export function SlideLayout({
  children,
  className,
  backgroundImage,
  overlay = "dark",
}: SlideLayoutProps) {
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Background Image */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      {/* Overlay */}
      {overlay !== "none" && (
        <div
          className={cn(
            "absolute inset-0",
            overlay === "dark" && "bg-black/60",
            overlay === "light" && "bg-white/80",
            overlay === "gradient" &&
              "bg-gradient-to-br from-[#0a0a1a]/95 via-[#0a0a1a]/80 to-[#1a1a3a]/90"
          )}
        />
      )}

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center p-6 md:p-12 lg:p-16 xl:p-20">
        {children}
      </div>
    </div>
  );
}
