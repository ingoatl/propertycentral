import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPortalAdmin } from "@/components/admin/OwnerPortalAdmin";
import { IntegrationStatusDashboard } from "@/components/admin/IntegrationStatusDashboard";
import { Users, Activity } from "lucide-react";

export default function OwnerPortalManagement() {
  const [activeTab, setActiveTab] = useState("owners");

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
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
