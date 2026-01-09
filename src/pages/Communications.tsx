import { useState } from "react";
import { InboxView } from "@/components/communications/InboxView";
import { OwnerQuickPanel } from "@/components/communications/OwnerQuickPanel";
import { CallSyncButton } from "@/components/communications/CallSyncButton";
import { MessageSquare, Users, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CallRecapModal } from "@/components/CallRecapModal";
import { usePendingCallRecaps } from "@/hooks/usePendingCallRecaps";

const Communications = () => {
  const [showOwnerPanel, setShowOwnerPanel] = useState(false);
  const [showCallReview, setShowCallReview] = useState(false);
  const { pendingRecaps } = usePendingCallRecaps();

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
          {pendingRecaps.length > 0 && (
            <Button 
              variant="default"
              onClick={() => setShowCallReview(true)}
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              Review Calls
              <Badge variant="secondary" className="ml-1 bg-white/20">
                {pendingRecaps.length}
              </Badge>
            </Button>
          )}
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

      {/* Call Review Modal */}
      {showCallReview && (
        <Dialog open={showCallReview} onOpenChange={setShowCallReview}>
          <DialogContent className="max-w-3xl max-h-[90vh] p-0">
            <CallRecapModal />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Communications;
