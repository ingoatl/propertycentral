import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GmailHealthWatchdog } from "@/components/dashboard/GmailHealthWatchdog";
import { VisitPriceWatchdogCard } from "@/components/admin/VisitPriceWatchdogCard";
import { ExpenseWatchdogCard } from "@/components/admin/ExpenseWatchdogCard";
import { PartnerSyncWatchdogCard } from "@/components/admin/PartnerSyncWatchdogCard";
import { SyncStatusBar } from "@/components/admin/SyncStatusBar";
import { IntegrationStatusDashboard } from "@/components/admin/IntegrationStatusDashboard";
import { ComplianceWatchdogCard } from "@/components/admin/ComplianceWatchdogCard";
import { Activity, Mail, DollarSign, Home, RefreshCw, Shield } from "lucide-react";

export const SystemHealthPanel = () => {
  const [activeTab, setActiveTab] = useState("integrations");

  return (
    <div className="space-y-6">
      {/* Sync Status Bar - Always visible at top */}
      <SyncStatusBar />

      {/* Tabbed Watchdog Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="integrations" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Finance</span>
          </TabsTrigger>
          <TabsTrigger value="visits" className="gap-1.5">
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Visits</span>
          </TabsTrigger>
          <TabsTrigger value="partner" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Partner</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4">
          <IntegrationStatusDashboard />
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <ComplianceWatchdogCard />
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <div className="grid gap-4">
            <GmailHealthWatchdog />
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <div className="grid gap-4">
            <ExpenseWatchdogCard />
          </div>
        </TabsContent>

        <TabsContent value="visits" className="mt-4">
          <div className="grid gap-4">
            <VisitPriceWatchdogCard />
          </div>
        </TabsContent>

        <TabsContent value="partner" className="mt-4">
          <div className="grid gap-4">
            <PartnerSyncWatchdogCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
