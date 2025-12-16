import React from 'react';
import { Settings, Info } from 'lucide-react';
import { MobileAppLayout, ScrollbarHideStyle } from '@/components/inspect/MobileAppLayout';
import { InspectTopBar } from '@/components/inspect/InspectTopBar';
import { InspectMenuBar } from '@/components/inspect/InspectMenuBar';

const InspectSettings: React.FC = () => {
  return (
    <>
      <ScrollbarHideStyle />
      <MobileAppLayout
        topBar={<InspectTopBar title="Settings" />}
        menuBar={<InspectMenuBar />}
      >
        <div className="p-4 space-y-6">
          <div className="text-center py-12">
            <div className="inline-flex p-4 bg-muted rounded-3xl mb-4">
              <Settings className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold mb-2">Settings</h2>
            <p className="text-muted-foreground">
              App settings coming soon
            </p>
          </div>
          
          <div className="p-4 rounded-2xl border bg-card">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">STR Inspection App</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Version 1.0.0
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Quick property inspections for short-term rentals. 
                  Check safety items, access, essentials, and appliances before guest arrival.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MobileAppLayout>
    </>
  );
};

export default InspectSettings;
