import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPortalAdmin } from "@/components/admin/OwnerPortalAdmin";
import { IntegrationStatusDashboard } from "@/components/admin/IntegrationStatusDashboard";
import { Users, Activity, Presentation, ExternalLink } from "lucide-react";

export default function OwnerPortalManagement() {
  const [activeTab, setActiveTab] = useState("owners");

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
      {/* Compact Presentation Links */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm bg-muted/50 rounded-lg px-4 py-2">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Presentation className="h-3.5 w-3.5" />
          Presentations:
        </span>
        <Link 
          to="/owner-portal-presentation" 
          target="_blank"
          className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Owner Portal
        </Link>
        <span className="text-muted-foreground">•</span>
        <Link 
          to="/onboarding-presentation" 
          target="_blank"
          className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Onboarding
        </Link>
        <span className="text-muted-foreground">•</span>
        <Link 
          to="/designer-presentation" 
          target="_blank"
          className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Design Services
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-9 md:h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto">
          <TabsTrigger value="owners" className="gap-1.5 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span>Owners</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5 md:gap-2 text-xs md:text-sm flex-1 sm:flex-none">
            <Activity className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Integration Status</span>
            <span className="sm:hidden">Integrations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owners" className="mt-4 md:mt-6">
          <OwnerPortalAdmin />
        </TabsContent>

        <TabsContent value="integrations" className="mt-4 md:mt-6">
          <IntegrationStatusDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
