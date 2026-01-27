import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OwnerPortalAdmin } from "@/components/admin/OwnerPortalAdmin";
import { IntegrationStatusDashboard } from "@/components/admin/IntegrationStatusDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Activity, Presentation, ExternalLink } from "lucide-react";

export default function OwnerPortalManagement() {
  const [activeTab, setActiveTab] = useState("owners");

  return (
    <div className="container mx-auto px-3 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
      {/* Presentation Links Card */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Presentation className="h-5 w-5 text-amber-600" />
            Presentation Links
          </CardTitle>
          <CardDescription>Share these links with prospects to showcase our services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/owner-portal-presentation" target="_blank">
              <Button variant="outline" className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50">
                <ExternalLink className="h-4 w-4 mr-2" />
                Owner Portal
              </Button>
            </Link>
            <Link to="/onboarding-presentation" target="_blank">
              <Button variant="outline" className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50">
                <ExternalLink className="h-4 w-4 mr-2" />
                Onboarding
              </Button>
            </Link>
            <Link to="/designer-presentation" target="_blank">
              <Button variant="outline" className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50">
                <ExternalLink className="h-4 w-4 mr-2" />
                Design Services
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

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
