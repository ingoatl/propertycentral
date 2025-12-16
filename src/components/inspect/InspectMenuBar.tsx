import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardCheck, AlertTriangle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const tabs: MenuTab[] = [
  { id: 'home', label: 'Home', icon: <Home className="h-6 w-6" />, path: '/inspect' },
  { id: 'inspections', label: 'Inspections', icon: <ClipboardCheck className="h-6 w-6" />, path: '/inspect/history' },
  { id: 'issues', label: 'Issues', icon: <AlertTriangle className="h-6 w-6" />, path: '/inspect/issues' },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-6 w-6" />, path: '/inspect/settings' },
];

export const InspectMenuBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/inspect') {
      return location.pathname === '/inspect' || location.pathname.startsWith('/inspect/property/');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bg-background/95 backdrop-blur-xl border-t border-border/50">
      <div className="flex items-center justify-around py-2 px-4">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200",
                "active:scale-95",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "transition-transform duration-200",
                active && "scale-110"
              )}>
                {tab.icon}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Home indicator bar for iOS */}
      <div className="flex justify-center pb-1">
        <div className="w-32 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
    </div>
  );
};
