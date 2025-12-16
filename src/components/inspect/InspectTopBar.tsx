import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface InspectTopBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  progress?: number; // 0-100
}

export const InspectTopBar: React.FC<InspectTopBarProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  progress
}) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="bg-background/95 backdrop-blur-xl border-b border-border/50">
      {/* Progress bar */}
      {progress !== undefined && (
        <div className="h-1 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Back button or spacer */}
        <div className="w-16 flex justify-start">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex items-center text-primary active:opacity-70 transition-opacity -ml-2 p-2"
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="text-base">Back</span>
            </button>
          )}
        </div>
        
        {/* Center: Title with animation */}
        <div className="flex-1 text-center">
          <h1 
            key={title}
            className={cn(
              "text-lg font-semibold text-foreground animate-fade-in",
              "truncate max-w-[200px] mx-auto"
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        
        {/* Right: Action or spacer */}
        <div className="w-16 flex justify-end">
          {rightAction}
        </div>
      </div>
    </div>
  );
};
