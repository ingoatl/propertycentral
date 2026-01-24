import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPortalAdmin } from "@/components/admin/OwnerPortalAdmin";
import { IntegrationStatusDashboard } from "@/components/admin/IntegrationStatusDashboard";
import { Users, Activity } from "lucide-react";

export default function OwnerPortalManagement() {
  const [activeTab, setActiveTab] = useState("owners");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="owners" className="gap-2">
            <Users className="h-4 w-4" />
            Owners
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Activity className="h-4 w-4" />
            Integration Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owners" className="mt-6">
          <OwnerPortalAdmin />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationStatusDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
