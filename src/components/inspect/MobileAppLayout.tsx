import React from 'react';
import { cn } from '@/lib/utils';

interface MobileAppLayoutProps {
  children: React.ReactNode;
  topBar?: React.ReactNode;
  menuBar?: React.ReactNode;
  className?: string;
}

export const MobileAppLayout: React.FC<MobileAppLayoutProps> = ({
  children,
  topBar,
  menuBar,
  className
}) => {
  return (
    <div 
      className={cn(
        "h-[100dvh] w-full flex flex-col bg-background overflow-hidden",
        // iOS safe areas
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      {/* Top Bar - Relative positioning */}
      {topBar && (
        <div className="relative flex-shrink-0">
          {topBar}
        </div>
      )}
      
      {/* App Content - Flexbox grow/shrink */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="animate-fade-in">
          {children}
        </div>
      </div>
      
      {/* Menu Bar - Relative positioning */}
      {menuBar && (
        <div className="relative flex-shrink-0">
          {menuBar}
        </div>
      )}
    </div>
  );
};

// Add scrollbar-hide utility via style tag
const ScrollbarHideStyle = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}</style>
);

export { ScrollbarHideStyle };
