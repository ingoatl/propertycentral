import { useState } from "react";
import { InboxView } from "@/components/communications/InboxView";
import { OwnerQuickPanel } from "@/components/communications/OwnerQuickPanel";
import { CallSyncButton } from "@/components/communications/CallSyncButton";
import { MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Communications = () => {
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Communications Hub</h1>
            <p className="text-muted-foreground">
              View and manage all SMS, calls, and emails in one place
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CallSyncButton />
          <Button 
            variant="outline" 
            onClick={() => setShowOwnerPanel(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Owner Comms
          </Button>
        </div>
      </div>

      {/* Main Layout - Full Width Inbox */}
      <div className="w-full">
        <InboxView />
      </div>

      {/* Owner Communications Modal */}
      <Dialog open={showOwnerPanel} onOpenChange={setShowOwnerPanel}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Owner Communications
            </DialogTitle>
          </DialogHeader>
          <OwnerQuickPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Communications;
